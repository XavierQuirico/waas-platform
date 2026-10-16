import { redirect } from "next/navigation";

/**
 * /sign-in is a technical Clerk route kept for OAuth callbacks only.
 * Human-facing login lives at /acceder. Redirect anyone who lands here directly.
 */
export default function SignInPage() {
  redirect("/acceder");
}
