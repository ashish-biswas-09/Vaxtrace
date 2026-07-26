"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type RequisitionState = { error?: string; ok?: string } | undefined;

const createSchema = z.object({
  from_facility_id: z.string().uuid("চাহিদাকারী কেন্দ্র নির্বাচন করুন"),
  to_facility_id: z.string().uuid("সরবরাহকারী গুদাম নির্বাচন করুন"),
  needed_by: z.string().min(1, "কবে প্রয়োজন তা দিন"),
  note: z.string().trim().max(300).optional(),
  vaccine_id: z.string().uuid("টিকা নির্বাচন করুন"),
  quantity: z.coerce.number().int().positive("সংখ্যা শূন্যের বেশি হতে হবে"),
});

// One line per requisition at creation, and more lines are added by submitting again against
// the same open request. A multi-row form here would need client-side row management for a
// screen where the common case is one antigen; the table supports many lines and the UI can
// grow into it when a real user asks.
export async function createRequisitionAction(
  _prev: RequisitionState,
  formData: FormData,
): Promise<RequisitionState> {
  const parsed = createSchema.safeParse({
    from_facility_id: formData.get("from_facility_id"),
    to_facility_id: formData.get("to_facility_id"),
    needed_by: formData.get("needed_by"),
    note: formData.get("note") || undefined,
    vaccine_id: formData.get("vaccine_id"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  if (parsed.data.from_facility_id === parsed.data.to_facility_id) {
    return { error: "একই কেন্দ্র নিজের কাছে চাহিদা দিতে পারে না।" };
  }

  const { supabase } = await requireAppRole("store_keeper");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "সেশন পাওয়া যায়নি।" };

  const { data: req, error } = await supabase
    .from("requisitions")
    .insert({
      from_facility_id: parsed.data.from_facility_id,
      to_facility_id: parsed.data.to_facility_id,
      needed_by: parsed.data.needed_by,
      note: parsed.data.note ?? null,
      requested_by: user.id,
    })
    .select("id, code")
    .single();

  if (error || !req) {
    return {
      error: error?.message.includes("row-level security")
        ? "এই কেন্দ্রের পক্ষে চাহিদাপত্র দেওয়ার অনুমতি নেই।"
        : "চাহিদাপত্র তৈরি করা যায়নি।",
    };
  }

  const { error: lineError } = await supabase.from("requisition_lines").insert({
    requisition_id: req.id,
    vaccine_id: parsed.data.vaccine_id,
    quantity_requested: parsed.data.quantity,
  });
  if (lineError) return { error: "চাহিদাপত্রের লাইন যোগ করা যায়নি।" };

  revalidatePath("/admin/requisitions");
  return { ok: `চাহিদাপত্র ${req.code} জমা হয়েছে।` };
}

const decideSchema = z.object({
  requisition_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  decision_note: z.string().trim().max(300).optional(),
  approved: z.coerce.number().int().min(0).optional(),
  vaccine_id: z.string().uuid().optional(),
});

export async function decideRequisitionAction(
  _prev: RequisitionState,
  formData: FormData,
): Promise<RequisitionState> {
  const parsed = decideSchema.safeParse({
    requisition_id: formData.get("requisition_id"),
    decision: formData.get("decision"),
    decision_note: formData.get("decision_note") || undefined,
    approved: formData.get("approved") || undefined,
    vaccine_id: formData.get("vaccine_id") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  // The table constraint requires it too; catching it here gives the storekeeper a sentence
  // rather than a constraint name.
  if (parsed.data.decision === "rejected" && !parsed.data.decision_note) {
    return { error: "প্রত্যাখ্যানের কারণ লিখুন — চাহিদাকারী কেন্দ্রের কাছে এটিই একমাত্র উত্তর।" };
  }

  const { supabase } = await requireAppRole("store_keeper");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (parsed.data.decision === "approved" && parsed.data.vaccine_id) {
    const { error } = await supabase
      .from("requisition_lines")
      .update({ quantity_approved: parsed.data.approved ?? 0 })
      .eq("requisition_id", parsed.data.requisition_id)
      .eq("vaccine_id", parsed.data.vaccine_id);
    if (error) return { error: "অনুমোদিত পরিমাণ সংরক্ষণ করা যায়নি।" };
  }

  const { error } = await supabase
    .from("requisitions")
    .update({
      status: parsed.data.decision,
      decided_by: user?.id ?? null,
      decided_at: new Date().toISOString(),
      decision_note: parsed.data.decision_note ?? null,
    })
    .eq("id", parsed.data.requisition_id)
    .eq("status", "submitted");

  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "শুধু সরবরাহকারী গুদামই সিদ্ধান্ত নিতে পারে।"
        : "সিদ্ধান্ত সংরক্ষণ করা যায়নি।",
    };
  }

  revalidatePath("/admin/requisitions");
  return { ok: parsed.data.decision === "approved" ? "অনুমোদিত হয়েছে।" : "প্রত্যাখ্যাত হয়েছে।" };
}

// Issuing is one database transaction, not three writes from here: the supplying store is
// debited, the receiving store credited and the lines stamped with the batch actually sent.
// Done as separate statements it can half-happen and leave doses that exist nowhere.
export async function issueRequisitionAction(
  _prev: RequisitionState,
  formData: FormData,
): Promise<RequisitionState> {
  const id = z.string().uuid().safeParse(formData.get("requisition_id"));
  if (!id.success) return { error: "চাহিদাপত্র পাওয়া যায়নি।" };

  const { supabase } = await requireAppRole("store_keeper");

  const { data, error } = await supabase.rpc("issue_requisition", { p_requisition_id: id.data });
  if (error) {
    if (error.message.includes("No usable batch")) {
      return { error: "গুদামে ব্যবহারযোগ্য কোনো ব্যাচ নেই (মেয়াদ আছে এবং মজুদ আছে এমন)।" };
    }
    if (error.message.includes("Not enough stock")) {
      return { error: "গুদামে যথেষ্ট মজুদ নেই — অনুমোদিত পরিমাণ কমিয়ে আবার চেষ্টা করুন।" };
    }
    if (error.message.includes("Nothing to issue")) {
      return { error: "কোনো লাইনে অনুমোদিত পরিমাণ নেই।" };
    }
    return { error: "প্রেরণ করা যায়নি।" };
  }

  revalidatePath("/admin/requisitions");
  revalidatePath("/admin/stock");
  return { ok: `${data} টি লাইন প্রেরণ করা হয়েছে।` };
}

export async function confirmReceiptAction(
  _prev: RequisitionState,
  formData: FormData,
): Promise<RequisitionState> {
  const id = z.string().uuid().safeParse(formData.get("requisition_id"));
  if (!id.success) return { error: "চাহিদাপত্র পাওয়া যায়নি।" };

  const { supabase } = await requireAppRole("store_keeper");

  const { error } = await supabase
    .from("requisitions")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "issued");

  if (error) return { error: "গ্রহণ নিশ্চিত করা যায়নি।" };

  revalidatePath("/admin/requisitions");
  return { ok: "গ্রহণ নিশ্চিত হয়েছে।" };
}
