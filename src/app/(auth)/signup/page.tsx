"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthWordmark } from "@/components/ui/Brand";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { Field } from "@/components/auth/Field";
import { LockIcon, MailIcon, Play, UserIcon } from "@/components/ui/Icons";

/**
 * Create Profile — presentational for now.
 *
 * TODO (accounts, P1): call supabase.auth.signUp, insert the profiles row,
 * then claim anonymous runs for this browser's anon_id.
 */
export default function SignupPage() {
  const router = useRouter();

  return (
    <AuthBackdrop>
      <AuthWordmark />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/");
        }}
        className="pixel-frame flex flex-col gap-4 p-7"
        style={{
          background: "rgba(18,14,46,0.9)",
          borderColor: "var(--color-magenta)",
          boxShadow: "0 0 0 3px #0f0b2e, 0 0 26px rgba(124,92,255,0.4)",
        }}
      >
        <h1 className="text-pixel text-xl text-white">CREATE YOUR PROFILE</h1>
        <Field icon={<UserIcon />} type="text" placeholder="FULL NAME" autoComplete="name" required />
        <Field icon={<MailIcon />} type="email" placeholder="EMAIL" autoComplete="email" required />
        <Field icon={<LockIcon />} type="password" placeholder="PASSWORD" autoComplete="new-password" required />
        <Field icon={<LockIcon />} type="password" placeholder="CONFIRM PASSWORD" autoComplete="new-password" required />
        <button type="submit" className="btn-pixel btn-pink mt-1 flex w-full items-center justify-center gap-2">
          CREATE PROFILE <Play className="text-xs" />
        </button>
        <p className="text-pixel text-center text-[9px] leading-relaxed text-[#a49ddd]">
          ALREADY HAVE AN ACCOUNT?{" "}
          <Link href="/login" className="text-[#ff4fa3] transition hover:text-white">
            LOG IN
          </Link>
        </p>
      </form>
    </AuthBackdrop>
  );
}
