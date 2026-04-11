"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion"
import { preloadSound, playRemoveSound, startBgMusic, stopBgMusic } from "@/lib/sounds"

type LizardState = "idle" | "tongue_out" | "catching" | "swallow" | "lick" | "spit"

const REPEL_R     = 200
const STRIKE_R    = 100
const CARD_SIZE   = 130
const LIZARD_SIZE = 340
const MOUTH_SVG   = { x: 43, y: 135 }

interface AnimalCard {
  id: string
  label: string
  svgSrc: string
  is_prey: boolean
}

const ANIMALS: AnimalCard[] = [
  // ── Prey ──
  { id: "Black Carpenter Ant",         label: "Black Carpenter Ant",  svgSrc: "/ant.svg",          is_prey: true  },
  { id: "Yellow Garden Spider",      label: "Yellow Garden Spider", svgSrc: "/spider.svg",       is_prey: true  },
  { id: "Pondhawk Dragonfly",   label: "Pondhawk Dragonfly",   svgSrc: "/Dragonfly.svg",    is_prey: true  },
  { id: "Tree Frog",        label: "Tree Frog",            svgSrc: "/Frog.svg",         is_prey: true  },
  { id: "Monarch Butterfly",   label: "Monarch Butterfly",    svgSrc: "/Butterfly.svg",    is_prey: true  },
  // ── Decoys ──
  { id: "Earthworm",        label: "Earthworm",            svgSrc: "/worm.svg",         is_prey: false },
  { id: "Green June Beetle",      label: "Green June Beetle",    svgSrc: "/beetle.svg",       is_prey: false },
  { id: "Grasshopper", label: "Grasshopper",          svgSrc: "/grasshopper.svg",  is_prey: false },
  { id: "Green Sunfish",        label: "Green Sunfish",        svgSrc: "/Fish.svg",         is_prey: false },
  { id: "Atlantic Blue Crab",        label: "Atlantic Blue Crab",   svgSrc: "/Crab.svg",         is_prey: false },
  { id: "Eastern Ratsnake",       label: "Eastern Ratsnake",     svgSrc: "/rattlesnake.svg",  is_prey: false },
  { id: "White-footed Mouse",         label: "White-footed Mouse",   svgSrc: "/mouse.svg",        is_prey: false },
  { id: "Persimmon",       label: "Persimmon",       svgSrc: "/persimmon.svg",    is_prey: false },
]

const TOTAL_PREY = ANIMALS.filter(a => a.is_prey).length

type GameState = "IDLE" | "DRAGGING" | "EVALUATING" | "RESULT_VALID" | "RESULT_INVALID"

interface Bubble { id: string; x: number; y: number; vx: number; vy: number; eaten: boolean }

function seedVel(id: string) {
  let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  const spd = 0.18 + (Math.abs(h) % 100) * 0.002
  const ang = ((Math.abs(h >> 3) % 360) * Math.PI) / 180
  return { vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd }
}

function initBubbles(w: number, h: number, mX: number, mY: number): Bubble[] {
  return ANIMALS.map(a => {
    let x: number, y: number, tries = 0
    do {
      const topBound = Math.round(h / 5)
      x = 80 + Math.random() * (w - 200); y = topBound + Math.random() * (h - topBound - 120); tries++
    } while (tries < 60 && Math.hypot(x - mX, y - mY) < REPEL_R + 80)
    return { id: a.id, x, y, ...seedVel(a.id), eaten: false }
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const logEvent = (animal: string, action: string, state: 0 | 1 | 2 = 0) => {
  fetch("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(ipData => {
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animal, action, browser: navigator.userAgent, ip: ipData.ip, state, game: "feed the lizard" }),
      }).catch(() => {})
    })
    .catch(() => {
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animal, action, browser: navigator.userAgent, ip: "unknown", state, game: "feed the lizard" }),
      }).catch(() => {})
    })
}
const LEAF_COLORS = ["#6B8C5E", "#C8851A", "#A0522D", "#4A8B8C", "#D4A847"]

