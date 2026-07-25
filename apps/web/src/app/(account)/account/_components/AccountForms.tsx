"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  changeEmailAction,
  changePasswordAction,
  updateProfileAction,
  uploadAvatarAction,
  deleteAvatarAction,
  type ActionState,
} from "../_actions";

// One place for the success/error line so every form on this page reports the same way.
function Result({ state, pending }: { state: ActionState; pending: boolean }) {
  if (pending) return <span className="text-xs text-[var(--color-muted)]">সংরক্ষণ হচ্ছে…</span>;
  if (state?.error)
    return (
      <span role="alert" className="text-xs text-[var(--color-danger)]">
        {state.error}
      </span>
    );
  if (state?.ok)
    return (
      <span role="status" className="text-xs text-[var(--color-success)]">
        {state.ok}
      </span>
    );
  return null;
}

function Save({ pending, label = "সংরক্ষণ" }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
    >
      {label}
    </button>
  );
}

const field =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";

export function ProfileForm({
  fullName,
  contact,
  address,
  locale,
}: {
  fullName: string;
  contact: string;
  address: string;
  locale: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">
          পূর্ণ নাম
          <input name="full_name" defaultValue={fullName} maxLength={120} required className={field} />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          ফোন নম্বর বা যোগাযোগ
          <input
            name="contact"
            defaultValue={contact}
            maxLength={120}
            inputMode="tel"
            placeholder="+8801XXXXXXXXX"
            className={field}
          />
        </label>
        <label className="text-xs text-[var(--color-muted)] sm:col-span-2">
          ঠিকানা
          <textarea name="address" defaultValue={address} maxLength={300} rows={2} className={field} />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          ভাষা
          <select name="locale" defaultValue={locale} className={field}>
            <option value="bn" className="text-black">
              বাংলা
            </option>
            <option value="en" className="text-black">
              English
            </option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Save pending={pending} />
        <Result state={state} pending={pending} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the change lands — leaving a password sitting in the DOM on a
  // shared clinic machine is the whole reason re-auth exists.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="text-xs text-[var(--color-muted)]">
          বর্তমান পাসওয়ার্ড
          <input
            type="password"
            name="current_password"
            autoComplete="current-password"
            required
            className={field}
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          নতুন পাসওয়ার্ড
          <input
            type="password"
            name="new_password"
            autoComplete="new-password"
            minLength={8}
            required
            className={field}
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          নতুন পাসওয়ার্ড (পুনরায়)
          <input
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            minLength={8}
            required
            className={field}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Save pending={pending} label="পাসওয়ার্ড পরিবর্তন" />
        <Result state={state} pending={pending} />
      </div>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changeEmailAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="text-xs text-[var(--color-muted)] sm:max-w-sm">
        ইমেইল ঠিকানা
        <input type="email" name="email" defaultValue={email} required className={field} />
      </label>
      <div className="flex items-center gap-3">
        <Save pending={pending} label="ইমেইল পরিবর্তন" />
        <Result state={state} pending={pending} />
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        নতুন ঠিকানায় নিশ্চিতকরণ লিংক না খোলা পর্যন্ত পুরনো ইমেইলই সক্রিয় থাকে।
      </p>
    </form>
  );
}

export function AvatarForm({
  avatarUrl,
  initial,
}: {
  avatarUrl: string | null;
  initial: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadAvatarAction,
    undefined,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-6">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt="প্রোফাইল ছবি"
          width={80}
          height={80}
          unoptimized
          className="h-20 w-20 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)] text-2xl font-medium text-[var(--color-primary-fg)]">
          {initial}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            aria-label="প্রোফাইল ছবি নির্বাচন"
            className="text-xs text-[var(--color-muted)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border)] file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:text-[var(--color-fg)]"
          />
          <Save pending={pending} label={avatarUrl ? "ছবি পরিবর্তন" : "ছবি আপলোড"} />
        </form>

        {avatarUrl && (
          <form
            action={deleteAvatarAction}
            onSubmit={(e) => {
              if (!window.confirm("প্রোফাইল ছবি মুছে ফেলবেন?")) e.preventDefault();
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-xs text-[var(--color-danger)]"
            >
              ছবি মুছুন
            </button>
          </form>
        )}

        <div className="flex items-center gap-3">
          {fileName && !pending && !state && (
            <span className="text-xs text-[var(--color-muted)]">{fileName}</span>
          )}
          <Result state={state} pending={pending} />
        </div>
        <p className="text-xs text-[var(--color-muted)]">JPEG, PNG বা WebP — সর্বোচ্চ ২ মেগাবাইট।</p>
      </div>
    </div>
  );
}
