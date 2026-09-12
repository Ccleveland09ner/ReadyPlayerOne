"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthWordmark } from "@/components/ui/Brand";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { Field } from "@/components/auth/Field";
import { LockIcon, MailIcon } from "@/components/ui/Icons";

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
        className="pixel-frame flex flex-col gap-5 p-7"
        style={{
          background: "rgba(18,14,46,0.9)",
          borderColor: "var(--color-grape)",
          boxShadow: "0 0 0 3px #0f0b2e, 0 0 26px rgba(255,63,164,0.35)",
        }}
      >
        <h1 className="text-pixel text-2xl text-white">LOG IN</h1>
        <Field icon={<MailIcon />} type="email" placeholder="EMAIL" autoComplete="email" required />
        <Field icon={<LockIcon />} type="password" placeholder="PASSWORD" autoComplete="current-password" required />
        <button type="submit" className="btn-pixel btn-pink mt-1 w-full">
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
