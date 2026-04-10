"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import HeronFace, { HeronState } from "@/components/game2/HeronFace"
import FloatingBubble, { BubbleSpecies } from "@/components/game2/FloatingBubble"
import { checkFeed } from "@/lib/api"

const PREDATOR = "Ardea herodias"

const BUBBLE_SPECIES: BubbleSpecies[] = [
  // ── Valid prey ──
  { scientific_name: "Ameiurus natalis",         common_name: "Yellow Bullhead",          thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/45893234/medium.jpg",   is_prey: true  },
  { scientific_name: "Lithobates catesbeianus",  common_name: "American Bullfrog",        thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/13578736/medium.jpg",   is_prey: true  },
  { scientific_name: "Anguilla rostrata",        common_name: "American Eel",             thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/120507875/medium.jpeg", is_prey: true  },
  { scientific_name: "Lepomis macrochirus",      common_name: "Bluegill",                 thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/57005588/medium.jpg",   is_prey: true  },
  { scientific_name: "Nerodia sipedon",          common_name: "Common Watersnake",        thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/28757507/medium.jpg",   is_prey: true  },
  { scientific_name: "Cyprinus carpio",          common_name: "European Carp",            thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/46703402/medium.jpg",   is_prey: true  },
  { scientific_name: "Siren lacertina",          common_name: "Greater Siren",            thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/32964789/medium.jpg",   is_prey: true  },
  { scientific_name: "Lepomis gibbosus",         common_name: "Pumpkinseed",              thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/57005612/medium.jpg",   is_prey: true  },
  { scientific_name: "Apalone spinifera",        common_name: "Spiny Softshell",          thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/35478932/medium.jpg",   is_prey: true  },
  { scientific_name: "Pomoxis nigromaculatus",   common_name: "Black Crappie",            thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/67445521/medium.jpg",   is_prey: true  },
  // ── Decoys ──
  { scientific_name: "Zonotrichia albicollis",   common_name: "White-throated Sparrow",   thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/66662948/medium.jpeg",  is_prey: false },
  { scientific_name: "Fulica americana",         common_name: "American Coot",            thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/29189487/medium.jpg",   is_prey: false },
  { scientific_name: "Apalone ferox",            common_name: "Florida Softshell Turtle", thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/28289752/medium.jpg",   is_prey: false },
  { scientific_name: "Acanthogobius flavimanus", common_name: "Yellowfin Goby",           thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/316245626/medium.jpg",  is_prey: false },
  { scientific_name: "Hemigrapsus nudus",        common_name: "Purple Shore Crab",        thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/19611761/medium.jpg",   is_prey: false },
  { scientific_name: "Urechis caupo",            common_name: "Fat Innkeeper Worm",       thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/183053796/medium.jpeg", is_prey: false },
  { scientific_name: "Coleomegilla maculata",    common_name: "Pink Lady Beetle",         thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/452490513/medium.jpeg", is_prey: false },
  { scientific_name: "Opsanus tau",              common_name: "Oyster Toadfish",          thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/181850781/medium.jpg",  is_prey: false },
  { scientific_name: "Merluccius productus",     common_name: "Pacific Hake",             thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/397903267/medium.jpeg", is_prey: false },
  { scientific_name: "Triglops pingelii",        common_name: "Ribbed Sculpin",           thumbnail_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/409102410/medium.jpeg", is_prey: false },
]

const TOTAL_PREY = BUBBLE_SPECIES.filter((s) => s.is_prey).length
const BUBBLE_SIZE = 88
const HERON_W = 340

function scatter(count: number, w: number, h: number) {
  const cols = 4
  const rows = Math.ceil(count / cols)
  const usableW = w - HERON_W - 80
  const cellW = usableW / cols
  const cellH = (h - 120) / rows
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 50 + col * cellW + cellW * 0.15 + Math.random() * cellW * 0.7
    const y = 90 + row * cellH + cellH * 0.1 + Math.random() * cellH * 0.75
    pts.push({ x, y })
  }
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]]
  }
  return pts
}

interface DragState { species: BubbleSpecies; x: number; y: number; startX: number; startY: number }

const FEEDBACK = {
  valid:   { emoji: "😋", headline: "Delicious!",  sub: "Great Blue Herons eat that!",  color: "var(--sage)",  bg: "rgba(107,140,94,0.15)",  border: "rgba(107,140,94,0.5)" },
  invalid: { emoji: "🤢", headline: "Not quite!",  sub: "Herons don't eat that.",        color: "var(--rust)",  bg: "rgba(160,82,45,0.12)",   border: "rgba(160,82,45,0.45)" },
}

// Falling leaf shapes for win confetti
const LEAF_COLORS = ["#6B8C5E","#C8851A","#A0522D","#4A8B8C","#D4A847","#8B6B55"]

export default function Game2Page() {
  const [heronState, setHeronState]   = useState<HeronState>("idle")
  const [drag, setDrag]               = useState<DragState | null>(null)
  const [isOverMouth, setIsOverMouth] = useState(false)
  const [spitSpecies, setSpitSpecies] = useState<string | null>(null)
  const [eaten, setEaten]             = useState<Set<string>>(new Set())
  const [score, setScore]             = useState(0)
  const [feedback, setFeedback]       = useState<"valid" | "invalid" | null>(null)
  const [positions, setPositions]     = useState<{ x: number; y: number }[]>([])
  const [locked, setLocked]           = useState(false)

  const mouthRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    setPositions(scatter(BUBBLE_SPECIES.length, w, h))
  }, [])

  const handleDragStart = useCallback((species: BubbleSpecies, el: HTMLElement) => {
    if (locked || eaten.has(species.scientific_name)) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const onMove = (e: PointerEvent) => {
      setDrag((p) => p ? { ...p, x: e.clientX - cx, y: e.clientY - cy } : null)
      const mr = mouthRef.current?.getBoundingClientRect()
      setIsOverMouth(!!mr &&
        e.clientX >= mr.left && e.clientX <= mr.right &&
        e.clientY >= mr.top  && e.clientY <= mr.bottom)
    }

    const onUp = async (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      const mr = mouthRef.current?.getBoundingClientRect()
      const dropped = !!mr &&
        e.clientX >= mr.left && e.clientX <= mr.right &&
        e.clientY >= mr.top  && e.clientY <= mr.bottom
      setDrag(null)
      setIsOverMouth(false)
      if (!dropped) return

      setLocked(true)
      setHeronState("chewing")

      try {
        const res = await checkFeed(PREDATOR, species.scientific_name)
        setTimeout(() => {
          if (res.valid) {
            setHeronState("happy")
            setEaten((p) => new Set([...p, species.scientific_name]))
            setScore((s) => s + 1)
            setFeedback("valid")
            setTimeout(() => { setHeronState("idle"); setFeedback(null); setLocked(false) }, 2600)
          } else {
            setHeronState("spit")
            setSpitSpecies(species.scientific_name)
            setFeedback("invalid")
            setTimeout(() => { setHeronState("idle"); setSpitSpecies(null); setFeedback(null); setLocked(false) }, 2400)
          }
        }, 2000)
      } catch {
        setHeronState("idle")
        setLocked(false)
      }
    }

    setDrag({ species, x: 0, y: 0, startX: cx, startY: cy })
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [locked, eaten])

  const activeBubbles = BUBBLE_SPECIES.filter((s) => !eaten.has(s.scientific_name))
  const fb = feedback ? FEEDBACK[feedback] : null

  return (
    <div
      className="wc-cursor"
      style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", userSelect: "none" }}
    >
      {/* ── Watercolor lake background ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url('/watercolor-lake-background.jpg')",
        backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
      }} />
      {/* White overlay to reduce dominance */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(255,255,255,0.30)" }} />
      {/* Warm parchment wash */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(244,237,211,0.18)" }} />
      {/* Contrast overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 500, pointerEvents: "none", background: "rgba(20,12,4,0.07)", mixBlendMode: "multiply" }} />

      {/* ── Score badge ── */}
      <div style={{
        position: "absolute", top: 20, left: 24, zIndex: 30,
        background: "rgba(244,237,211,0.92)",
        border: "1px solid rgba(92,61,46,0.22)",
        borderRadius: "4px 10px 5px 9px / 9px 4px 10px 5px",
        padding: "6px 14px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 2px 10px rgba(60,40,10,0.14)",
      }}>
        <span style={{ fontSize: 20 }}>🦤</span>
        <div style={{
          fontFamily: "var(--font-mansalva), cursive",
          fontSize: 18, color: "rgba(44,24,16,0.82)",
          letterSpacing: "0.02em",
        }}>
          {score} <span style={{ fontSize: 12, color: "rgba(92,61,46,0.55)" }}>/ {TOTAL_PREY}</span>
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{
        position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
        zIndex: 30, textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{
          fontFamily: "var(--font-mansalva), cursive",
          fontSize: 22, color: "rgba(44,24,16,0.82)",
          letterSpacing: "0.02em",
          textShadow: "1px 2px 0 rgba(255,255,255,0.5)",
        }}>
          Feed the Heron
        </div>
        <div style={{
          fontFamily: "var(--font-playfair), serif",
          fontStyle: "italic", fontSize: 11,
          color: "rgba(92,61,46,0.6)", marginTop: 2,
        }}>
          Drag specimens into its beak
        </div>
      </div>

      {/* ── Back link ── */}
      <a href="/game1" style={{
        position: "absolute", top: 24, right: 24, zIndex: 30,
        fontFamily: "var(--font-playfair), serif", fontStyle: "italic",
        fontSize: 12, color: "rgba(92,61,46,0.55)",
        textDecoration: "none", letterSpacing: "0.02em",
      }}>← Back</a>

      {/* ── Heron (top-right) ── */}
      <div style={{ position: "absolute", top: -10, right: 0, zIndex: 15 }}>
        <motion.div
          animate={heronState === "happy" ? { rotate: [-3, 3, -2, 2, 0], y: [0, -8, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          <HeronFace state={heronState} size={340} />
        </motion.div>
      </div>

      {/* ── Mouth hitbox ── */}
      <div
        ref={mouthRef}
        style={{
          position: "absolute", top: 208, right: 228,
          width: 95, height: 56, borderRadius: 14, zIndex: 20,
          background: "transparent",
        }}
      />

      {/* ── Floating specimen cards ── */}
      {positions.length > 0 && activeBubbles.map((species) => {
        const idx = BUBBLE_SPECIES.findIndex((s) => s.scientific_name === species.scientific_name)
        const pos = positions[idx] || { x: 400, y: 300 }
        return (
          <FloatingBubble
            key={species.scientific_name}
            species={species}
            initialX={pos.x}
            initialY={pos.y}
            size={BUBBLE_SIZE}
            onDragStart={handleDragStart}
            spit={spitSpecies === species.scientific_name}
            onSpitDone={() => setSpitSpecies(null)}
          />
        )
      })}

      {/* ── Drag ghost ── */}
      <AnimatePresence>
        {drag && (
          <motion.div style={{
            position: "fixed",
            left: drag.startX - 44, top: drag.startY - 44,
            x: drag.x, y: drag.y,
            pointerEvents: "none", zIndex: 100,
          }}
            initial={{ scale: 1 }}
            animate={{ scale: isOverMouth ? 0.65 : 1.12 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div style={{
              width: 88, height: 88,
              background: "rgba(255,252,238,0.95)",
              border: `2px solid ${isOverMouth ? "rgba(107,140,94,0.85)" : "rgba(92,61,46,0.4)"}`,
              borderRadius: "3px 10px 5px 8px / 8px 3px 10px 5px",
              overflow: "hidden",
              boxShadow: isOverMouth
                ? "0 0 24px rgba(107,140,94,0.5), 0 8px 24px rgba(60,40,10,0.25)"
                : "0 6px 24px rgba(60,40,10,0.3), 2px 3px 0 rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {drag.species.thumbnail_url && (
                <img
                  src={drag.species.thumbnail_url}
                  alt={drag.species.common_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover",
                    filter: "saturate(0.85) drop-shadow(1px 2px 3px rgba(60,40,10,0.2))" }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Feedback toast ── */}
      <AnimatePresence>
        {fb && (
          <motion.div style={{
            position: "absolute", top: "28%", left: "38%",
            transform: "translateX(-50%)",
            zIndex: 40, textAlign: "center", pointerEvents: "none",
          }}
            initial={{ scale: 0.5, opacity: 0, y: 20, rotate: -3 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
          >
            <div style={{
              background: fb.bg,
              border: `1.5px solid ${fb.border}`,
              borderRadius: "6px 16px 8px 14px / 14px 6px 16px 8px",
              padding: "16px 32px 18px",
              boxShadow: "0 8px 32px rgba(60,40,10,0.22), 2px 3px 0 rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 6 }}>{fb.emoji}</div>
              <div style={{
                fontFamily: "var(--font-mansalva), cursive",
                fontSize: 34, color: fb.color, lineHeight: 1.1,
                letterSpacing: "0.01em",
                textShadow: "1px 2px 0 rgba(255,255,255,0.4)",
              }}>{fb.headline}</div>
              <div style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic", fontSize: 14,
                color: "rgba(92,61,46,0.75)", marginTop: 6,
              }}>{fb.sub}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Win screen ── */}
      <AnimatePresence>
        {score === TOTAL_PREY && score > 0 && (
          <motion.div style={{
            position: "absolute", inset: 0, zIndex: 50,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(244,237,211,0.88)", backdropFilter: "blur(10px)",
          }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Falling leaves */}
            {[...Array(20)].map((_, i) => (
              <motion.div key={i} style={{
                position: "absolute",
                top: 0,
                left: `${5 + (i * 4.7) % 90}%`,
                fontSize: 18,
                pointerEvents: "none",
                color: LEAF_COLORS[i % LEAF_COLORS.length],
              }}
                animate={{ y: ["0vh", "105vh"], rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)], opacity: [0, 0.9, 0.8, 0] }}
                transition={{ duration: 2.5 + (i % 3) * 0.6, delay: i * 0.1, repeat: Infinity, ease: "linear" }}
              >
                {["🍂","🍃","🌿","🍁"][i % 4]}
              </motion.div>
            ))}

            {/* Card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
              style={{
                background: "linear-gradient(150deg, #FAF5E4 0%, #EDE0BC 100%)",
                border: "1.5px solid rgba(139,107,85,0.3)",
                borderRadius: "6px 18px 8px 16px / 16px 6px 18px 8px",
                padding: "36px 52px 40px",
                textAlign: "center",
                boxShadow: "0 24px 64px rgba(60,40,10,0.22), 2px 3px 0 rgba(255,255,255,0.4)",
                maxWidth: 420,
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 12 }}>🦤</div>
              <div style={{
                fontFamily: "var(--font-mansalva), cursive",
                fontSize: 38, color: "rgba(44,24,16,0.88)",
                letterSpacing: "0.01em", marginBottom: 10,
              }}>
                The Heron is full!
              </div>
              <div style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic", fontSize: 15,
                color: "rgba(92,61,46,0.7)", lineHeight: 1.6, marginBottom: 28,
              }}>
                You found all {score} of its favourite<br />specimens from the field guide.
              </div>
              <motion.button
                style={{
                  padding: "12px 36px",
                  fontFamily: "var(--font-mansalva), cursive",
                  fontSize: 16, color: "rgba(244,237,211,0.95)",
                  background: "rgba(107,140,94,0.88)",
                  border: "1.5px solid rgba(107,140,94,0.6)",
                  borderRadius: "4px 10px 5px 9px / 9px 4px 10px 5px",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(107,140,94,0.3)",
                }}
                whileHover={{ scale: 1.05, background: "rgba(107,140,94,0.98)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setEaten(new Set()); setScore(0); setHeronState("idle"); setLocked(false) }}
              >
                Play again →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
