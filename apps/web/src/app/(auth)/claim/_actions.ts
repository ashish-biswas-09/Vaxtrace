"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ClaimState = { error?: string; ok?: string } | undefined;

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

// A Child ID is printed on a paper card and read off it, over the phone, by people typing on
// a Bangla keyboard. It is *displayed* in Bengali numerals everywhere else in this product,
// so it will be typed that way — normalising means either script works and nobody has to know
// which one the database stores.
const schema = z.object({
  child_id: z
    .string()
    .transform((v) => v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))).replace(/\D/g, ""))
    .refine((v) => /^[0-9]{10}$/.test(v), { message: "১০ সংখ্যার শিশু আইডি লিখুন" }),
});

// FR-15. The guardian claims the children a worker registered on their behalf.
//
// Every security-relevant part of this is in claim_child(): it matches the phone number on the
// guardian record against the phone Supabase Auth has already verified for this session, it
// rate-limits attempts, and it returns the same message for "no such child" and "wrong phone"
// so the form cannot be used to discover whether a Child ID exists. This action shapes input
// and translates failure — nothing more, on purpose.
export async function claimChildAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const parsed = schema.safeParse({ child_id: formData.get("child_id") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "শিশু আইডি সঠিক নয়" };
  }

  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("claim_child", { p_child_id: parsed.data.child_id });

  if (error) {
    if (error.message.includes("verified by phone")) {
      return {
        error:
          "শিশুকে যুক্ত করতে ফোন নম্বর দিয়ে যাচাই করা অ্যাকাউন্ট প্রয়োজন। ফোন নম্বর ও ওটিপি দিয়ে প্রবেশ করুন।",
      };
    }
    if (error.message.includes("already linked")) {
      return { error: "এই শিশুর অভিভাবক রেকর্ড অন্য একটি অ্যাকাউন্টের সঙ্গে যুক্ত আছে।" };
    }
    if (error.message.includes("too many")) {
      return { error: "অনেকবার চেষ্টা করা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।" };
    }
    // The deliberate catch-all: "no such child" and "phone does not match" are the same
    // message by design.
    return { error: "শিশু আইডি ও ফোন নম্বর মিলছে না।" };
  }

  revalidatePath("/parent");
  return { ok: "শিশুটি আপনার অ্যাকাউন্টে যুক্ত হয়েছে।" };
}
