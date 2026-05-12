"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getNCSpecies } from "@/lib/api"
import type { Species } from "@/lib/types"

interface AnimalShelfProps {
  onDragStart: (species: Species, originEl: HTMLElement, localImage: string | null) => void
  onKeyboardSelect: (species: Species, localImage: string | null) => void
  placedSpecies: string[]
}

// Map species common name keywords → local PNG assets
const PNG_MAP: [string, string][] = [
  ["butterfly", "/Butterfly.svg"],
  ["crab",      "/Crab.svg"],
  ["dragonfly", "/Dragonfly.svg"],
  ["fish",      "/Fish.svg"],
  ["perch",     "/Fish.svg"],
  ["bass",      "/Fish.svg"],
  ["trout",     "/Fish.svg"],
  ["sunfish",   "/Fish.svg"],
  ["catfish",   "/Fish.svg"],
  ["shiner",    "/Fish.svg"],
  ["bluegill",  "/Fish.svg"],
  ["crappie",   "/Fish.svg"],
  ["frog",      "/Frog.svg"],
  ["toad",      "/Frog.svg"],
]

export function getLocalAnimalImage(species: Species): string | null {
  const name = (species.common_name || species.scientific_name).toLowerCase()
  for (const [keyword, path] of PNG_MAP) {
    if (name.includes(keyword)) return path
  }
  return null
}

// Deterministic emoji fallback keyed to taxon class
function getTaxonEmoji(species: Species): string {
  const cls = (species.taxon_class || "").toLowerCase()
  if (cls.includes("aves"))         return "🐦"
  if (cls.includes("mammalia"))     return "🦝"
  if (cls.includes("reptilia"))     return "🦎"
  if (cls.includes("amphibia"))     return "🐸"
  if (cls.includes("actinopterygii") || cls.includes("fish")) return "🐟"
  if (cls.includes("insecta"))      return "🦋"
  if (cls.includes("arachnida"))    return "🕷️"
  if (cls.includes("crustacea"))    return "🦀"
  if (cls.includes("plantae"))      return "🌿"
  return "🐾"
}

export default function AnimalShelf({ onDragStart, onKeyboardSelect, placedSpecies }: AnimalShelfProps) {
  const [species, setSpecies] = useState<Species[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")
  const itemRefs = useRef<Record<string, HTMLElement>>({})

  useEffect(() => {
    getNCSpecies().then(setSpecies).finally(() => setLoading(false))
  }, [])

  const filtered = species.filter((s) => {
    const q = search.toLowerCase()
    return (
      (s.common_name || "").toLowerCase().includes(q) ||
      s.scientific_name.toLowerCase().includes(q)
    )
  })

  return (
    <div
      className="relative flex flex-col h-full"
      style={{
        width: 152,
        /* Parchment panel with watercolor-edge filter */
        background: "rgba(244, 237, 211, 0.88)",
        backdropFilter: "blur(6px)",
        borderRight: "1px solid rgba(92,61,46,0.2)",
        boxShadow: "inset -4px 0 20px rgba(92,61,46,0.06), 4px 0 24px rgba(44,24,16,0.12)",
        filter: "url(#watercolor-edge)",
      }}
    >
      {/* Header tray label */}
      <div
        style={{
          padding: "18px 12px 10px",
          flexShrink: 0,
          borderBottom: "1px solid rgba(92,61,46,0.15)",
          background: "rgba(232,216,180,0.6)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-mansalva), cursive",
            fontSize: 16,
            color: "rgba(44, 24, 16, 0.8)",
            margin: "0 0 8px 0",
            letterSpacing: "0.02em",
          }}
        >
          Creatures
        </h2>

        {/* Search — styled as naturalist field note */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,252,240,0.7)",
              outline: "none",
              border: "none",
              borderBottom: "1.5px solid rgba(92,61,46,0.3)",
              fontFamily: "var(--font-playfair), serif",
              fontStyle: "italic",
              fontSize: 11,
              color: "rgba(92,61,46,0.9)",
              padding: "4px 2px",
              letterSpacing: "0.03em",
            }}
          />
        </div>
      </div>

      {/* Scrollable species list */}
      <div
        className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-2"
        style={{ scrollbarWidth: "none" }}
      >
        {loading ? (
          // Skeleton loading specimens
          <div className="flex flex-col gap-3 items-center pt-3">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                style={{
                  width: 120,
                  height: 96,
                  borderRadius: 3,
                  background: "rgba(200,185,145,0.4)",
                }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((s, i) => {
              const isPlaced = placedSpecies.includes(s.scientific_name)
              const localImg = getLocalAnimalImage(s)
              const emoji    = getTaxonEmoji(s)
              const label    = s.common_name || s.scientific_name

              return (
                <motion.div
                  key={s.scientific_name}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: isPlaced ? 0.35 : 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ delay: i * 0.035, duration: 0.28, ease: "easeOut" }}
                  ref={(el) => { if (el) itemRefs.current[s.scientific_name] = el }}
                >
                  <SpecimenCard
                    species={s}
                    label={label}
                    localImg={localImg}
                    emoji={emoji}
                    isPlaced={isPlaced}
                    onDragStart={(e) => {
                      if (isPlaced) return
                      e.preventDefault()
                      const el = itemRefs.current[s.scientific_name]
                      if (el) onDragStart(s, el, localImg)
                    }}
                    onKeyboardSelect={() => {
                      if (!isPlaced) onKeyboardSelect(s, localImg)
                    }}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {!loading && filtered.length === 0 && (
          <p
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontStyle: "italic",
              fontSize: 11,
              color: "rgba(92,61,46,0.5)",
              textAlign: "center",
              paddingTop: 24,
            }}
          >
            No creatures found
          </p>
        )}
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(244,237,211,0.9), transparent)" }}
      />
    </div>
  )
}

