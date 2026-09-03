import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Central IAM | Window Asia Public Company Limited",
  description: "Centralized Identity & Access Management Governance System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 bg-grid-pattern antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 Window Asia Public Company Limited. All rights reserved.</p>
            <p className="flex items-center space-x-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>ISO 27001 & PDPA Governance Compliant</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
