import type { Metadata } from "next"
import { Cinzel } from "next/font/google"
import "./globals.css"

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Who Eats Whom",
  description: "An interactive ecological exhibit — NC State University",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body style={{ margin: 0, padding: 0, background: "#0E0A05", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  )
}