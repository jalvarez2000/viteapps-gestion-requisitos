import "server-only";

import { redirect } from "next/navigation";
import { getAdminSession } from "./session";

export async function auth() {
  const session = await getAdminSession();
  return {
    userId: session?.userId ?? null,
    redirectToSignIn: () => {
      redirect("/sign-in");
    },
  };
}

export async function currentUser() {
  const session = await getAdminSession();
  if (!session) {
    return null;
  }
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
  };
}

export { createAdminSession, deleteAdminSession, getAdminSession } from "./session";
