import { database } from "@repo/database";

export const GET = async () => {
  // Simple keep-alive ping — queries the simplest available table
  await database.$queryRaw`SELECT 1`;
  return new Response("OK", { status: 200 });
};
