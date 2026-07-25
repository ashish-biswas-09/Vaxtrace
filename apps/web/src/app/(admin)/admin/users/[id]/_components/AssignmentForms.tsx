"use client";

import { useActionState, useState } from "react";
// From @/lib/roles, not @/lib/auth: this is a Client Component, and lib/auth reaches
// next/headers through the Supabase server client.
import { APP_ROLE_LABEL_BN, GRANTABLE_ROLES, type AppRole } from "@/lib/roles";
import { SubmitButton } from "../../../_components/ui";
import {
  grantAssignmentAction,
  revokeAssignmentAction,
  type AssignmentState,
} from "../_actions";

type Option = { id: string; label: string; depth: number };

export function GrantAssignmentForm({
  userId,
  locations,
  facilities,
}: {
  userId: string;
  locations: Option[];
  facilities: { id: string; label: string }[];
}) {
  const [state, grant] = useActionState<AssignmentState, FormData>(
    grantAssignmentAction,
    undefined,
  );
  const [role, setRole] = useState<AppRole>("field_worker");

  // A store keeper is posted to a store, not to an area — the scope that means anything for
  // them is which fridge they are responsible for. Showing both pickers to everyone would
  // invite the meaningless combination.
  const facilityFirst = role === "store_keeper";

  return (
    <form action={grant} className="flex flex-col gap-4">
      <input type="hidden" name="user_id" value={userId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="assign-role" className="mb-1 block text-sm font-medium">
            ভূমিকা
          </label>
          <select
            id="assign-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {GRANTABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {APP_ROLE_LABEL_BN[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="assign-valid-to" className="mb-1 block text-sm font-medium">
            মেয়াদ শেষ <span className="text-[var(--color-muted)]">(ঐচ্ছিক)</span>
          </label>
          <input
            id="assign-valid-to"
            name="valid_to"
            type="date"
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            বদলি বা সাময়িক দায়িত্ব হলে তারিখ দিন — মেয়াদ শেষে নিজে থেকেই বাতিল হবে।
          </p>
        </div>

        <div className={facilityFirst ? "sm:order-last" : ""}>
          <label htmlFor="assign-location" className="mb-1 block text-sm font-medium">
            এলাকা {facilityFirst && <span className="text-[var(--color-muted)]">(ঐচ্ছিক)</span>}
          </label>
          <select
            id="assign-location"
            name="location_id"
            defaultValue=""
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">— নির্বাচন করুন —</option>
            {locations.map((o) => (
              <option key={o.id} value={o.id}>
                {" ".repeat(o.depth * 2)}
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={facilityFirst ? "sm:order-first" : ""}>
          <label htmlFor="assign-facility" className="mb-1 block text-sm font-medium">
            কেন্দ্র {!facilityFirst && <span className="text-[var(--color-muted)]">(ঐচ্ছিক)</span>}
          </label>
          <select
            id="assign-facility"
            name="facility_id"
            defaultValue=""
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">— নির্বাচন করুন —</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-[var(--color-success)]">{state.ok}</p>}

      <SubmitButton pendingLabel="বরাদ্দ হচ্ছে…">দায়িত্ব বরাদ্দ করুন</SubmitButton>
    </form>
  );
}

export function RevokeAssignmentButton({
  assignmentId,
  userId,
}: {
  assignmentId: string;
  userId: string;
}) {
  const [state, revoke] = useActionState<AssignmentState, FormData>(
    revokeAssignmentAction,
    undefined,
  );

  return (
    <form action={revoke} className="inline">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton variant="ghost" pendingLabel="…">
        প্রত্যাহার
      </SubmitButton>
      {state?.error && (
        <span role="alert" className="ml-2 text-xs text-[var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
