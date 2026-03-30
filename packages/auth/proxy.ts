import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function authMiddleware(next: () => Response | NextResponse) {
  return (_req: NextRequest) => next();
}
