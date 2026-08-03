import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16 renamed middleware.ts -> proxy.ts and the exported function
// must be named "proxy" (see node_modules/next/dist/docs/.../version-16.md).
//
// Phase 3 (real database): the whole use-case workflow now requires
// sign-in, not just /execution and /mlops - once data is real and shared
// (not per-browser sessionStorage), anonymous create/view access is a real
// gap, not a demo nicety. /guide and /registry stay public (static
// reference content, not use-case data).
const PROTECTED_PREFIXES = [
  "/execution",
  "/mlops",
  "/intake",
  "/recommendation",
  "/gate",
  "/adr",
  "/portfolio",
  "/admin",
  "/governance",
  "/inbox",
];

export const proxy = auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/execution/:path*",
    "/mlops/:path*",
    "/intake/:path*",
    "/recommendation/:path*",
    "/gate/:path*",
    "/adr/:path*",
    "/portfolio/:path*",
    "/admin/:path*",
    "/governance/:path*",
    "/inbox/:path*",
  ],
};
