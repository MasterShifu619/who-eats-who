"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import HeronFace, { HeronState } from "@/components/game2/HeronFace"
import FloatingBubble, { BubbleSpecies } from "@/components/game2/FloatingBubble"
import { checkFeed } from "@/lib/api"

const PREDATOR = "Ardea herodias"

// Clean species portrait URLs from iNaturalist taxa pages
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
const BUBBLE_SIZE = 96
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
  valid:   { emoji: "😋", headline: "YUMMY!",  sub: "Great Blue Herons eat that!",  color: "#4ADE80" },
  invalid: { emoji: "🤢", headline: "NOPE!",   sub: "Herons don't eat that!",       color: "#F87171" },
}

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
    <div style={{
      width: "100vw", height: "100vh",
      background: "linear-gradient(135deg, #0D1B2A 0%, #1A2F4A 50%, #0D1B2A 100%)",
      overflow: "hidden", position: "relative", userSelect: "none",
    }}>

      {/* Stars */}
      {[...Array(40)].map((_, i) => (
        <motion.div key={i} style={{
          position: "absolute",
          width: i % 5 === 0 ? 3 : 2, height: i % 5 === 0 ? 3 : 2,
          borderRadius: "50%", background: "white",
          left: `${(i * 7.3 + 5) % 100}%`,
          top: `${(i * 13.7 + 8) % 100}%`,
          opacity: 0.25 + (i % 4) * 0.1,
          pointerEvents: "none",
        }}
          animate={{ opacity: [0.15, 0.6, 0.15] }}
          transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.15 }}
        />
      ))}

      {/* Score — top left */}
      <div style={{
        position: "absolute", top: 20, left: 28, zIndex: 20,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 26 }}>🐟</span>
        <div style={{
          fontFamily: "system-ui, sans-serif", fontWeight: 900,
          fontSize: 22, color: "#4ADE80",
          textShadow: "0 0 20px rgba(74,222,128,0.6)",
        }}>
          {score} / {TOTAL_PREY}
        </div>
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
        zIndex: 20, textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{
          fontFamily: "system-ui, sans-serif", fontWeight: 900,
          fontSize: 20, color: "white",
          textShadow: "0 2px 12px rgba(0,0,0,0.6)", letterSpacing: "0.04em",
        }}>
          🦤 Feed the Heron!
        </div>
        <div style={{
          fontFamily: "system-ui, sans-serif", fontWeight: 600,
          fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2,
        }}>
          Drag animals into its beak
        </div>
      </div>

      {/* Back */}
      <a href="/game1" style={{
        position: "absolute", top: 22, right: 24, zIndex: 20,
        fontFamily: "system-ui, sans-serif", fontWeight: 700,
        fontSize: 13, color: "rgba(255,255,255,0.4)",
        textDecoration: "none",
      }}>Back →</a>

      {/* Heron — top right, beak drawn pointing left */}
      <div style={{
        position: "absolute",
        top: -10,
        right: 0,
        zIndex: 15,
      }}>
        <motion.div
          animate={heronState === "happy" ? { rotate: [-3, 3, -2, 2, 0], y: [0, -8, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          <HeronFace state={heronState} size={340} />
        </motion.div>
      </div>

      {/* Mouth hitbox — over the beak tip (right side of screen, mid height) */}
      <div
        ref={mouthRef}
        style={{
          position: "absolute",
          top: 208,
          right: 228,
          width: 95,
          height: 56,
          borderRadius: 14,
          zIndex: 20,
          border: "none",
          background: "transparent",
          transition: "all 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >

      </div>

      {/* Floating bubbles */}
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

      {/* Drag ghost */}
      <AnimatePresence>
        {drag && (
          <motion.div style={{
            position: "fixed",
            left: drag.startX - 48, top: drag.startY - 48,
            x: drag.x, y: drag.y,
            pointerEvents: "none", zIndex: 100,
          }}
            initial={{ scale: 1 }}
            animate={{ scale: isOverMouth ? 0.65 : 1.15 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div style={{
              width: 96, height: 96, borderRadius: "50%", overflow: "hidden",
              border: `3px solid ${isOverMouth ? "#4ADE80" : "rgba(255,255,255,0.7)"}`,
              boxShadow: isOverMouth
                ? "0 0 40px rgba(74,222,128,0.6), 0 8px 32px rgba(0,0,0,0.8)"
                : "0 8px 32px rgba(0,0,0,0.8)",
            }}>
              {drag.species.thumbnail_url && (
                <img src={drag.species.thumbnail_url} alt={drag.species.common_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback */}
      <AnimatePresence>
        {fb && (
          <motion.div style={{
            position: "absolute", top: "32%", left: "38%",
            transform: "translateX(-50%)",
            zIndex: 40, textAlign: "center", pointerEvents: "none",
          }}
            initial={{ scale: 0.3, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            <div style={{ fontSize: 72, lineHeight: 1 }}>{fb.emoji}</div>
            <div style={{
              fontFamily: "system-ui, sans-serif", fontWeight: 900,
              fontSize: 52, color: fb.color, lineHeight: 1.1,
              textShadow: `0 0 30px ${fb.color}88, 0 4px 12px rgba(0,0,0,0.8)`,
              marginTop: 8,
            }}>{fb.headline}</div>
            <div style={{
              fontFamily: "system-ui, sans-serif", fontWeight: 700,
              fontSize: 18, color: "rgba(255,255,255,0.9)",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)", marginTop: 6,
            }}>{fb.sub}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win */}
      <AnimatePresence>
        {score === TOTAL_PREY && score > 0 && (
          <motion.div style={{
            position: "absolute", inset: 0, zIndex: 50,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {[...Array(24)].map((_, i) => (
              <motion.div key={i} style={{
                position: "absolute", width: 12, height: 12, borderRadius: "50%",
                background: ["#4ADE80","#60A5FA","#FBBF24","#F87171","#A78BFA"][i % 5],
                left: `${5 + (i * 4.1) % 90}%`, top: "10%",
              }}
                animate={{ y: ["0vh","90vh"], rotate: [0, 360*(i%2===0?1:-1)], opacity:[1,0] }}
                transition={{ duration: 2+(i%3)*0.5, delay: i*0.08, repeat: Infinity, ease: "linear" }}
              />
            ))}
            <motion.div style={{ fontSize: 80 }}
              animate={{ scale:[1,1.2,1], rotate:[-5,5,-5,5,0] }}
              transition={{ duration: 0.6, repeat: 2 }}
            >🎉</motion.div>
            <motion.div style={{
              fontFamily: "system-ui, sans-serif", fontWeight: 900,
              fontSize: 52, color: "#4ADE80",
              textShadow: "0 0 40px rgba(74,222,128,0.8)",
              marginTop: 16, textAlign: "center",
            }} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              The Heron is full! 🦤
            </motion.div>
            <motion.div style={{
              fontFamily: "system-ui, sans-serif", fontWeight: 700,
              fontSize: 22, color: "rgba(255,255,255,0.85)",
              marginTop: 12, textAlign: "center",
            }} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              You found all {score} of its favourite foods!
            </motion.div>
            <motion.button style={{
              marginTop: 40, padding: "16px 48px",
              fontFamily: "system-ui, sans-serif", fontWeight: 800,
              fontSize: 18, color: "#0D1B2A",
              background: "#4ADE80", border: "none",
              borderRadius: 50, cursor: "pointer",
              boxShadow: "0 8px 32px rgba(74,222,128,0.4)",
            }}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              onClick={() => { setEaten(new Set()); setScore(0); setHeronState("idle"); setLocked(false) }}
            >
              🔄 Play Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}