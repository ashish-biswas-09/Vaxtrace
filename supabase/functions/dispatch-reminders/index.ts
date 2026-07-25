// Reminder dispatcher: drains the `notifications` queue and hands each row to a provider.
//
// The queue is filled by public.enqueue_reminders() (pg_cron, daily). This function is the
// only part of the reminder system that needs an external provider, which is why it lives
// here and not in a trigger: everything that can be guaranteed by the database already is.
//
// Design rules:
//  * Runs on the service role, so it bypasses RLS. It is therefore gated on a shared secret
//    and never trusts anything in the request body.
//  * If a channel has no provider configured it is SKIPPED, not failed. Marking rows failed
//    because the operator has not bought an SMS gateway yet would fill the delivery log with
//    noise and burn the retry budget.
//  * `attempts` is incremented on every try. A row that has failed too many times goes to
//    `dead` so it stops being retried forever.
//  * Only `queued` and `failed` rows are claimed, so an already-`sent` row can never be sent
//    twice no matter how often this runs.

const MAX_ATTEMPTS = 5;
const BATCH = 100;

type Notification = {
  id: string;
  recipient_id: string;
  channel: "sms" | "email";
  due_date: string;
  attempts: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SMS_GATEWAY_URL = Deno.env.get("SMS_GATEWAY_URL");
const SMS_GATEWAY_KEY = Deno.env.get("SMS_GATEWAY_KEY");

function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

// Bengali message body. Kept here rather than in a template table: it is one sentence, and a
// template system nobody has asked for is a second thing to keep translated.
function messageFor(childName: string, dueDate: string): string {
  const bn = (s: string) => s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
  const [y, m, d] = dueDate.slice(0, 10).split("-");
  return `প্রিয় অভিভাবক, ${childName}-এর পরবর্তী টিকার তারিখ ${bn(`${d}/${m}/${y}`)}। নিকটস্থ টিকাকেন্দ্রে যোগাযোগ করুন। — VaxTrace`;
}

async function sendEmail(to: string, body: string): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VaxTrace <reminders@vaxtrace.bd>",
      to,
      subject: "টিকার সময় হয়েছে — VaxTrace",
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return (await res.json()).id ?? "sent";
}

async function sendSms(to: string, body: string): Promise<string> {
  const res = await fetch(SMS_GATEWAY_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SMS_GATEWAY_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, message: body }),
  });
  if (!res.ok) throw new Error(`sms ${res.status}: ${await res.text()}`);
  return (await res.json())?.message_id ?? "sent";
}

Deno.serve(async (req) => {
  // Shared-secret gate. Without CRON_SECRET set the endpoint refuses outright rather than
  // defaulting to open.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailReady = Boolean(RESEND_API_KEY);
  const smsReady = Boolean(SMS_GATEWAY_URL && SMS_GATEWAY_KEY);

  if (!emailReady && !smsReady) {
    return new Response(
      JSON.stringify({
        skipped: "no provider configured",
        hint: "set RESEND_API_KEY and/or SMS_GATEWAY_URL + SMS_GATEWAY_KEY",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const nowIso = new Date().toISOString();
  // `failed` is included deliberately: it means "retryable". Claiming only `queued` would
  // make the first transient provider error permanent. `dead` is excluded — that is the
  // terminal state MAX_ATTEMPTS puts a row into.
  const due = await rest(
    `notifications?status=in.(queued,failed)&scheduled_for=lte.${nowIso}` +
      `&select=id,recipient_id,channel,due_date,attempts,schedule_id&limit=${BATCH}`,
  );
  const rows: (Notification & { schedule_id: string })[] = await due.json();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const n of rows) {
    if ((n.channel === "email" && !emailReady) || (n.channel === "sms" && !smsReady)) {
      skipped++;
      continue;
    }

    const attempts = n.attempts + 1;
    try {
      // Recipient contact and the child's name, resolved per row. Volumes here are one
      // message per due dose, so a join-per-row is cheaper than holding the world in memory.
      const [pRes, sRes] = await Promise.all([
        rest(`profiles?id=eq.${n.recipient_id}&select=contact`),
        rest(`schedules?id=eq.${n.schedule_id}&select=child_id,children(full_name)`),
      ]);
      const contact = (await pRes.json())[0]?.contact;
      const childName = (await sRes.json())[0]?.children?.full_name ?? "আপনার শিশু";

      if (!contact) throw new Error("recipient has no contact on file");

      const body = messageFor(childName, n.due_date);
      const ref = n.channel === "email" ? await sendEmail(contact, body) : await sendSms(contact, body);

      await rest(`notifications?id=eq.${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "sent",
          attempts,
          sent_at: new Date().toISOString(),
          provider_ref: ref,
          last_error: null,
        }),
      });
      sent++;
    } catch (err) {
      // Past the retry budget the row is `dead`, so a permanently bad address stops
      // consuming attempts on every run.
      await rest(`notifications?id=eq.${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: attempts >= MAX_ATTEMPTS ? "dead" : "failed",
          attempts,
          last_error: String(err).slice(0, 500),
        }),
      });
      failed++;
    }
  }

  return new Response(JSON.stringify({ examined: rows.length, sent, failed, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
