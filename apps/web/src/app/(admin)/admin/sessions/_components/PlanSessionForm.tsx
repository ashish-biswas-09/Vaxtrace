"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Database } from "@vaxtrace/db-types";
import { dateBn } from "@/lib/format";
import { isUnder } from "@/lib/locations";
import { SESSION_TYPE_BN } from "@/lib/programme";
import { Button } from "@/components/ui/Button";
import { FormDialog } from "@/components/ui/FormDialog";
import { PlusIcon } from "@/components/icons";
import { FormMessage, SubmitButton } from "@/components/ui/kit";
import { useToast } from "@/components/ui/Toast";
import { planSessionAction, sessionStaffAction, type SessionState } from "../_actions";

type SessionType = Database["public"]["Enums"]["session_type"];

type Facility = {
  id: string;
  label: string;
  location_id: string;
  location_label: string;
  root: string;
};
type Site = { id: string; path: string; label: string };
type Staff = { id: string; name: string };

type Props = {
  facilities: Facility[];
  sites: Site[];
  fallbackStaff: Staff[];
  today: string;
};

// The primary action of the screen, so it sits in the header rather than under a four-page
// table (P3-2), and opens as a dialog.
export function PlanSessionDialog(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<PlusIcon size={16} />} onClick={() => setOpen(true)}>
        নতুন সেশন
      </Button>
      {open && (
        <FormDialog title="নতুন সেশন পরিকল্পনা" onClose={() => setOpen(false)}>
          <PlanSessionForm {...props} onDone={() => setOpen(false)} />
        </FormDialog>
      )}
    </>
  );
}

function PlanSessionForm({ facilities, sites, fallbackStaff, today, onDone }: Props & { onDone: () => void }) {
  const [state, save] = useActionState<SessionState, FormData>(planSessionAction, undefined);
  const [type, setType] = useState<SessionType>("fixed");
  const [facilityId, setFacilityId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [date, setDate] = useState("");
  const [staff, setStaff] = useState<Staff[]>(fallbackStaff);
  const [loadingStaff, startStaff] = useTransition();
  const toast = useToast();

  const facility = facilities.find((f) => f.id === facilityId);
  // Outreach and campaigns go to a union or ward inside the facility's own upazila; a fixed
  // session is held at the facility. The server checks the same rule (K-17).
  const options = facility ? sites.filter((s) => isUnder(s.path, facility.root)) : [];

  useEffect(() => {
    if (state?.ok) {
      toast("success", state.ok);
      onDone();
    }
  }, [state, toast, onDone]);

  const onFacility = (id: string) => {
    setFacilityId(id);
    setSiteId("");
    if (!id) return;
    // Team leads posted at, above or below this facility (session_staff); the page's own list
    // is kept if that lookup is unavailable.
    startStaff(async () => {
      const found = await sessionStaffAction(id);
      setStaff(found ?? fallbackStaff);
    });
  };

  const field =
    "mt-1 h-10 w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]";
  const label = "text-sm text-[var(--text-secondary)]";

  return (
    <form action={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          ধরন
          <select
            name="type"
            value={type}
            autoFocus
            onChange={(e) => {
              setType(e.target.value as SessionType);
              setSiteId("");
            }}
            className={field}
          >
            {(Object.keys(SESSION_TYPE_BN) as SessionType[]).map((t) => (
              <option key={t} value={t}>
                {SESSION_TYPE_BN[t]}
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          পরিচালনাকারী কেন্দ্র
          <select name="facility_id" required value={facilityId} onChange={(e) => onFacility(e.target.value)} className={field}>
            <option value="">বেছে নিন…</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={label}>
        সেশনের স্থান
        {type === "fixed" ? (
          <>
            <input type="hidden" name="location_id" value={facility?.location_id ?? ""} />
            <span className={`${field} flex items-center text-[var(--text-secondary)]`}>
              {facility ? facility.location_label : "প্রথমে কেন্দ্র বেছে নিন"}
            </span>
          </>
        ) : (
          <select
            name="location_id"
            required
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={!facility}
            className={field}
          >
            <option value="">{facility ? "বেছে নিন…" : "প্রথমে কেন্দ্র বেছে নিন"}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <span className="mt-1 block text-xs text-[var(--text-muted)]">
          {type === "fixed"
            ? "স্থায়ী কেন্দ্রের সেশন কেন্দ্রের নিজের এলাকায় হয়।"
            : "যে ইউনিয়ন বা ওয়ার্ডে সেশন বসছে — কেন্দ্রের নিজের ওয়ার্ড নয়।"}
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className={`${label} sm:col-span-2`}>
          তারিখ
          <input
            type="date"
            name="session_date"
            required
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
          {/* The native picker's format follows the browser locale (mm/dd/yyyy). */}
          <span className="mt-1 block text-xs text-[var(--text-muted)]">
            {date ? dateBn(date) : "দিন/মাস/বছর"}
          </span>
        </label>
        <label className={label}>
          শুরু
          <input type="time" name="start_time" className={field} />
        </label>
        <label className={label}>
          শেষ
          <input type="time" name="end_time" className={field} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          লক্ষ্য শিশু
          <input type="number" name="target_children" min={0} max={10000} className={field} />
        </label>
        <label className={label}>
          দলনেতা
          <select name="team_lead" className={field} disabled={loadingStaff}>
            <option value="">পরে ঠিক করা হবে</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={label}>
        মন্তব্য
        <input name="notes" maxLength={400} className={field} />
      </label>

      <FormMessage error={state?.error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          বাতিল
        </Button>
        <SubmitButton>সেশন পরিকল্পনা করুন</SubmitButton>
      </div>
    </form>
  );
}
