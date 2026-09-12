"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { AuthWordmark } from "@/components/ui/Brand";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { Field } from "@/components/auth/Field";
import { LockIcon, MailIcon, Play, UserIcon } from "@/components/ui/Icons";
import { PixelHeadline } from "@/components/ui/pixel-rocket-voyager";

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
        className="panel-8bit flex flex-col gap-4 p-7"
        style={{ "--panel-accent": "var(--color-grape)" } as CSSProperties}
      >
        <PixelHeadline
          text="CREATE YOUR PROFILE"
          className="text-xl"
          delay={0.15}
        />
        <Field icon={<UserIcon />} type="text" placeholder="FULL NAME" autoComplete="name" required />
        <Field icon={<MailIcon />} type="email" placeholder="EMAIL" autoComplete="email" required />
        <Field icon={<LockIcon />} type="password" placeholder="PASSWORD" autoComplete="new-password" required />
        <Field icon={<LockIcon />} type="password" placeholder="CONFIRM PASSWORD" autoComplete="new-password" required />
        <button type="submit" className="btn-pixel btn-8bit btn-pink mt-1 flex w-full items-center justify-center gap-2">
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
