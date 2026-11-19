import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/SiteHeader";
import { getConfig } from "@/lib/wagmi";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ride Co-op",
  description: "A driver-owned ride co-op with escrowed fares, member governance and on-chain reputation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialState = cookieToInitialState(getConfig(), (await headers()).get("cookie"));
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers initialState={initialState}>
          <SiteHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
