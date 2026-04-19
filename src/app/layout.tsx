import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zeitgeist Business Solutions - Multi-Industry Business Management",
  description: "Enterprise-grade business management for 8 industries: bakeries, salons, clinics, law firms, retail, events, insurance, and property management. Caribbean-built, world-class powered.",
  keywords: ["Zeitgeist", "Business Solutions", "Caribbean", "SaaS", "Bakery Management", "Salon Management", "ERP", "Point of Sale", "Inventory Management", "Trinidad", "Tobago"],
  authors: [{ name: "Zeitgeist Business Solutions" }],
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  metadataBase: new URL('https://zbs-jet.vercel.app'),
  openGraph: {
    title: "Zeitgeist Business Solutions - 8 Industries, One Platform",
    description: "The Caribbean's most complete multi-industry business management platform. Orders, invoices, inventory, appointments, and analytics — all in one place.",
    siteName: "Zeitgeist Business Solutions",
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Zeitgeist Business Solutions",
    description: "8 industries, one platform. Enterprise-grade business management built in the Caribbean.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
