import type { Metadata } from "next";
import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Discord CRM Dashboard",
  description: "Manage your Discord DM conversations and accounts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-background text-foreground`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
