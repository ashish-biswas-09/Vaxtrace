"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { dateBn, toBn } from "@/lib/format";
import { ConfirmButton, FormMessage, StatusBadge } from "../../_components/ui";
import { mergeChildrenAction, type MergeState } from "../_actions";
import type { DupGroup } from "../duplicates";

const CONFIDENCE_TONE = { exact: "danger", high: "warning", possible: "muted" } as const;
const CONFIDENCE_LABEL = {
  exact: "নিশ্চিত",
  high: "উচ্চ সম্ভাবনা",
  possible: "সম্ভাব্য",
} as const;

export function MergePanel({
  group,
  suggestedWinnerId,
}: {
  group: DupGroup;
  suggestedWinnerId: string;
}) {
  const [state, save] = useActionState<MergeState, FormData>(mergeChildrenAction, undefined);
  const [winner, setWinner] = useState(suggestedWinnerId);

  // Only two records can be merged in one action, so when a group has more than two the
  // reviewer picks the pair. Merging three at once would need a chain of merges and an
  // ordering decision nobody has asked for.
  const losers = group.children.filter((c) => c.id !== winner);
  const [loser, setLoser] = useState(losers[0]?.id ?? "");
  const loserChild = group.children.find((c) => c.id === loser);
  const winnerChild = group.children.find((c) => c.id === winner);

  return (
    <form action={save} className="rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{group.reason}</p>
        <StatusBadge tone={CONFIDENCE_TONE[group.confidence]}>
          {CONFIDENCE_LABEL[group.confidence]}
        </StatusBadge>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs text-[var(--color-muted)]">
            <tr>
              <th scope="col" className="pb-1 font-medium">রাখা হবে</th>
              <th scope="col" className="pb-1 font-medium">শিশু</th>
              <th scope="col" className="pb-1 font-medium">শিশু আইডি</th>
              <th scope="col" className="pb-1 font-medium">জন্মতারিখ</th>
              <th scope="col" className="pb-1 font-medium">অভিভাবক</th>
              <th scope="col" className="pb-1 text-right font-medium">ডোজ</th>
              <th scope="col" className="pb-1 font-medium">নিবন্ধন</th>
            </tr>
          </thead>
          <tbody>
            {group.children.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)]">
                <td className="py-2">
                  <input
                    type="radio"
                    name="winner_id"
                    value={c.id}
                    checked={winner === c.id}
                    onChange={() => {
                      setWinner(c.id);
                      // Keep the pair coherent: the record just chosen to survive cannot also
                      // be the one being merged away.
                      if (loser === c.id) {
                        setLoser(group.children.find((o) => o.id !== c.id)?.id ?? "");
                      }
                    }}
                    aria-label={`${c.full_name} (${c.child_id}) রাখুন`}
                  />
                </td>
                <td className="py-2">
                  <Link href={`/admin/children/${c.id}`} className="text-[var(--color-primary)]">
                    {c.full_name}
                  </Link>
                </td>
                <td className="py-2 font-mono text-xs">{c.child_id}</td>
                <td className="py-2">{dateBn(c.date_of_birth)}</td>
                <td className="py-2 text-xs">
                  {c.guardian_name}
                  <span className="block font-mono">{c.guardian_phone}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{toBn(c.doses)}</td>
                <td className="py-2 text-xs">{dateBn(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {group.children.length > 2 && (
        <label className="mt-4 block text-xs text-[var(--color-muted)]">
          কোনটি মিলিয়ে দেওয়া হবে
          <select
            value={loser}
            onChange={(e) => setLoser(e.target.value)}
            className="mt-1 w-full max-w-md rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {losers.map((c) => (
              <option key={c.id} value={c.id} className="text-black">
                {c.full_name} · {c.child_id}
              </option>
            ))}
          </select>
        </label>
      )}
      <input type="hidden" name="loser_id" value={loser} />

      <label className="mt-4 block text-xs text-[var(--color-muted)]">
        একত্রীকরণের কারণ
        <input
          name="reason"
          required
          minLength={10}
          maxLength={300}
          placeholder="যেমন: একই শিশু দুইবার নিবন্ধিত হয়েছে, জন্ম নিবন্ধন নম্বর মিলিয়ে দেখা হয়েছে"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="mt-4">
        {/* UX-05: a merge destroys history, so it takes a typed confirmation, not a click. */}
        <ConfirmButton
          label="একত্র করুন"
          title="দুটি রেকর্ড একত্র করবেন?"
          body={
            <>
              <p>
                <strong>{loserChild?.full_name}</strong> ({loserChild?.child_id})-এর সব ডোজ{" "}
                <strong>{winnerChild?.full_name}</strong> ({winnerChild?.child_id})-এ সরে যাবে।
                একই টিকার একই ডোজ দুই জায়গায় থাকলে সেটি বাতিল হিসেবে চিহ্নিত হবে — মুছে ফেলা হবে
                না, যাতে ভুলটির ইতিহাস থাকে।
              </p>
              <p className="mt-2">
                পুরনো শিশু আইডিটি কাজ করতেই থাকবে, কারণ পরিবারের হাতে থাকা ছাপানো কার্ডে সেটিই
                লেখা আছে। তবু এই কাজটি UI থেকে ফিরিয়ে নেওয়া যায় না।
              </p>
            </>
          }
          confirmLabel="একত্র করুন"
          typedConfirmation="একত্র"
        />
      </div>
    </form>
  );
}
