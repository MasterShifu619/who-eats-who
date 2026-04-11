"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const LS_KEY = "who-eats-who-tutorial-v1"

interface TutorialProps {
  onDone: () => void
}

// ─── Reusable animated cursor ─────────────────────────────────────────────────
function Cursor({ x, y, pressing }: { x: number; y: number; pressing?: boolean }) {
  return (
    <motion.div
      animate={{ left: x, top: y, scale: pressing ? 0.82 : 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      style={{
        position: "absolute",
        zIndex: 10,
        pointerEvents: "none",
        fontSize: 22,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
        transformOrigin: "top left",
      }}
    >
      {pressing ? "✊" : "✋"}
    </motion.div>
  )
}

// ─── Step demos ───────────────────────────────────────────────────────────────

function WelcomeDemo() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 24 }}>
      {[
        { emoji: "☀️", label: "Sun",       color: "#D4A847", delay: 0 },
        { emoji: "🍊", label: "Persimmon",     color: "#6B8C5E", delay: 0.12 },
        { emoji: "🦋", label: "Monarch Butterfly", color: "#C8851A", delay: 0.24 },
        { emoji: "🐸", label: "American Toad",      color: "#4A8B8C", delay: 0.36 },
        { emoji: "🦤", label: "Heron",     color: "#6B8CAA", delay: 0.48 },
      ].map(({ emoji, label, color, delay }) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay, duration: 0.5, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: delay * 2 }}
            style={{
              width: 52, height: 52, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, rgba(255,252,238,0.95) 0%, ${color}66 100%)`,
              border: `1.5px solid ${color}88`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
              boxShadow: `0 4px 16px ${color}33`,
            }}
          >
            {emoji}
          </motion.div>
          <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 9, color: "rgba(92,61,46,0.65)" }}>
            {label}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

function SunDemo() {
  const [phase, setPhase] = useState<"shelf" | "dragging" | "placed" | "glow">("shelf")

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("dragging"), 900)
    const t2 = setTimeout(() => setPhase("placed"),   1900)
    const t3 = setTimeout(() => setPhase("glow"),     2500)
    const t4 = setTimeout(() => { setPhase("shelf") }, 4200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [phase === "shelf" ? undefined : null])

  // Restart loop
  useEffect(() => {
    if (phase !== "shelf") return
    const t = setTimeout(() => setPhase("dragging"), 900)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Shelf strip */}
      <div style={{
        width: 80, height: "100%", flexShrink: 0,
        background: "rgba(244,237,211,0.6)",
        borderRight: "1px solid rgba(92,61,46,0.15)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <div style={{ fontFamily: "var(--font-playfair), serif", fontStyle: "italic", fontSize: 9, color: "rgba(92,61,46,0.5)", marginBottom: 4 }}>shelf</div>
        <motion.div
          animate={{ opacity: phase === "dragging" || phase === "placed" || phase === "glow" ? 0.2 : 1 }}
          style={{
            width: 44, height: 44,
            background: "rgba(212,168,71,0.25)",
            border: "1px solid rgba(212,168,71,0.5)",
            borderRadius: "4px 8px 5px 7px / 7px 4px 8px 5px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}
        >☀️</motion.div>
        <div style={{ fontSize: 16, opacity: 0.3 }}>🍊</div>
        <div style={{ fontSize: 16, opacity: 0.3 }}>🦋</div>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Placed sun */}
        <AnimatePresence>
          {(phase === "placed" || phase === "glow") && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              {/* Glow */}
              {phase === "glow" && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    position: "absolute",
                    width: 100, height: 100, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(212,168,71,0.35) 0%, transparent 70%)",
                    top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                  }}
                />
              )}
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, rgba(255,252,220,0.96) 0%, rgba(212,168,71,0.88) 100%)",
                border: "2px solid rgba(212,168,71,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26,
                boxShadow: phase === "glow" ? "0 0 24px rgba(212,168,71,0.6)" : "none",
              }}>☀️</div>
              <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 9, color: "rgba(92,61,46,0.7)" }}>Sun</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint text when done */}
        <AnimatePresence>
          {phase === "glow" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute", bottom: 12, left: 0, right: 0,
                textAlign: "center",
                fontFamily: "var(--font-playfair), serif", fontStyle: "italic",
                fontSize: 10, color: "rgba(107,140,94,0.85)",
              }}
            >
              ✓ Life can now begin!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Animated cursor */}
      {(phase === "shelf" || phase === "dragging") && (
        <Cursor
          x={phase === "shelf" ? 28 : 160}
          y={phase === "shelf" ? 95 : 85}
          pressing={phase === "dragging"}
        />
      )}
    </div>
  )
}

function CreaturesDemo() {
  const ANIMALS = [
    { emoji: "🦋", label: "Monarch Butterfly", color: "#C8851A", tx: 60,  ty: 50  },
    { emoji: "🐸", label: "American Toad",      color: "#4A8B8C", tx: 170, ty: 80  },
    { emoji: "🐍", label: "Eastern Ratsnake",     color: "#A0522D", tx: 115, ty: 130 },
  ]
  const [placed, setPlaced] = useState<number[]>([])
  const [cursorIdx, setCursorIdx] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const steps = ANIMALS.length
    let idx = 0
    const run = () => {
      if (idx >= steps) {
        setTimeout(() => { setPlaced([]); setCursorIdx(0); idx = 0; run() }, 1800)
        return
      }
      setCursorIdx(idx)
      setDragging(false)
      const t1 = setTimeout(() => setDragging(true),  600)
      const t2 = setTimeout(() => { setPlaced(p => [...p, idx]); setDragging(false); idx++; setTimeout(run, 400) }, 1500)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    const cleanup = run()
    return () => { cleanup?.() }
  }, [])

  const cur = ANIMALS[cursorIdx]

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Shelf */}
      <div style={{
        width: 80, height: "100%", flexShrink: 0,
        background: "rgba(244,237,211,0.6)",
        borderRight: "1px solid rgba(92,61,46,0.15)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 8,
      }}>
        <div style={{ fontFamily: "var(--font-playfair), serif", fontStyle: "italic", fontSize: 9, color: "rgba(92,61,46,0.5)" }}>shelf</div>
        {ANIMALS.map((a, i) => (
          <motion.div key={a.label}
            animate={{ opacity: placed.includes(i) ? 0.15 : 1 }}
            style={{ fontSize: 20 }}
          >{a.emoji}</motion.div>
        ))}
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Placed nodes */}
        {ANIMALS.map((a, i) => placed.includes(i) && (
          <motion.div key={a.label}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{
              position: "absolute", left: a.tx, top: a.ty,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, rgba(255,252,238,0.95) 0%, ${a.color}55 100%)`,
              border: `1.5px solid ${a.color}88`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>{a.emoji}</div>
            <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 8, color: "rgba(92,61,46,0.65)" }}>{a.label}</span>
          </motion.div>
        ))}
        {/* Edges */}
        {placed.length >= 2 && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {placed.slice(1).map(i => {
              const a = ANIMALS[i - 1], b = ANIMALS[i]
              if (!a || !b) return null
              return (
                <motion.line key={i}
                  x1={a.tx + 20} y1={a.ty + 20} x2={b.tx + 20} y2={b.ty + 20}
                  stroke={b.color} strokeWidth={2} strokeOpacity={0.7}
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Cursor */}
      {!placed.includes(cursorIdx) && (
        <Cursor
          x={dragging ? (cur.tx + 88) : 30}
          y={dragging ? (cur.ty + 8) : 68 + cursorIdx * 30}
          pressing={dragging}
        />
      )}
    </div>
  )
}

function HoldDemo() {
  const [phase, setPhase] = useState<"idle" | "hovering" | "holding" | "removed" | "cascade">("idle")
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let prog = 0
    let interval: ReturnType<typeof setInterval>

    const t0 = setTimeout(() => setPhase("hovering"), 600)
    const t1 = setTimeout(() => { setPhase("holding"); prog = 0; setProgress(0)
      interval = setInterval(() => {
        prog += 0.035
        setProgress(Math.min(prog, 1))
        if (prog >= 1) clearInterval(interval)
      }, 50)
    }, 1400)
    const t2 = setTimeout(() => { setPhase("removed"); setProgress(0) }, 3200)
    const t3 = setTimeout(() => setPhase("cascade"), 3800)
    const t4 = setTimeout(() => { setPhase("idle"); setProgress(0) }, 5800)

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearInterval(interval) }
  }, [phase === "idle" ? undefined : null])

  useEffect(() => {
    if (phase !== "idle") return
    const t = setTimeout(() => setPhase("hovering"), 600)
    return () => clearTimeout(t)
  }, [phase])

  const r = 30
  const circumference = 2 * Math.PI * r

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 32 }}>
      {/* Main node being held */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <AnimatePresence>
          {phase !== "removed" && phase !== "cascade" && (
            <motion.div
              initial={{ scale: 1 }}
              animate={{
                scale: phase === "hovering" || phase === "holding" ? 1.08 : 1,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ position: "relative" }}
            >
              {/* Ghost dashed ring on hover */}
              {phase === "hovering" && (
                <motion.svg
                  style={{ position: "absolute", top: -10, left: -10, pointerEvents: "none" }}
                  width={80} height={80} viewBox="0 0 80 80"
                >
                  <motion.circle
                    cx={40} cy={40} r={36}
                    fill="none"
                    stroke="rgba(160,82,45,0.45)"
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    animate={{ opacity: [0.3, 0.75, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                </motion.svg>
              )}

              {/* Progress ring on hold */}
              {phase === "holding" && (
                <svg style={{ position: "absolute", top: -10, left: -10, pointerEvents: "none" }} width={80} height={80}>
                  <circle cx={40} cy={40} r={36} fill="none" stroke="rgba(160,82,45,0.2)" strokeWidth={3} />
                  <motion.circle
                    cx={40} cy={40} r={36} fill="none"
                    stroke="rgba(160,82,45,0.85)" strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    style={{ rotate: "-90deg", transformOrigin: "40px 40px" }}
                    transition={{ duration: 0 }}
                  />
                </svg>
              )}

              <div style={{
                width: 58, height: 58, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, rgba(255,252,238,0.95) 0%, rgba(74,139,140,0.55) 100%)",
                border: `2px solid ${phase === "holding" ? "rgba(160,82,45,0.7)" : "rgba(74,139,140,0.7)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26,
                boxShadow: phase === "holding" ? "0 0 16px rgba(160,82,45,0.3)" : "none",
                transition: "border 0.2s, box-shadow 0.2s",
              }}>🐸</div>
            </motion.div>
          )}
        </AnimatePresence>

        <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 9, color: "rgba(92,61,46,0.65)" }}>
          {phase === "removed" || phase === "cascade" ? "" : "American Toad"}
        </span>
      </div>

      {/* Connected nodes that cascade */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[{ emoji: "🐍", label: "Eastern Ratsnake", color: "#A0522D" }, { emoji: "🦤", label: "Heron", color: "#6B8CAA" }].map((a, i) => (
          <motion.div key={a.label}
            animate={{
              opacity: phase === "cascade" ? [1, 0.3, 1, 0.2, 0] : 1,
              scale: phase === "cascade" ? [1, 1.05, 0.95, 0] : 1,
            }}
            transition={{ duration: 0.8, delay: i * 0.3, ease: "easeInOut" }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, rgba(255,252,238,0.95) 0%, ${a.color}55 100%)`,
              border: `1.5px solid ${a.color}88`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
            }}>{a.emoji}</div>
            <span style={{ fontFamily: "var(--font-playfair), serif", fontSize: 8, color: "rgba(92,61,46,0.65)" }}>{a.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Cascade warning */}
      <AnimatePresence>
        {phase === "cascade" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
              background: "rgba(244,237,211,0.92)",
              border: "1.5px solid rgba(212,168,71,0.6)",
              borderRadius: 8, padding: "5px 14px",
              fontFamily: "var(--font-mansalva), cursive",
              fontSize: 12, color: "rgba(160,82,45,0.9)",
              whiteSpace: "nowrap",
            }}
          >
            ⚠️ Watch the cascade…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursor */}
      {(phase === "idle" || phase === "hovering" || phase === "holding") && (
        <Cursor x={94} y={100} pressing={phase === "holding"} />
      )}
    </div>
  )
}

function OverpopulationDemo() {
  const [pulse, setPulse] = useState(0)
  const [miniAngle, setMiniAngle] = useState(0)

  useEffect(() => {
    let frame: number
    let start: number
    const animate = (ts: number) => {
      if (!start) start = ts
      const t = ts - start
      setPulse(Math.sin(t * 0.008) * 0.5 + 0.5)
      setMiniAngle(t * 0.0006)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const centerX = 130, centerY = 105
  const nodeR = 34
  const miniCount = 3

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="popGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(107,140,94,1)" stopOpacity={0.28 * pulse} />
            <stop offset="100%" stopColor="rgba(107,140,94,0)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <ellipse cx={centerX} cy={centerY} rx={nodeR * 3} ry={nodeR * 3} fill="url(#popGlow)" />

        {Array.from({ length: miniCount }).map((_, i) => {
          const angle = (i / miniCount) * Math.PI * 2 + miniAngle
          const dist = nodeR * 3.2
          const mx = centerX + Math.cos(angle) * dist
          const my = centerY + Math.sin(angle) * dist
          const miniR = nodeR * 0.44
          return (
            <g key={i} opacity={0.6 + pulse * 0.3}>
              <circle cx={mx} cy={my} r={miniR} fill="rgba(255,252,238,0.88)" stroke="rgba(107,140,94,0.6)" strokeWidth={1} />
              <text x={mx} y={my + 1} fontSize={miniR * 1.1} textAnchor="middle" dominantBaseline="middle">🦋</text>
            </g>
          )
        })}
      </svg>

      <div style={{
        position: "absolute",
        left: centerX - nodeR, top: centerY - nodeR,
        width: nodeR * 2, height: nodeR * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, rgba(255,252,238,0.96) 0%, rgba(107,140,94,0.55) 100%)`,
        border: `2px solid rgba(107,140,94,${0.6 + pulse * 0.35})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26,
        boxShadow: `0 0 ${16 + pulse * 12}px rgba(107,140,94,0.45)`,
        transition: "box-shadow 0.05s",
      }}>🦋</div>

      <div style={{
        position: "absolute",
        left: centerX - 40, top: centerY + nodeR + 10,
        width: 80, textAlign: "center",
        fontFamily: "var(--font-mansalva), cursive",
        fontSize: 11, color: "rgba(107,140,94,0.9)",
        fontWeight: "bold",
      }}>Overpopulating!</div>

      <div style={{
        position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
        background: "rgba(107,140,94,0.12)",
        border: "1.5px solid rgba(107,140,94,0.4)",
        borderRadius: 8, padding: "8px 12px",
        fontFamily: "var(--font-playfair), serif",
        fontStyle: "italic", fontSize: 10,
        color: "rgba(44,24,16,0.72)",
        maxWidth: 120, lineHeight: 1.5,
      }}>
        No predators left — the species runs wild
      </div>
    </div>
  )
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Welcome to Who Eats Whom",
    body: "Build a real food web using animals from North Carolina. Watch how nature connects — and collapses.",
    demo: <WelcomeDemo />,
  },
  {
    title: "Start with the Sun ☀️",
    body: "Drag the Sun from the shelf onto the canvas. Nothing survives without it — it must go first.",
    demo: <SunDemo />,
  },
  {
    title: "Build your Food Web",
    body: "Drag creatures from the shelf to the canvas. Connections form automatically as you add more species.",
    demo: <CreaturesDemo />,
  },
  {
    title: "Hold to Remove",
    body: "Press and hold any creature for 3 seconds to remove it. Watch the cascade — losing one species can collapse others that depend on it.",
    demo: <HoldDemo />,
  },
  {
    title: "Overpopulation 🌿",
    body: "When a species has no predators in the web, it overpopulates! You'll see a green glow and tiny copies spawning around it. Add a predator to restore balance.",
    demo: <OverpopulationDemo />,
  },
]

// ─── Main Tutorial component ──────────────────────────────────────────────────

export default function Tutorial({ onDone }: TutorialProps) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1

  const finish = () => {
    localStorage.setItem(LS_KEY, "1")
    onDone()
  }

  const current = STEPS[step]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(20, 14, 8, 0.82)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) finish() }}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        style={{
          width: "min(520px, 92vw)",
          position: "relative",
          boxShadow: "0 32px 80px rgba(20,14,8,0.5), 0 4px 16px rgba(20,14,8,0.2)",
        }}
      >
        {/* Warped parchment background layer — filter here so text is unaffected */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          background: "linear-gradient(150deg, #FAF5E4 0%, #EDE0BC 100%)",
          borderRadius: "4px 14px 6px 12px / 12px 4px 14px 6px",
          border: "1px solid rgba(139,107,85,0.28)",
          filter: "url(#watercolor-edge)",
          overflow: "hidden",
        }} />

        {/* Content sits above the warped background */}
        <div style={{ position: "relative", zIndex: 1, borderRadius: "4px 14px 6px 12px / 12px 4px 14px 6px", overflow: "hidden" }}>

        {/* Demo area */}
        <div style={{
          height: 210,
          background: "rgba(232,220,188,0.35)",
          borderBottom: "1px solid rgba(139,107,85,0.15)",
          position: "relative",
          overflow: "hidden",
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ width: "100%", height: "100%" }}
            >
              {current.demo}
            </motion.div>
          </AnimatePresence>

          {/* Step dots */}
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 6,
          }}>
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{ width: i === step ? 18 : 6, background: i === step ? "rgba(160,82,45,0.75)" : "rgba(92,61,46,0.22)" }}
                style={{ height: 6, borderRadius: 3 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>

        {/* Text + buttons */}
        <div style={{ padding: "20px 24px 22px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <h2 style={{
                fontFamily: "var(--font-mansalva), cursive",
                fontSize: 20, color: "rgba(44,24,16,0.88)",
                margin: "0 0 8px", letterSpacing: "0.01em",
              }}>
                {current.title}
              </h2>
              <p style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic", fontSize: 13,
                color: "rgba(92,61,46,0.72)",
                margin: 0, lineHeight: 1.6,
              }}>
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
            {/* Skip */}
            <motion.button
              style={{
                fontFamily: "var(--font-playfair), serif", fontStyle: "italic",
                fontSize: 11, color: "rgba(92,61,46,0.45)",
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
              }}
              whileHover={{ color: "rgba(92,61,46,0.75)" }}
              onClick={finish}
            >
              skip tutorial
            </motion.button>

            <div style={{ display: "flex", gap: 8 }}>
              {/* Back */}
              {step > 0 && (
                <motion.button
                  style={{
                    padding: "9px 18px",
                    fontFamily: "var(--font-mansalva), cursive", fontSize: 13,
                    color: "rgba(92,61,46,0.65)",
                    background: "transparent",
                    border: "1.5px solid rgba(92,61,46,0.22)",
                    borderRadius: "4px 8px 5px 7px / 7px 4px 8px 5px",
                    cursor: "pointer",
                  }}
                  whileHover={{ borderColor: "rgba(92,61,46,0.45)" }}
                  onClick={() => setStep(s => s - 1)}
                >
                  ← Back
                </motion.button>
              )}

              {/* Next / Let's go */}
              <motion.button
                style={{
                  padding: "9px 22px",
                  fontFamily: "var(--font-mansalva), cursive", fontSize: 13,
                  color: "rgba(244,237,211,0.95)",
                  background: "rgba(160,82,45,0.82)",
                  border: "1.5px solid rgba(160,82,45,0.6)",
                  borderRadius: "4px 8px 5px 7px / 7px 4px 8px 5px",
                  cursor: "pointer",
                  boxShadow: "0 3px 12px rgba(160,82,45,0.25)",
                }}
                whileHover={{ background: "rgba(160,82,45,0.95)", scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => isLast ? finish() : setStep(s => s + 1)}
              >
                {isLast ? "Let's go! →" : "Next →"}
              </motion.button>
            </div>
          </div>
        </div>
        </div>{/* end content wrapper */}
      </motion.div>
    </motion.div>
  )
}

// ── Export helper ──────────────────────────────────────────────────────────────
export function shouldShowTutorial(): boolean {
  if (typeof window === "undefined") return false
  return !localStorage.getItem(LS_KEY)
}
