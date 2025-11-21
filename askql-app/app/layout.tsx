import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/chat-msg";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AskQL - Query Language System",
  description: "A powerful query language system built with Next.js and React",
  icons: {
    icon: [
      { url: "/askql_logo_16x16.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/askql_logo_32x32.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/askql_logo_48x48.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    apple: "/askql_logo_128x128.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
