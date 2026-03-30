import { SignIn } from "@repo/auth/components/sign-in";
import type { Metadata } from "next";
import { signInAction } from "../actions";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede a la gestión de requisitos.",
};

const SignInPage = () => <SignIn action={signInAction} />;

export default SignInPage;
