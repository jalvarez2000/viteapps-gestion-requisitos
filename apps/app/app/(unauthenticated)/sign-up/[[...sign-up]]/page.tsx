import { redirect } from "next/navigation";

// Sign-up is disabled — admin accounts are created via the seed script.
export default function SignUpPage(): never {
  redirect("/sign-in");
}
