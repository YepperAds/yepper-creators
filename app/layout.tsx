export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Bold display font for big headlines (homepage hero, dashboard section titles).
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Yepper",
    default: "Yepper",
  },
  description: "Yepper. Everything you need, in one place.",
  // Plain static file under /public, not the app/icon.png convention;
  // Vercel's build adapter mishandles the synthetic route Next generates
  // for that convention (tries to lstat it as a route folder and fails
  // with ENOTDIR). Referencing a public/ file explicitly sidesteps that
  // entirely since it's served as a static asset, no route generated.
  icons: {
    icon: "/icon.png",
  },
};

import BackendWarmup from "@/app/_components/BackendWarmup";
import QueryProviders from "@/app/(adsense)/providers";
import { ThemeProvider, ThemeScript } from "@/app/_components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col font-(--font-inter)">
        <ThemeProvider>
          <QueryProviders>
            <BackendWarmup />
            {children}
          </QueryProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
