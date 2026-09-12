"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { AuthWordmark } from "@/components/ui/Brand";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { Field } from "@/components/auth/Field";
import { LockIcon, MailIcon } from "@/components/ui/Icons";
import { PixelHeadline } from "@/components/ui/pixel-rocket-voyager";

/**
 * Log in — presentational for now.
 *
 * TODO (accounts, P1): call supabase.auth.signInWithPassword here, then run
 * the claim-on-sign-in update from src/lib/identity so runs made anonymously
 * in this browser are adopted. The starter template's working email-OTP form
 * is preserved at src/components/auth/OtpLoginForm.tsx.
 */
export default function LoginPage() {
  const router = useRouter();

  return (
    <AuthBackdrop>
      <AuthWordmark />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/");
        }}
        className="panel-8bit flex flex-col gap-5 p-7"
        style={{ "--panel-accent": "var(--color-magenta)" } as CSSProperties}
      >
        <PixelHeadline text="LOG IN" className="text-2xl" delay={0.15} />
        <Field icon={<MailIcon />} type="email" placeholder="EMAIL" autoComplete="email" required />
        <Field icon={<LockIcon />} type="password" placeholder="PASSWORD" autoComplete="current-password" required />
        <button type="submit" className="btn-pixel btn-8bit btn-pink mt-1 w-full">
          LOG IN
        </button>
        <Link
          href="/signup"
          className="text-pixel text-center text-[10px] tracking-wide text-[#a49ddd] transition hover:text-white"
        >
          CREATE A PROFILE
        </Link>
      </form>
    </AuthBackdrop>
  );
}
