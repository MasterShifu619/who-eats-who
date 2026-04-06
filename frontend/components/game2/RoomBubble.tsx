"use client"

import { useEffect, useRef } from "react"
import { motion, useAnimationControls } from "framer-motion"
import type { BubbleSpecies } from "./FloatingBubble"

interface RoomBubbleProps {
  species: BubbleSpecies
  initialX: number
  initialY: number
  roomW: number
  roomH: number
  size?: number
  eaten?: boolean
  held?: boolean
  heldX?: number
  heldY?: number
  onDragStart: (species: BubbleSpecies, el: HTMLElement) => void
}

function getVelocity(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return {
    vx: ((Math.abs(h) % 60) + 20) * (h % 2 === 0 ? 1 : -1) * 0.08,
    vy: ((Math.abs(h >> 4) % 50) + 15) * ((h >> 2) % 2 === 0 ? 1 : -1) * 0.08,
  }
}

export default function RoomBubble({
  species, initialX, initialY, roomW, roomH,
  size = 88, eaten = false, held = false,
  heldX, heldY, onDragStart,
}: RoomBubbleProps) {
  const ref = useRef<HTMLDivElement>(null)
  const controls = useAnimationControls()
  const posRef = useRef({ x: initialX, y: initialY })
  const velRef = useRef(getVelocity(species.scientific_name))
  const frameRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const dragPosRef = useRef({ x: initialX, y: initialY })

  const startPhysics = () => {
    const loop = () => {
      if (isDraggingRef.current || held || eaten) return
      let { x, y } = posRef.current
      let { vx, vy } = velRef.current
      x += vx; y += vy
      if (x <= size / 2) { x = size / 2; vx = Math.abs(vx) }
      if (x >= roomW - size / 2) { x = roomW - size / 2; vx = -Math.abs(vx) }
      if (y <= size / 2) { y = size / 2; vy = Math.abs(vy) }
      if (y >= roomH - size / 2 - 28) { y = roomH - size / 2 - 28; vy = -Math.abs(vy) }
      posRef.current = { x, y }
      velRef.current = { vx, vy }
      controls.set({ x: x - initialX, y: y - initialY })
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    startPhysics()
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [held, eaten])

  // Release from tongue — push gently away
  useEffect(() => {
    if (!held && heldX !== undefined && heldY !== undefined) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      posRef.current = { x: heldX, y: heldY }
      velRef.current = {
        vx: heldX > roomW / 2 ? -0.4 : 0.4,
        vy: heldY < roomH / 2 ? 0.4 : -0.4,
      }
      startPhysics()
    }
  }, [held])

  if (eaten) return null

  const handlePointerDown = (e: React.PointerEvent) => {
    if (held || eaten) return
    e.preventDefault()
    isDraggingRef.current = true
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    // Capture initial offset so bubble doesn't jump
    const startX = e.clientX
    const startY = e.clientY
    const startBubbleX = posRef.current.x
    const startBubbleY = posRef.current.y

    dragPosRef.current = { x: startBubbleX, y: startBubbleY }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const newX = startBubbleX + dx
      const newY = startBubbleY + dy
      dragPosRef.current = { x: newX, y: newY }
      posRef.current = { x: newX, y: newY }
      controls.set({ x: newX - initialX, y: newY - initialY })
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      isDraggingRef.current = false
      // Resume physics from where we dropped
      velRef.current = { vx: 0.1, vy: 0.1 }
      startPhysics()
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)

    // Notify parent for proximity detection
    if (ref.current) onDragStart(species, ref.current)
  }

  return (
    <motion.div
      ref={ref}
      animate={controls}
      style={{
        position: "absolute",
        left: initialX - size / 2,
        top: initialY - size / 2,
        width: size,
        height: size + 28,
        cursor: held ? "default" : "grab",
        touchAction: "none",
        zIndex: held ? 30 : 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        pointerEvents: held || eaten ? "none" : "auto",
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Bubble circle */}
      <div style={{ position: "relative", width: size, height: size }}>
        <div style={{
          width: size, height: size, borderRadius: "50%",
          overflow: "hidden",
          background: "radial-gradient(circle at 35% 30%, #3A2A1A, #1A1208)",
          border: held ? "3px solid #E8603A" : "2px solid rgba(255,220,150,0.25)",
          boxShadow: held
            ? "0 0 20px rgba(232,96,58,0.5), 0 6px 20px rgba(0,0,0,0.5)"
            : "0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          position: "relative",
          transition: "border 0.2s, box-shadow 0.2s",
        }}>
          {species.thumbnail_url && (
            <img src={species.thumbnail_url} alt={species.common_name}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, pointerEvents: "none" }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(180,120,40,0.06)" }} />
          <div style={{
            position: "absolute", top: 6, left: 10, width: 18, height: 11,
            borderRadius: "50%", background: "rgba(255,255,255,0.14)", transform: "rotate(-25deg)",
          }} />
        </div>
      </div>

      {/* Label */}
      <div style={{
        fontFamily: "system-ui, sans-serif", fontWeight: 700,
        fontSize: 10, color: "rgba(255,230,180,0.9)",
        textAlign: "center",
        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        maxWidth: size + 12, lineHeight: 1.2,
        pointerEvents: "none",
      }}>
        {species.common_name}
      </div>
    </motion.div>
  )
}