export default function LizardPage() {
  const [gs, setGs]                 = useState<GameState>("IDLE")
  const [dims, setDims]             = useState({ w: 1440, h: 900 })
  const [bubbles, setBubbles]       = useState<Bubble[]>([])
  const [score, setScore]           = useState(0)
  const [feedback, setFeedback]     = useState<"valid" | "invalid" | null>(null)
  const [lzState, setLzState]       = useState<LizardState>("idle")
  const [dragId, setDragId]         = useState<string | null>(null)
  const [dragPos, setDragPos]       = useState<{ x: number; y: number } | null>(null)
  const [swallowPos, setSwallowPos] = useState<{ x: number; y: number } | null>(null)
  const [bScale, setBScale]         = useState(1)
  const [bOpacity, setBOpacity]     = useState(1)

  const bRef       = useRef<Bubble[]>([])
  const gsRef      = useRef<GameState>("IDLE")
  const capturedId = useRef<string | null>(null)
  const lzRef      = useRef<HTMLDivElement>(null)

  const getMouth = useCallback((): { x: number; y: number } => {
    const lr = lzRef.current?.getBoundingClientRect()
    if (!lr) return { x: dims.w - LIZARD_SIZE + MOUTH_SVG.x, y: dims.h / 2 - LIZARD_SIZE / 2 + MOUTH_SVG.y }
    return { x: lr.left + MOUTH_SVG.x, y: lr.top + MOUTH_SVG.y }
  }, [dims])

  useEffect(() => {
    const w = window.innerWidth, h = window.innerHeight
    setDims({ w, h })
    logEvent("SESSION", "STARTED", 0)
    const mX = w - LIZARD_SIZE + MOUTH_SVG.x, mY = h / 2 - LIZARD_SIZE / 2 + MOUTH_SVG.y
    const b = initBubbles(w, h, mX, mY)
    bRef.current = b; setBubbles([...b])
    ANIMALS.forEach(a => preloadSound(a.label))
    startBgMusic()
    return () => stopBgMusic()
  }, [])

  useAnimationFrame(() => {
    if (gsRef.current !== "IDLE" && gsRef.current !== "DRAGGING") return
    const { w, h } = dims
    const mouth = getMouth()
    const next = bRef.current.map(b => {
      if (b.eaten) return b
      if (gsRef.current === "DRAGGING" && dragId === b.id) return b
      let { x, y, vx, vy } = b
      const dx = x - mouth.x, dy = y - mouth.y, dist = Math.hypot(dx, dy)
      if (dist < REPEL_R && dist > 1) { const f = ((REPEL_R - dist) / REPEL_R) * 0.048; vx += (dx / dist) * f; vy += (dy / dist) * f }
      const spd = Math.hypot(vx, vy)
      if (spd > 1.2) { vx = (vx / spd) * 1.2; vy = (vy / spd) * 1.2 }
      if (spd < 0.1) { vx *= 1.04; vy *= 1.04 }
      x += vx; y += vy
      const topBound = Math.round(h / 5)
      if (x <= 80) { x = 80; vx = Math.abs(vx) } if (x >= w - 80) { x = w - 80; vx = -Math.abs(vx) }
      if (y <= topBound) { y = topBound; vy = Math.abs(vy) } if (y >= h - 80) { y = h - 80; vy = -Math.abs(vy) }
      return { ...b, x, y, vx, vy }
    })
    bRef.current = next; setBubbles([...next])
  })

  const startDrag = useCallback((animal: AnimalCard, cX: number, cY: number, bx: number, by: number) => {
    if (gsRef.current !== "IDLE") return
    gsRef.current = "DRAGGING"; setGs("DRAGGING")
    setDragId(animal.id); setDragPos({ x: bx, y: by })
    const mouth = getMouth()
    const onMove = (e: PointerEvent) => {
      if (gsRef.current !== "DRAGGING") return
      const nx = bx + (e.clientX - cX), ny = by + (e.clientY - cY)
      setDragPos({ x: nx, y: ny })
      if (Math.hypot(nx - mouth.x, ny - mouth.y) < STRIKE_R) {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        capture(animal, nx, ny)
      }
    }
    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      const finalX = bx + (e.clientX - cX)
      const finalY = by + (e.clientY - cY)
      bRef.current = bRef.current.map(b2 =>
        b2.id === animal.id ? { ...b2, x: finalX, y: finalY, vx: (e.clientX - cX) * 0.008, vy: (e.clientY - cY) * 0.008 } : b2
      )
      gsRef.current = "IDLE"; setGs("IDLE")
      setDragId(null); setDragPos(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [getMouth])

  const capture = useCallback(async (animal: AnimalCard, bx: number, by: number) => {
    capturedId.current = animal.id
    gsRef.current = "EVALUATING"; setGs("EVALUATING")
    setLzState("catching"); setDragPos(null); setDragId(null)
    setBScale(1); setBOpacity(1); setSwallowPos({ x: bx, y: by })
    await sleep(900)

    if (animal.is_prey) {
      playRemoveSound(animal.label)
      logEvent(animal.id, "DRAGGED", 1)
      gsRef.current = "RESULT_VALID"; setGs("RESULT_VALID")
      setLzState("swallow"); setFeedback("valid")
      const mouth = getMouth()
      const steps = 30, sx = bx, sy = by
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        setSwallowPos({ x: sx + (mouth.x - sx) * t, y: sy + (mouth.y - sy) * t })
        await sleep(700 / steps)
      }
      setBScale(0); setBOpacity(0)
      await sleep(300)
      bRef.current = bRef.current.map(b => b.id === animal.id ? { ...b, eaten: true } : b)
      setBubbles([...bRef.current])
      setSwallowPos(null); setScore(s => s + 1)
      await sleep(500); setLzState("lick"); await sleep(1000)
    } else {
      gsRef.current = "RESULT_INVALID"; setGs("RESULT_INVALID")
      logEvent(animal.id, "DRAGGED", 2)
      setLzState("spit"); setFeedback("invalid")
      await sleep(380)
      setSwallowPos(null)
      const mouth = getMouth()
      bRef.current = bRef.current.map(b => {
        if (b.id !== animal.id) return b
        const dx = bx - mouth.x, dy = by - mouth.y, dist = Math.hypot(dx, dy) || 1
        return { ...b, x: bx, y: by, vx: (dx / dist) * 3.0, vy: (dy / dist) * 3.0 }
      })
      setBubbles([...bRef.current])
      await sleep(1400)
    }

    setLzState("idle"); setFeedback(null); setBScale(1); setBOpacity(1)
    capturedId.current = null
    gsRef.current = "IDLE"; setGs("IDLE")
  }, [getMouth])

  const fb = feedback === "valid"
    ? { emoji: "😋", headline: "Delicious!", sub: "The lizard eats that!",      color: "var(--sage)", bg: "rgba(107,140,94,0.15)", border: "rgba(107,140,94,0.5)" }
    : feedback === "invalid"
    ? { emoji: "🤢", headline: "Not quite!", sub: "The lizard won't eat that.", color: "var(--rust)", bg: "rgba(160,82,45,0.12)", border: "rgba(160,82,45,0.45)" }
    : null

  return (
    <div className="wc-cursor" style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }} onContextMenu={e=>e.preventDefault()}>

      {/* ── Watercolor lake background ── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "url('/watercolor-lake-background.jpg')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(255,255,255,0.30)" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(244,237,211,0.18)" }} />
      {/* Contrast overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 500, pointerEvents: "none", background: "rgba(20,12,4,0.07)", mixBlendMode: "multiply" }} />

      {/* ── Score badge ── */}
      <div style={{
        position: "absolute", top: 20, left: 24, zIndex: 30,
        background: "rgba(244,237,211,0.92)",
        border: "1px solid rgba(92,61,46,0.22)",
        borderRadius: "4px 10px 5px 9px / 9px 4px 10px 5px",
        padding: "5px 14px", display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 10px rgba(60,40,10,0.14)",
      }}>
        <span style={{ fontSize: 20 }}>🦎</span>
        <div style={{ fontFamily: "var(--font-mansalva), cursive", fontSize: 18, color: "rgba(44,24,16,0.82)" }}>
          {score} <span style={{ fontSize: 12, color: "rgba(92,61,46,0.55)" }}>/ {TOTAL_PREY}</span>
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", zIndex: 30, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontFamily: "var(--font-mansalva), cursive", fontSize: 22, color: "rgba(44,24,16,0.82)", letterSpacing: "0.02em", textShadow: "1px 2px 0 rgba(255,255,255,0.5)" }}>
          Feed Annie the Anole
        </div>
        <div style={{ fontFamily: "var(--font-playfair), serif", fontStyle: "italic", fontSize: 11, color: "rgba(92,61,46,0.6)", marginTop: 2 }}>
          Drag specimens close to the lizard
        </div>
      </div>

      
      {/* ── Lizard ── */}
      <div ref={lzRef} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", right: -50, zIndex: 30 }}>
        <motion.div
          animate={
            gs === "EVALUATING"     ? { rotate: [-1, 1, -1, 1, 0] } :
            gs === "RESULT_VALID"   ? { scale: [1, 1.07, 1] } :
            gs === "RESULT_INVALID" ? { rotate: [0, 5, -5, 0] } : {}
          }
          transition={{ duration: 0.5 }}
        >
          <img
            src={lzState !== "idle" ? "/AnoleOpen.svg" : "/AnoleClosed.svg"}
            alt="Lizard"
            style={{ width: LIZARD_SIZE, height: "auto", objectFit: "contain", display: "block" }}
          />
        </motion.div>
      </div>

      {/* ── Floating animals ── */}
      {bubbles.map(b => {
        if (b.eaten) return null
        const animal = ANIMALS.find(a => a.id === b.id)!
        const isDragged = dragId === b.id
        const isCaptured = b.id === capturedId.current && swallowPos !== null

        const dispX = isDragged && dragPos ? dragPos.x : isCaptured && swallowPos ? swallowPos.x : b.x
        const dispY = isDragged && dragPos ? dragPos.y : isCaptured && swallowPos ? swallowPos.y : b.y

        return (
          <motion.div key={b.id} style={{
            position: "absolute",
            left: dispX - CARD_SIZE / 2, top: dispY - CARD_SIZE / 2,
            width: CARD_SIZE,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            zIndex: isCaptured ? 35 : isDragged ? 38 : 15,
            cursor: gs === "IDLE" ? "grab" : "default",
            touchAction: "none",
            pointerEvents: gs === "IDLE" ? "auto" : "none",
            scale: isCaptured ? bScale : 1,
            opacity: isCaptured ? bOpacity : 1,
          }}
            animate={gs === "EVALUATING" && isCaptured ? { x: [-4, 4, -3, 3, -2, 2, 0], y: [3, -3, 2, -2, 0] } : { x: 0, y: 0 }}
            transition={{ duration: 0.32, repeat: gs === "EVALUATING" ? Infinity : 0 }}
            onPointerDown={e => {
              if (gs !== "IDLE") return
              e.preventDefault()
              startDrag(animal, e.clientX, e.clientY, b.x, b.y)
            }}
          >
            <img
              src={animal.svgSrc}
              alt={animal.label}
              style={{
                width: CARD_SIZE, height: CARD_SIZE,
                objectFit: "contain",
                filter: isCaptured
                  ? "drop-shadow(0 0 10px rgba(160,82,45,0.6)) drop-shadow(2px 3px 6px rgba(60,40,10,0.3))"
                  : isDragged
                  ? "drop-shadow(0 0 8px rgba(107,140,94,0.5)) drop-shadow(2px 4px 8px rgba(60,40,10,0.3))"
                  : "drop-shadow(2px 3px 6px rgba(60,40,10,0.25))",
                pointerEvents: "none",
              }}
            />
            <div style={{
              background: "rgba(244,237,211,0.90)",
              borderRadius: 8, padding: "2px 8px",
              fontFamily: "var(--font-playfair), serif", fontStyle: "italic",
              fontSize: 9, color: "rgba(44,24,16,0.78)",
              letterSpacing: "0.03em", whiteSpace: "nowrap",
              pointerEvents: "none",
            }}>
              {animal.label}
            </div>
          </motion.div>
        )
      })}

      {/* ── Feedback toast ── */}
      <AnimatePresence>
        {fb && (
          <motion.div style={{ position: "absolute", right: 100, top: "calc(50% + " + (LIZARD_SIZE / 2) + "px)", zIndex: 50, textAlign: "center", pointerEvents: "none", width: LIZARD_SIZE - 100 }}
            initial={{ scale: 0.5, opacity: 0, y: 20, rotate: -3 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
          >
            <div style={{ background: fb.bg, border: `1.5px solid ${fb.border}`, borderRadius: "6px 16px 8px 14px / 14px 6px 16px 8px", padding: "14px 28px 16px", boxShadow: "0 8px 28px rgba(60,40,10,0.2)", backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 5 }}>{fb.emoji}</div>
              <div style={{ fontFamily: "var(--font-mansalva), cursive", fontSize: 30, color: fb.color, letterSpacing: "0.01em", textShadow: "1px 2px 0 rgba(255,255,255,0.4)" }}>{fb.headline}</div>
              <div style={{ fontFamily: "var(--font-playfair), serif", fontStyle: "italic", fontSize: 13, color: "rgba(92,61,46,0.72)", marginTop: 5 }}>{fb.sub}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Win screen ── */}
      <AnimatePresence>
        {score === TOTAL_PREY && score > 0 && (
          <motion.div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(244,237,211,0.88)", backdropFilter: "blur(10px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            {[...Array(20)].map((_, i) => (
              <motion.div key={i} style={{ position: "absolute", top: 0, left: `${5 + (i * 4.7) % 90}%`, fontSize: 18, pointerEvents: "none", color: LEAF_COLORS[i % LEAF_COLORS.length] }}
                animate={{ y: ["0vh", "105vh"], rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)], opacity: [0, 0.9, 0.8, 0] }}
                transition={{ duration: 2.5 + (i % 3) * 0.6, delay: i * 0.1, repeat: Infinity, ease: "linear" }}
              >{["🍂", "🍃", "🌿", "🍁"][i % 4]}</motion.div>
            ))}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
              style={{ background: "linear-gradient(150deg, #FAF5E4 0%, #EDE0BC 100%)", border: "1.5px solid rgba(139,107,85,0.3)", borderRadius: "6px 18px 8px 16px / 16px 6px 18px 8px", padding: "36px 52px 40px", textAlign: "center", boxShadow: "0 24px 64px rgba(60,40,10,0.22)", maxWidth: 420 }}
            >
              <div style={{ fontSize: 64, marginBottom: 12 }}>🦎</div>
              <div style={{ fontFamily: "var(--font-mansalva), cursive", fontSize: 36, color: "rgba(44,24,16,0.88)", marginBottom: 10 }}>Annie is full!</div>
              <div style={{ fontFamily: "var(--font-playfair), serif", fontStyle: "italic", fontSize: 15, color: "rgba(92,61,46,0.7)", lineHeight: 1.6, marginBottom: 28 }}>
                You found all {score} of its favourite<br />specimens from the field guide.
              </div>
              <motion.button
                style={{ padding: "12px 36px", fontFamily: "var(--font-mansalva), cursive", fontSize: 16, color: "rgba(244,237,211,0.95)", background: "rgba(107,140,94,0.88)", border: "1.5px solid rgba(107,140,94,0.6)", borderRadius: "4px 10px 5px 9px / 9px 4px 10px 5px", cursor: "pointer", boxShadow: "0 4px 16px rgba(107,140,94,0.3)" }}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const mouth = getMouth()
                  const b = initBubbles(dims.w, dims.h, mouth.x, mouth.y)
                  bRef.current = b; setBubbles([...b])
                  setScore(0); gsRef.current = "IDLE"; setGs("IDLE")
                  setLzState("idle"); /**setTongueEnd(null); */ setDragId(null)
                  setBScale(1); setBOpacity(1); setSwallowPos(null)
                  logEvent("SESSION", "STARTED", 0)
                }}
              >Play again →</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
