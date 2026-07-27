"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setUserStatusAction, type UserActionState } from "../_actions";
import { USER_STATUS } from "../_status";

// Same shape as RoleSelect. Deactivation revokes access across the whole system — the access
// token hook returns NULL for anything but 'active', so every role-based RLS policy denies a
// suspended account — so it must not be a stray click on a dropdown.
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
  const selectRef = useRef<HTMLSelectElement>(null);
  const [target, setTarget] = useState<string | null>(null);

  const deactivating = target === "inactive";

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        ref={selectRef}
        name="status"
        defaultValue={currentStatus}
        disabled={disabled || pending}
        aria-label="অ্যাকাউন্টের অবস্থা"
        onChange={(e) => setTarget(e.target.value)}
        className="h-9 rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm disabled:opacity-50"
      >
        {Object.entries(USER_STATUS).map(([value, { label }]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <ConfirmDialog
        open={target !== null}
        title="অ্যাকাউন্টের অবস্থা পরিবর্তন"
        body={
          deactivating
            ? "এই ব্যবহারকারীর প্রবেশাধিকার বন্ধ করবেন? তিনি আর কোনো তথ্য দেখতে পাবেন না — চলমান সেশনসহ।"
            : `অবস্থা "${(target && USER_STATUS[target]?.label) ?? target}" করবেন?`
        }
        confirmLabel="পরিবর্তন করুন"
        tone={deactivating ? "danger" : "primary"}
        // Cancelling has to put the dropdown back, or the screen shows a status that was
        // never saved and the next reader believes it.
        onCancel={() => {
          if (selectRef.current) selectRef.current.value = currentStatus;
          setTarget(null);
        }}
        onConfirm={() => {
          setTarget(null);
          formRef.current?.requestSubmit();
        }}
      />

      {pending && <span className="text-xs text-[var(--text-muted)]">…</span>}
      {state?.error && <span className="text-xs text-[var(--danger)]">{state.error}</span>}
    </form>
  );
}
