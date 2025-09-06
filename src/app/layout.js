import { IBM_Plex_Sans_Thai, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["latin", "thai"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// app/layout.tsx (หรือ .jsx ก็ได้)
export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "LostnFound",
    template: "%s | บอร์ดของหาย/พบของชุมชน",
  },
  description:
    "แพลตฟอร์มชุมชนสำหรับแจ้งพบของ ค้นหาของหาย และพูดคุยแบบเรียลไทม์ ช่วยให้ของกลับคืนสู่เจ้าของได้เร็วขึ้น",
  applicationName: "Lost & Found",
  authors: [{ name: "Lost & Found Team" }],
  keywords: [
    "ของหาย",
    "พบของ",
    "ตามหาของหาย",
    "ประกาศของหาย",
    "Lost and Found",
    "ชลบุรี",
    "บางแสน",
  ],
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: "/",
    siteName: "บอร์ดของหาย/พบของชุมชน",
    title: "หาเจอไว คืนเจ้าของไว — บอร์ดของหาย/พบของชุมชน",
    description:
      "แจ้งพบของ ค้นหาของหาย และติดต่อกันได้ทันทีบนบอร์ดของหาย/พบของชุมชน",
    images: [
      {
        url: "/lost.jpg", // ใช้ภาพ hero ของคุณ
        width: 1200,
        height: 630,
        alt: "บอร์ดของหาย/พบของชุมชน",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "หาเจอไว คืนเจ้าของไว — บอร์ดของหาย/พบของชุมชน",
    description:
      "แจ้งพบของ ค้นหาของหาย และติดต่อกันได้ทันทีบนบอร์ดของหาย/พบของชุมชน",
    images: ["/lost.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  category: "community",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B3C8A" },
    { media: "(prefers-color-scheme: dark)", color: "#0B3C8A" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className={`${ibmPlexSansThai.variable} ${geistMono.variable} antialiased`}
      >
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
