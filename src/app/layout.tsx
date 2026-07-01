import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { Providers } from "@/components/providers";
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
  title: "Kasulu Fleet Reporting",
  description:
    "Fleet operations, compliance, fuel efficiency, and driver safety analytics",
  icons: {
    icon: [{ url: "/logo.jpg", type: "image/jpeg" }],
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
