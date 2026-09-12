"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { CSSProperties } from "react";
import { Field } from "@/components/auth/Field";
import { LockIcon, MailIcon } from "@/components/ui/Icons";
import { PixelHeadline } from "@/components/ui/pixel-rocket-voyager";
import { signInAction, type AuthState } from "@/lib/auth/actions";

/**
 * The log in form.
 *
 * Submits to a server action rather than calling Supabase from the browser:
 * the same action also claims this browser's anonymous runs, and that write
 * needs the service role. `useFormStatus` disables the button while the action
 * is in flight, which is what stops a double submit creating two sign-ins.
 */
export function LoginForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(signInAction, {});

  return (
    <form
      action={formAction}
      className="panel-8bit flex flex-col gap-5 p-7"
      style={{ "--panel-accent": "var(--color-magenta)" } as CSSProperties}
    >
      <PixelHeadline text="LOG IN" className="text-2xl" delay={0.15} />

      <Field
        icon={<MailIcon />}
        name="email"
        type="email"
        placeholder="EMAIL"
        autoComplete="email"
        required
      />
      <Field
        icon={<LockIcon />}
        name="password"
        type="password"
        placeholder="PASSWORD"
        autoComplete="current-password"
        required
      />

      {state.error ? <AuthMessage tone="error">{state.error}</AuthMessage> : null}

      <SubmitButton idle="LOG IN" busy="LOGGING IN…" />

      <Link
        href="/signup"
        className="text-pixel text-center text-[10px] tracking-wide text-[#a49ddd] transition hover:text-white"
      >
        CREATE A PROFILE
      </Link>
    </form>
  );
}

/**
 * Shared by both auth forms.
 *
 * Must be a child of the form, not a sibling: useFormStatus reads the pending
 * state of the form above it in the tree.
 */
export function SubmitButton({
  idle,
  busy,
  icon,
}: {
  idle: string;
  busy: string;
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-pixel btn-8bit btn-pink mt-1 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : idle}
      {pending ? null : icon}
    </button>
  );
}

export function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: React.ReactNode;
}) {
  const color = tone === "error" ? "#ff5470" : "#4ade80";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className="chip-8bit text-pixel px-3 py-2 text-[9px] leading-relaxed tracking-wide"
      style={{ color, "--chip-edge": color } as CSSProperties}
    >
      {children}
    </p>
  );
}
