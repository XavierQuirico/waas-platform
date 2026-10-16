import { redirect } from "next/navigation";

/**
 * /sign-up redirects to the intake wizard — public sign-up is not self-serve;
 * new clients start via /empezar (curated intake process).
 */
export default function SignUpPage() {
  redirect("/empezar");
}
