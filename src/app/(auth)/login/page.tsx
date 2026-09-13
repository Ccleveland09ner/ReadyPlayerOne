import { redirect } from "next/navigation";
import { AuthWordmark } from "@/components/ui/Brand";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { currentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

/**
 * Log in.
 *
 * A server component so an already-signed-in visitor is sent to Home rather
 * than shown a form that would sign them in again. The form owns the client
 * boundary.
 */
export default async function LoginPage() {
  if (await currentUser()) redirect("/home");

  return (
    <AuthBackdrop>
      <AuthWordmark />
      <LoginForm />
    </AuthBackdrop>
  );
}
