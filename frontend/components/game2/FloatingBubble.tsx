"use client"

import { useEffect, useRef } from "react"
import { motion, useAnimationControls } from "framer-motion"

export interface BubbleSpecies {
  scientific_name: string
  common_name: string
  thumbnail_url: string
  is_prey: boolean
}

interface FloatingBubbleProps {
  species: BubbleSpecies
  initialX: number
  initialY: number
  size?: number
  onDragStart: (species: BubbleSpecies, el: HTMLElement, pointerId: number) => void
  onKeyboardFeed: (species: BubbleSpecies) => void
  spit?: boolean
  onSpitDone?: () => void
}

function getFloatAnim(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return {
    x: 8 + (Math.abs(hash) % 14),
    y: 6 + (Math.abs(hash >> 4) % 10),
    duration: 5 + (Math.abs(hash >> 8) % 4),
    delay: (Math.abs(hash >> 12) % 30) * 0.15,
    rotate: (Math.abs(hash >> 16) % 3) - 1.5,
  }
}

export default function FloatingBubble({
  species, initialX, initialY, size = 96,
  onDragStart, onKeyboardFeed, spit = false, onSpitDone,
}: FloatingBubbleProps) {
  const controls = useAnimationControls()
  const ref = useRef<HTMLDivElement>(null)
  const f = getFloatAnim(species.scientific_name)

  const startFloat = () => {
    controls.start({
      x: [0, f.x, -f.x * 0.5, f.x * 0.3, 0],
      y: [0, -f.y, f.y * 0.6, -f.y * 0.3, 0],
      rotate: [f.rotate, f.rotate + 1.5, f.rotate - 1, f.rotate + 0.5, f.rotate],
      transition: { duration: f.duration, delay: f.delay, repeat: Infinity, ease: "easeInOut" },
    })
  }

  useEffect(() => { startFloat() }, [])

  useEffect(() => {
    if (!spit) return
    controls.start({
      x: [null, 0], y: [null, 0],
      scale: [1.2, 0.75, 1.05, 1],
      rotate: [null, f.rotate],
      transition: { duration: 0.55, ease: "backOut" },
    }).then(() => {
      onSpitDone?.()
      startFloat()
    })
  }, [spit])

  return (
    <motion.div
      ref={ref}
      animate={controls}
      style={{
        position: "absolute",
        left: initialX - size / 2,
        top: initialY - size / 2,
        width: size,
        cursor: "grab",
        touchAction: "none",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${species.common_name} — press Enter to feed to heron`}
      whileHover={{ scale: 1.07, rotate: f.rotate + 2 }}
      whileTap={{ scale: 0.96 }}
      onPointerDown={(e) => {
        e.preventDefault()
        if (ref.current) onDragStart(species, ref.current, e.pointerId)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onKeyboardFeed(species) }
      }}
    >
      {/* SVG image */}
      <img
        src={species.thumbnail_url}
        alt={species.common_name}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(2px 3px 6px rgba(60,40,10,0.25))",
          pointerEvents: "none",
        }}
      />
      {/* Parchment name tag */}
      <div style={{
        background: "rgba(244,237,211,0.90)",
        borderRadius: 8,
        padding: "2px 8px",
        fontFamily: "var(--font-playfair), serif",
        fontStyle: "italic",
        fontSize: 9,
        color: "rgba(44,24,16,0.78)",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        {species.common_name}
      </div>
    </motion.div>
  )
}
