import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ConnectButton } from "@/components/ConnectButton";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ride Co-op",
  description: "A driver-owned ride co-op with escrowed fares, member governance and on-chain reputation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          <header>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/rider">Rider</Link>
              <Link href="/driver">Driver</Link>
              <Link href="/governance">Governance</Link>
            </nav>
            <ConnectButton />
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
