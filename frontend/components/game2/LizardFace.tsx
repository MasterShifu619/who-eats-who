"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useRef } from "react"

export type LizardState = "idle" | "tongue_out" | "catching" | "swallow" | "spit" | "lick"

interface LizardFaceProps {
  state: LizardState
  size?: number
  // For pupil tracking — screen coords of thing to look at
  eyeTargetX?: number
  eyeTargetY?: number
  // lizard div's screen rect for computing gaze direction
  lizardRect?: DOMRect | null
}

export default function LizardFace({
  state, size = 240,
  eyeTargetX, eyeTargetY, lizardRect,
}: LizardFaceProps) {
  const [blink, setBlink] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  const isOpen  = state === "tongue_out" || state === "catching" || state === "swallow" || state === "lick"
  const isHappy = state === "swallow"
  const isSpit  = state === "spit"

  // Blink timer
  useEffect(() => {
    const schedule = () => setTimeout(() => {
      setBlink(false)
      setTimeout(() => { setBlink(true); schedule() }, 140)
    }, 2800 + Math.random() * 2200)
    const t = schedule()
    return () => clearTimeout(t)
  }, [])

  // Pupil tracking — compute offset within SVG coords
  // Eye center in SVG: x=56, y=92. Max pupil travel: ±5px
  let pupilDX = 0, pupilDY = 0
  if (eyeTargetX !== undefined && eyeTargetY !== undefined && lizardRect) {
    const scale = size / 240
    // Eye screen position
    const eyeScreenX = lizardRect.left + 56 * scale
    const eyeScreenY = lizardRect.top  + 92 * scale
    const dx = eyeTargetX - eyeScreenX
    const dy = eyeTargetY - eyeScreenY
    const dist = Math.hypot(dx, dy) || 1
    const clamped = Math.min(dist, 120)
    pupilDX = (dx / dist) * (clamped / 120) * 5
    pupilDY = (dy / dist) * (clamped / 120) * 4
  }

  // SVG: 240×200, head LEFT, body RIGHT, upside-down
  // Mouth anchor: x≈18, y≈138 (used by parent)
  return (
    <div style={{ position: "relative", width: size, height: size * (200/240) }}>
      <svg ref={svgRef} width={size} height={size * (200/240)}
        viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        {/* ── TAIL ── */}
        <motion.path
          d="M 218 78 Q 244 52 230 28 Q 216 6 236 -6"
          stroke="#4A7830" strokeWidth={12} strokeLinecap="round" fill="none"
          animate={{ d: [
            "M 218 78 Q 244 52 230 28 Q 216 6 236 -6",
            "M 218 78 Q 247 56 234 30 Q 220 8 240 -4",
            "M 218 78 Q 241 50 226 26 Q 212 4 232 -8",
            "M 218 78 Q 244 52 230 28 Q 216 6 236 -6",
          ]}}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* ── BODY ── */}
        <ellipse cx={152} cy={88} rx={80} ry={44} fill="#5A9830" />
        <ellipse cx={152} cy={88} rx={56} ry={28} fill="#74BA42" opacity={0.42} />

        {/* ── SPINE STRIPE ── */}
        <path d="M 222 76 Q 182 72 142 74 Q 102 76 70 84"
          stroke="#3A6820" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.5} />

        {/* ── DORSAL CREST — small spines along back ── */}
        {[200, 178, 156, 134, 112].map((cx, i) => (
          <path key={i}
            d={`M ${cx} ${74 - i*1} L ${cx - 2} ${62 - i*1}`}
            stroke="#3A6820" strokeWidth={3} strokeLinecap="round"
          />
        ))}

        {/* ── LEGS — four sticking UP ── */}
        {[
          ["M 188 60 Q 200 38 210 24 Q 216 16 225 20", "M 188 60 Q 198 36 208 22 Q 214 14 223 18"],
          ["M 172 58 Q 178 34 184 20 Q 188 12 196 14", "M 172 58 Q 180 36 186 22 Q 190 14 198 16"],
          ["M 124 60 Q 116 36 112 22 Q 110 14 102 16", "M 124 60 Q 118 38 114 24 Q 112 16 104 18"],
          ["M 108 62 Q 98 38 92 24 Q 88 16 80 18",    "M 108 62 Q 100 40 94 26 Q 90 18 82 20"],
        ].map(([d1, d2], i) => (
          <motion.path key={i} d={d1} stroke="#4A7830" strokeWidth={9} strokeLinecap="round" fill="none"
            animate={{ d: [d1, d2, d1] }}
            transition={{ duration: 2.6 + i * 0.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
          />
        ))}
        {/* Toe pads */}
        {[[225,20],[196,14],[102,16],[80,18]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r={6} fill="#74BA42" />
        ))}

        {/* ── HEAD ── */}
        <ellipse cx={60} cy={98} rx={54} ry={48} fill="#5A9830" />
        <ellipse cx={72} cy={80} rx={34} ry={24} fill="#74BA42" opacity={0.35} />

        {/* Head scales texture */}
        {[[48,88],[62,82],[76,88],[55,102],[70,96]].map(([x,y],i) => (
          <ellipse key={i} cx={x} cy={y} rx={4} ry={3} fill="#4A8228" opacity={0.35} />
        ))}

        {/* ── NECK BULGE (gulp animation) ── */}
        <motion.ellipse cx={106} cy={94} rx={24} ry={20} fill="#5A9830"
          animate={isHappy ? { rx:[24,38,24], ry:[20,30,20] } : { rx:24, ry:20 }}
          transition={{ duration:0.65, delay:0.3 }}
        />

        {/* ── DEWLAP ── orange throat fan ── */}
        <motion.ellipse cx={50} cy={134} rx={17} ry={11} fill="#E06018" opacity={0.88}
          animate={isHappy ? { rx:[17,26,17], ry:[11,17,11] } : { rx:17, ry:11 }}
          transition={{ duration:0.5 }}
        />

        {/* ── EYE STACK (socket → pupil → eyelid) ── */}
        {/* Socket */}
        <circle cx={54} cy={90} r={20} fill="white" />
        {/* Iris */}
        <circle cx={54} cy={90} r={13} fill="#0C1A06" />
        {/* Specular */}
        <circle cx={59} cy={84} r={5} fill="white" />
        {/* Pupil — tracks drag target */}
        <motion.circle
          cx={54 + pupilDX} cy={90 + pupilDY} r={8}
          fill="#040C02"
          animate={{ cx: 54 + pupilDX, cy: 90 + pupilDY }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
        />
        {/* Eyelid — SAME COLOR as skin, renders ON TOP, scaleY 0→1 to blink */}
        <motion.rect
          x={34} y={80} width={40} height={22} rx={11}
          fill="#5A9830"
          animate={{ scaleY: blink ? 0 : 1 }}
          style={{ transformOrigin: "54px 91px" }}
          transition={{ duration: 0.06 }}
        />

        {/* ── EYEBROW ── */}
        <motion.path stroke="#3A6820" strokeWidth={4} fill="none" strokeLinecap="round"
          animate={
            isHappy ? { d:"M 36 70 Q 54 58 72 70" } :
            isSpit  ? { d:"M 36 76 Q 54 72 72 76" } :
                      { d:"M 36 73 Q 54 64 72 73" }
          }
          transition={{ duration:0.25 }}
        />

        {/* ── NOSTRIL ── */}
        <circle cx={18} cy={104} r={3.5} fill="#3A6820" />

        {/* ── MOUTH: CLOSED ── */}
        {!isOpen && (
          <motion.path
            d="M 14 118 Q 38 128 66 122"
            stroke="#3A6820" strokeWidth={3.5} strokeLinecap="round" fill="none"
            animate={isSpit ? { d:"M 14 118 Q 38 118 66 118" } : { d:"M 14 118 Q 38 128 66 122" }}
            transition={{ duration:0.2 }}
          />
        )}

        {/* ── MOUTH: OPEN ── */}
        {isOpen && (
          <>
            <motion.path d="M 12 110 Q 38 102 68 106"
              stroke="#3A6820" strokeWidth={3} strokeLinecap="round" fill="none"
              initial={{ opacity:0 }} animate={{ opacity:1 }}
            />
            <motion.path
              stroke="#3A6820" strokeWidth={3} strokeLinecap="round" fill="none"
              initial={{ opacity:0, d:"M 12 122 Q 38 124 68 120" }}
              animate={{ opacity:1, d:"M 12 132 Q 38 152 68 144" }}
              transition={{ duration:0.28, ease:"backOut" }}
            />
            {/* Cavity */}
            <motion.path
              d="M 12 114 Q 38 106 68 110 Q 68 144 40 152 Q 12 142 12 114 Z"
              fill="#901408" opacity={0.88}
              initial={{ opacity:0 }} animate={{ opacity:0.88 }} transition={{ duration:0.2 }}
            />
          </>
        )}

        {/* ── LICK ── */}
        <AnimatePresence>
          {state === "lick" && (
            <motion.path
              d="M 16 124 Q 6 138 0 130 Q -6 122 6 116"
              stroke="#C81818" strokeWidth={7} strokeLinecap="round" fill="none"
              initial={{ pathLength:0, opacity:0 }}
              animate={{ pathLength:[0,1,1,0], opacity:[0,1,1,0] }}
              exit={{ opacity:0 }}
              transition={{ duration:0.95, times:[0,0.38,0.68,1] }}
            />
          )}
        </AnimatePresence>

        {/* ── HAPPY CHEEK ── */}
        <AnimatePresence>
          {isHappy && (
            <motion.ellipse cx={40} cy={112} rx={14} ry={8} fill="rgba(255,90,60,0.4)"
              initial={{ opacity:0, scale:0 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              style={{ transformOrigin:"40px 112px" }}
            />
          )}
        </AnimatePresence>

        {/* ── SPIT DROPLETS ── */}
        <AnimatePresence>
          {isSpit && [
            {x:12,y:120,r:5,dx:-28,dy:12},{x:16,y:132,r:7,dx:-46,dy:22},
            {x:8,y:128,r:4,dx:-20,dy:-6},{x:20,y:124,r:6,dx:-36,dy:6},
          ].map((d,i) => (
            <motion.circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#5AA030" opacity={0.85}
              initial={{ cx:d.x, cy:d.y, opacity:0.85 }}
              animate={{ cx:d.x+d.dx, cy:d.y+d.dy, opacity:0 }}
              exit={{ opacity:0 }}
              transition={{ duration:0.5, delay:i*0.06, ease:"easeOut" }}
            />
          ))}
        </AnimatePresence>
      </svg>
    </div>
  )
}