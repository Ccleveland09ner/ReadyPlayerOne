"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CSSProperties } from "react";
import { Field } from "@/components/auth/Field";
import { LockIcon, MailIcon, Play, UserIcon } from "@/components/ui/Icons";
import { PixelHeadline } from "@/components/ui/pixel-rocket-voyager";
import { AuthMessage, SubmitButton } from "@/app/(auth)/login/login-form";
import { signUpAction, type AuthState } from "@/lib/auth/actions";

/**
 * Create profile.
 *
 * Whether this ends in a session or an email depends on the project's
 * confirmation setting, so the action returns a notice in the second case and
 * the form shows it instead of pretending the visitor is signed in.
 */
export function SignupForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(signUpAction, {});

  return (
    <form
      action={formAction}
      className="panel-8bit flex flex-col gap-4 p-7"
      style={{ "--panel-accent": "var(--color-grape)" } as CSSProperties}
    >
      <PixelHeadline text="CREATE YOUR PROFILE" className="text-xl" delay={0.15} />

      <Field
        icon={<UserIcon />}
        name="fullName"
        type="text"
        placeholder="FULL NAME"
        autoComplete="name"
        required
      />
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
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Field
        icon={<LockIcon />}
        name="confirmPassword"
        type="password"
        placeholder="CONFIRM PASSWORD"
        autoComplete="new-password"
        minLength={8}
        required
      />

      {state.error ? <AuthMessage tone="error">{state.error}</AuthMessage> : null}
      {state.notice ? <AuthMessage tone="notice">{state.notice}</AuthMessage> : null}

      <SubmitButton
        idle="CREATE PROFILE"
        busy="CREATING…"
        icon={<Play className="text-xs" />}
      />

      <p className="text-pixel text-center text-[9px] leading-relaxed text-[#a49ddd]">
        ALREADY HAVE AN ACCOUNT?{" "}
        <Link href="/login" className="text-[#ff4fa3] transition hover:text-white">
          LOG IN
        </Link>
      </p>
    </form>
  );
}
