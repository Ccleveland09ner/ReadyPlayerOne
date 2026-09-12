import { redirect } from "next/navigation";
import { AuthWordmark } from "@/components/ui/Brand";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { currentUser } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

/**
 * Create Profile.
 *
 * Server component so someone already signed in is sent to Home rather than
 * shown a form that would fail with "already registered".
 */
export default async function SignupPage() {
  if (await currentUser()) redirect("/");

  return (
    <AuthBackdrop>
      <AuthWordmark />
      <SignupForm />
    </AuthBackdrop>
  );
}
