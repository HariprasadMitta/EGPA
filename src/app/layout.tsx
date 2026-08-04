import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { MlOpsProvider } from "@/lib/mlops";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EGPA - Enterprise Governance Platform for AI",
  description:
    "Submit an AI/agentic use case and get a governed, explainable architecture recommendation, then execute and monitor it from one centralized view.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider session={session}>
          <StoreProvider>
            <MlOpsProvider>
              <NavBar />
              <main className="flex-1">{children}</main>
            </MlOpsProvider>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
