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
  onDragStart: (species: BubbleSpecies, el: HTMLElement) => void
  spit?: boolean
  onSpitDone?: () => void
}

function getFloatAnim(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return {
    x: 10 + (Math.abs(hash) % 18),
    y: 8  + (Math.abs(hash >> 4) % 14),
    duration: 5 + (Math.abs(hash >> 8) % 4),   // slower: 5-9s
    delay: (Math.abs(hash >> 12) % 30) * 0.15,
  }
}

export default function FloatingBubble({
  species, initialX, initialY, size = 96,
  onDragStart, spit = false, onSpitDone,
}: FloatingBubbleProps) {
  const controls = useAnimationControls()
  const ref = useRef<HTMLDivElement>(null)
  const f = getFloatAnim(species.scientific_name)

  const startFloat = () => {
    controls.start({
      x: [0, f.x, -f.x * 0.5, f.x * 0.3, 0],
      y: [0, -f.y, f.y * 0.6, -f.y * 0.3, 0],
      rotate: [0, 2, -1.5, 1, 0],
      transition: { duration: f.duration, delay: f.delay, repeat: Infinity, ease: "easeInOut" },
    })
  }

  useEffect(() => { startFloat() }, [])

  useEffect(() => {
    if (!spit) return
    controls.start({
      x: [null, 0], y: [null, 0],
      scale: [1.3, 0.7, 1.1, 1],
      rotate: [null, 0],
      transition: { duration: 0.6, ease: "backOut" },
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
        height: size + 30,
        cursor: "grab",
        touchAction: "none",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.95 }}
      onPointerDown={(e) => {
        e.preventDefault()
        if (ref.current) onDragStart(species, ref.current)
      }}
    >
      {/* Bubble */}
      <div style={{ position: "relative", width: size, height: size }}>
        {/* Subtle outer glow — neutral, no color hint */}
        <div style={{
          position: "absolute", inset: -3, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.18)",
          boxShadow: "0 0 14px rgba(255,255,255,0.06)",
        }} />

        {/* Main circle */}
        <div style={{
          width: size, height: size, borderRadius: "50%",
          overflow: "hidden",
          background: "radial-gradient(circle at 35% 30%, #2A4A6A, #0A1525)",
          border: "2px solid rgba(255,255,255,0.22)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
          position: "relative",
        }}>
          {species.thumbnail_url && (
            <img src={species.thumbnail_url} alt={species.common_name}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.88, pointerEvents: "none" }}
            />
          )}
          {/* Shine */}
          <div style={{
            position: "absolute", top: 7, left: 12, width: 22, height: 14,
            borderRadius: "50%", background: "rgba(255,255,255,0.18)", transform: "rotate(-25deg)",
          }} />
        </div>
      </div>

      {/* Label */}
      <div style={{
        fontFamily: "system-ui, sans-serif", fontWeight: 800,
        fontSize: 11, color: "white",
        textAlign: "center",
        textShadow: "0 2px 6px rgba(0,0,0,0.9)",
        letterSpacing: "0.02em",
        maxWidth: size + 16,
        lineHeight: 1.2,
        pointerEvents: "none",
      }}>
        {species.common_name}
      </div>
    </motion.div>
  )
}