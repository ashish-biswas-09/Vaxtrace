"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setRoleAction, type RoleActionState } from "../_actions";

const ROLES = [
  { value: "parent", label: "অভিভাবক" },
  { value: "worker", label: "স্বাস্থ্যকর্মী" },
  { value: "admin", label: "অ্যাডমিন" },
];

// Granting admin is a privilege escalation, and it used to be gated by window.confirm — an
// unstyled browser dialog with no room to state what the change actually does and nowhere to
// record why it was made. The themed dialog has both, and asking for a reason on an
// escalation turns an unexplained promotion in the audit trail into an accountable one.
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
  const selectRef = useRef<HTMLSelectElement>(null);
  const [target, setTarget] = useState<string | null>(null);

  const label = ROLES.find((r) => r.value === target)?.label ?? target;
  const escalating = target === "admin";

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        ref={selectRef}
        name="role"
        defaultValue={currentRole}
        disabled={disabled || pending}
        aria-label="ভূমিকা"
        onChange={(e) => setTarget(e.target.value)}
        className="h-9 rounded-[var(--r-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <ConfirmDialog
        open={target !== null}
        title="ভূমিকা পরিবর্তন"
        body={
          escalating
            ? "এই ব্যবহারকারীকে অ্যাডমিন করবেন? একজন অ্যাডমিন প্রতিটি শিশুর রেকর্ড ও মজুদ দেখতে এবং অন্য ব্যবহারকারীর ভূমিকা বদলাতে পারেন।"
            : `এই ব্যবহারকারীর ভূমিকা "${label}" করবেন?`
        }
        confirmLabel="পরিবর্তন করুন"
        tone={escalating ? "danger" : "primary"}
        requireReason={escalating}
        // Cancelling has to put the dropdown back, or the screen shows a role that was never
        // saved and the next reader believes it.
        onCancel={() => {
          if (selectRef.current) selectRef.current.value = currentRole;
          setTarget(null);
        }}
        onConfirm={(reason) => {
          setTarget(null);
          if (reason && formRef.current) {
            const field = document.createElement("input");
            field.type = "hidden";
            field.name = "reason";
            field.value = reason;
            formRef.current.append(field);
          }
          formRef.current?.requestSubmit();
        }}
      />

      {pending && <span className="text-xs text-[var(--text-muted)]">…</span>}
      {state?.ok && !pending && <span className="text-xs text-[var(--success)]">✓</span>}
      {state?.error && <span className="text-xs text-[var(--danger)]">{state.error}</span>}
    </form>
  );
}
