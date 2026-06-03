import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://adflow.biz.ua"),

  title: {
    default: "AdFlow CRM — система керування рекламною агенцією",
    template: "%s | AdFlow CRM",
  },

  description:
    "AdFlow CRM — веб-система для керування рекламною агенцією: клієнти, брифи, проєкти, задачі, рекламні кампанії, матеріали, рахунки, оплати та статистика в одному кабінеті.",

  keywords: [
    "AdFlow CRM",
    "CRM система",
    "CRM для рекламної агенції",
    "рекламна агенція",
    "керування клієнтами",
    "брифи клієнтів",
    "керування проєктами",
    "задачі",
    "рекламні кампанії",
    "рахунки та оплати",
    "PostgreSQL",
    "Next.js",
    "курсова робота",
    "Попков Володимир",
  ],

  authors: [
    {
      name: "Попков Володимир",
    },
  ],

  creator: "Попков Володимир",
  publisher: "AdFlow CRM",
  applicationName: "AdFlow CRM",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "uk_UA",
    url: "/",
    siteName: "AdFlow CRM",
    title: "AdFlow CRM — система керування рекламною агенцією",
    description:
      "CRM-система для рекламної агенції: клієнти, брифи, проєкти, задачі, кампанії, матеріали, фінанси та статистика в одному веб-кабінеті.",
    images: [
      {
        url: "/seo/adflow-og.png",
        width: 1200,
        height: 630,
        alt: "AdFlow CRM — система керування рекламною агенцією",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "AdFlow CRM — система керування рекламною агенцією",
    description:
      "Веб-система для керування клієнтами, брифами, проєктами, задачами, кампаніями, матеріалами, рахунками та оплатами.",
    images: ["/seo/adflow-og.png"],
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/icon.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={nunito.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}