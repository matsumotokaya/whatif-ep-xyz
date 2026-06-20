import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { ConditionalFooter } from "@/components/ConditionalFooter";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://whatif-ep.xyz";

const DEFAULT_OG_IMAGE = `${SITE_URL}/img/artwork_falling/12_bg.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WHATIF Gallery",
    template: "%s | WHATIF Gallery",
  },
  description: "WHATIF EP - Digital Art Gallery",
  keywords: [
    "WHATIF",
    "WHATIF EP",
    "digital art",
    "art gallery",
    "illustration",
    "wallpaper",
    "IMAGINE",
  ],
  openGraph: {
    title: "WHATIF Gallery",
    description: "WHATIF EP - Digital Art Gallery",
    type: "website",
    siteName: "WHATIF Gallery",
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "WHATIF Gallery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WHATIF Gallery",
    description: "WHATIF EP - Digital Art Gallery",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "WHATIF Gallery",
              url: SITE_URL,
              logo: DEFAULT_OG_IMAGE,
            }),
          }}
        />
        <GoogleAnalytics />
        <LanguageProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1 flex min-h-0 flex-col pt-14">{children}</main>
            <ConditionalFooter />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
