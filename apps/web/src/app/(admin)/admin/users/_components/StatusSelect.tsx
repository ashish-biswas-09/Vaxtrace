"use client";

import { useActionState, useRef } from "react";
import { setUserStatusAction, type UserActionState } from "../_actions";
import { USER_STATUS } from "../_status";

// Same confirm-before-submit shape as RoleSelect. Deactivation revokes access across the
// whole system, so it must not be a stray click on a dropdown.
export function StatusSelect({
  userId,
  currentStatus,
  disabled,
}: {
  userId: string;
  currentStatus: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    setUserStatusAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="status"
        defaultValue={currentStatus}
        disabled={disabled || pending}
        aria-label="অ্যাকাউন্টের অবস্থা"
        onChange={(e) => {
          const next = e.target.value;
          const warning =
            next === "inactive"
              ? "এই ব্যবহারকারীর প্রবেশাধিকার বন্ধ করবেন? তিনি আর কোনো তথ্য দেখতে পাবেন না।"
              : `অবস্থা "${USER_STATUS[next]?.label ?? next}" করবেন?`;
          if (window.confirm(warning)) {
            formRef.current?.requestSubmit();
          } else {
            e.target.value = currentStatus;
          }
        }}
        className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm disabled:opacity-50"
      >
        {Object.entries(USER_STATUS).map(([value, { label }]) => (
          <option key={value} value={value} className="text-black">
            {label}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-[var(--color-muted)]">…</span>}
      {state?.error && <span className="text-xs text-[var(--color-danger)]">{state.error}</span>}
    </form>
  );
}
