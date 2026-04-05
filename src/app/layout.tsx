import type { Metadata } from "next";
import "./globals.css";
import AuthHeader from "@/components/AuthHeader";

export const metadata: Metadata = {
  title: {
    default: "Circle Sum Challenge",
    template: "%s | Circle Sum Challenge",
  },
  description:
    "A polished arcade-style math game built in Next.js with campaign and endless modes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthHeader />
        {children}
      </body>
    </html>
  );
}
