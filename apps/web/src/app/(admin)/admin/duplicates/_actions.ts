"use server";

import { requireAppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type MergeState = { error?: string; ok?: string } | undefined;

const schema = z
  .object({
    winner_id: z.string().uuid("কোন রেকর্ডটি থাকবে তা নির্বাচন করুন"),
    loser_id: z.string().uuid("কোন রেকর্ডটি মিলিয়ে দেওয়া হবে তা নির্বাচন করুন"),
    reason: z.string().trim().min(10, "একত্রীকরণের কারণ অন্তত ১০ অক্ষরে লিখুন").max(300),
  })
  .refine((v) => v.winner_id !== v.loser_id, {
    message: "একই রেকর্ড নিজের সঙ্গে মেলানো যায় না",
    path: ["loser_id"],
  });

// Merging is the most destructive act an administrator can take on this data, and it is
// irreversible from the UI. The database does the careful part — merge_children() moves the
// doses, voids the ones that collide rather than dropping them, and writes merged_into_id so
// the loser's Child ID still resolves for a family holding a printed card. What this has to do
// is refuse to send it without a reason, and make the caller say the word.
export async function mergeChildrenAction(
  _prev: MergeState,
  formData: FormData,
): Promise<MergeState> {
  const parsed = schema.safeParse({
    winner_id: formData.get("winner_id"),
    loser_id: formData.get("loser_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };

  const { supabase } = await requireAppRole("programme_manager");

  const { error } = await supabase.rpc("merge_children", {
    p_loser_id: parsed.data.loser_id,
    p_winner_id: parsed.data.winner_id,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "এই শিশুদের একত্র করার অনুমতি নেই।"
        : `একত্রীকরণ করা যায়নি: ${error.message}`,
    };
  }

  revalidatePath("/admin/duplicates");
  revalidatePath("/admin/children");
  return { ok: "রেকর্ড দুটি একত্র হয়েছে। পুরনো শিশু আইডিটিও এখনো কাজ করবে।" };
}
