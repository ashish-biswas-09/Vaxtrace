"use client";

import { useActionState, useRef } from "react";
import { setRoleAction, type RoleActionState } from "../_actions";

const ROLES = [
  { value: "parent", label: "অভিভাবক" },
  { value: "worker", label: "স্বাস্থ্যকর্মী" },
  { value: "admin", label: "অ্যাডমিন" },
];

export function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<RoleActionState, FormData>(
    setRoleAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value} className="text-black">
            {r.label}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-[var(--color-muted)]">…</span>}
      {state?.ok && !pending && <span className="text-xs text-[var(--color-success)]">✓</span>}
      {state?.error && <span className="text-xs text-[var(--color-danger)]">{state.error}</span>}
    </form>
  );
}
