import type { Metadata } from "next"
import { Cinzel, Mansalva, Playfair_Display } from "next/font/google"
import "./globals.css"
import type { Viewport } from "next"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel-actual",
  display: "swap",
})

const mansalva = Mansalva({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mansalva",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
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
    <html
      lang="en"
      className={`${cinzel.variable} ${mansalva.variable} ${playfair.variable}`}
    >
      <body style={{ margin: 0, padding: 0, overflow: "hidden", background: "#0E0A05" }}>
        <head>
  <script dangerouslySetInnerHTML={{__html: `
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', function(e) { if(e.touches.length > 1) e.preventDefault(); }, { passive: false });
  `}} />
</head>
        {/* Global SVG filter definitions for watercolor wobbly edges */}
        <svg
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>
            <filter id="watercolor-edge" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.035"
                numOctaves="4"
                seed="2"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="10"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            <filter id="ink-wash" x="-12%" y="-12%" width="124%" height="124%">
              <feTurbulence
                type="turbulence"
                baseFrequency="0.02"
                numOctaves="3"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="6"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            <filter id="specimen-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="2"
                dy="3"
                stdDeviation="6"
                floodColor="rgba(60,40,10,0.28)"
              />
            </filter>
            <marker
              id="wc-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0,0.5 L7,4 L0,7.5 Z" fill="#8B6B55" opacity="0.8" />
            </marker>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  )
}
