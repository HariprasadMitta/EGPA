import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  title: "Momentum AI CV - Centralized View",
  description:
    "Submit an AI/agentic use case and get a governed, explainable architecture recommendation, then execute and monitor it from one centralized view.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
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
