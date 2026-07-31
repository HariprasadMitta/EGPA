import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16 renamed middleware.ts -> proxy.ts and the exported function
// must be named "proxy" (see node_modules/next/dist/docs/.../version-16.md).
// Scope matches exactly what already hard-required sign-in client-side
// before this phase (/execution, /mlops) - not a new/wider policy.
const PROTECTED_PREFIXES = ["/execution", "/mlops"];

export const proxy = auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/execution/:path*", "/mlops/:path*"],
};
