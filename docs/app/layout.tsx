import localFont from "next/font/local"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { StructuredData } from "@/components/structured-data"
import { organization, siteUrl } from "@/lib/seo"
import { HOME_TITLE, SITE_DESCRIPTION, SITE_ORIGIN } from "@/lib/seo"

const manrope = localFont({
  src: "../public/brand/fonts/Manrope-wght.ttf",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
})

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: HOME_TITLE,
    template: "%s | Dhivon Cadre",
  },
  description: SITE_DESCRIPTION,
  icons: { apple: siteUrl("/brand/apple-touch-icon.png") },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} font-sans antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <StructuredData data={organization} />
        {children}
      </body>
    </html>
  )
}