// ─── Specimen Card ────────────────────────────────────────────────────────────
interface SpecimenCardProps {
  species: Species
  label: string
  localImg: string | null
  emoji: string
  isPlaced: boolean
  onDragStart: (e: React.PointerEvent) => void
  onKeyboardSelect: () => void
}

function SpecimenCard({ label, localImg, emoji, isPlaced, onDragStart, onKeyboardSelect, species }: SpecimenCardProps) {
  const [hover, setHover] = useState(false)

  return (
    <motion.div
      className="select-none"
      role="button"
      tabIndex={isPlaced ? -1 : 0}
      aria-label={isPlaced ? `${label}, already placed` : `Select ${label}`}
      aria-disabled={isPlaced}
      onKeyDown={(e) => {
        if (isPlaced) return
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onKeyboardSelect() }
      }}
      style={{
        /* Deckle-edge card via clip + border-radius trick */
        background: "rgba(255, 252, 238, 0.92)",
        borderRadius: "3px 8px 4px 7px / 6px 3px 8px 4px",
        border: "1px solid rgba(92,61,46,0.18)",
        padding: "8px 6px 6px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        cursor: isPlaced ? "default" : "grab",
        boxShadow: hover && !isPlaced
          ? "0 4px 16px rgba(60,40,10,0.2), 1px 1px 0 rgba(255,255,255,0.6)"
          : "0 2px 8px rgba(60,40,10,0.12), 1px 1px 0 rgba(255,255,255,0.5)",
        transition: "box-shadow 0.3s ease, transform 0.3s ease",
        transform: hover && !isPlaced ? "rotate(1.5deg) scale(1.03)" : "rotate(0deg) scale(1)",
        touchAction: "none",
        filter: isPlaced ? "grayscale(0.4)" : "none",
      }}
      onPointerDown={onDragStart}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {/* Animal illustration */}
      <div
        style={{
          width: 80,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {localImg ? (
          <img
            src={localImg}
            alt={label}
            aria-label={label}
            style={{
              width: 80,
              height: 64,
              objectFit: "contain",
              
              filter: "drop-shadow(2px 3px 6px rgba(60,40,10,0.25))",
            }}
          />
        ) : species.thumbnail_url ? (
          <img
            src={species.thumbnail_url}
            alt={label}
            aria-label={label}
            style={{
              width: 80,
              height: 64,
              objectFit: "cover",
              borderRadius: 2,
              filter: "drop-shadow(1px 2px 4px rgba(60,40,10,0.2)) saturate(0.85)",
              opacity: 0.9,
            }}
          />
        ) : (
          <span
            style={{ fontSize: 36, filter: "drop-shadow(1px 2px 4px rgba(60,40,10,0.2))" }}
            aria-label={label}
          >
            {emoji}
          </span>
        )}
      </div>

      {/* Specimen label */}
      <div
        style={{
          width: "100%",
          borderTop: "1px solid rgba(92,61,46,0.12)",
          paddingTop: 4,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 9,
            color: "rgba(44,24,16,0.75)",
            letterSpacing: "0.03em",
            lineHeight: 1.3,
            display: "block",
            maxWidth: 118,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
    </motion.div>
  )
}
