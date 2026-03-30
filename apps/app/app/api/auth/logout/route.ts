import { deleteAdminSession } from "@repo/auth/session";

export async function POST() {
  await deleteAdminSession();
  return new Response(null, { status: 200 });
}
