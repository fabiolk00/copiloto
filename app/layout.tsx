import type { Metadata } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Footer from "@/components/site/Footer";
import { SEO_DESCRIPTION_HOME, SEO_TITLE_HOME, siteOrigin } from "@/lib/seo";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: SEO_TITLE_HOME,
  description: SEO_DESCRIPTION_HOME,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${newsreader.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
