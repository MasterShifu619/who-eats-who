"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Species } from "@/lib/types"
import { getLocalAnimalImage, } from "@/components/game1/AnimalShelf"

interface DropZoneProps {
  zoneId: "A" | "B"
  species: Species | null
  isOver: boolean
  label: string
  onClear: () => void
  isKeyboardTarget?: boolean
  onKeyboardDrop?: () => void
}

// Two slightly different blob shapes for A & B
const BLOB_SHAPES = {
  A: {
    idle:  "60% 40% 55% 45% / 45% 55% 40% 60%",
    hover: "50% 50% 60% 40% / 55% 45% 50% 50%",
    mid:   "45% 55% 50% 50% / 60% 40% 55% 45%",
  },
  B: {
    idle:  "45% 55% 60% 40% / 55% 45% 50% 50%",
    hover: "60% 40% 50% 50% / 45% 55% 60% 40%",
    mid:   "55% 45% 45% 55% / 50% 50% 55% 45%",
  },
}

// Trophic-level background washes for placed animals
const ZONE_COLORS = {
  A: { idle: "rgba(244,237,211,0.80)", hover: "rgba(212,168,71,0.28)", filled: "rgba(232,216,176,0.88)" },
  B: { idle: "rgba(244,237,211,0.80)", hover: "rgba(212,168,71,0.28)", filled: "rgba(232,216,176,0.88)" },
}

export default function DropZone({ zoneId, species, isOver, label, onClear, isKeyboardTarget, onKeyboardDrop }: DropZoneProps) {
  const [hoverInner, setHoverInner] = useState(false)
  const size = 168

  const shape = BLOB_SHAPES[zoneId]
  const colors = ZONE_COLORS[zoneId]

  const bg = isOver
    ? colors.hover
    : species
    ? colors.filled
    : colors.idle

  const borderRadius = isOver ? shape.hover : shape.idle
  const kbGlow = isKeyboardTarget && !species
    ? "0 0 0 3px rgba(107,140,94,0.7), 0 6px 28px rgba(107,140,94,0.3)"
    : undefined

  const localImg = species ? getLocalAnimalImage(species) : null

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Zone label */}
      <span
        style={{
          fontFamily: "var(--font-playfair), serif",
          fontStyle: "italic",
          fontSize: 12,
          color: "rgba(92,61,46,0.65)",
          letterSpacing: "0.04em",
        }}
      >
        {species ? (species.common_name || species.scientific_name) : label}
      </span>

      {/* Blob drop zone */}
      <motion.div
        className={isOver ? "wc-blob-animate" : ""}
        role={isKeyboardTarget && !species ? "button" : undefined}
        tabIndex={isKeyboardTarget && !species ? 0 : -1}
        aria-label={species
          ? `${label}: ${species.common_name || species.scientific_name}`
          : `${label}, empty${isKeyboardTarget ? " — press Enter to place selected animal" : ""}`}
        onKeyDown={(e) => {
          if (isKeyboardTarget && !species && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault(); onKeyboardDrop?.()
          }
        }}
        style={{
          width: size,
          height: size,
          borderRadius,
          background: bg,
          backdropFilter: "blur(4px)",
          border: isOver
            ? "2px solid rgba(212,168,71,0.6)"
            : isKeyboardTarget && !species
            ? "2px solid rgba(107,140,94,0.7)"
            : species
            ? "1.5px solid rgba(92,61,46,0.3)"
            : "1.5px dashed rgba(92,61,46,0.25)",
          boxShadow: kbGlow ?? (isOver
            ? "0 6px 28px rgba(212,168,71,0.22), inset 0 2px 12px rgba(212,168,71,0.08)"
            : species
            ? "0 4px 20px rgba(60,40,10,0.16), inset 0 1px 6px rgba(255,255,255,0.3)"
            : "0 2px 12px rgba(60,40,10,0.10), inset 0 1px 4px rgba(255,255,255,0.2)"),
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-radius 0.35s ease-in-out, background 0.35s ease-in-out, border 0.3s ease, box-shadow 0.3s ease",
          filter: "url(#watercolor-edge)",
        }}
        animate={{
          borderRadius: isOver
            ? [shape.idle, shape.hover, shape.mid, shape.hover]
            : shape.idle,
        }}
        transition={{ duration: isOver ? 2 : 0.4, repeat: isOver ? Infinity : 0, ease: "easeInOut" }}
        onPointerEnter={() => setHoverInner(true)}
        onPointerLeave={() => setHoverInner(false)}
      >
        {/* Empty state */}
        <AnimatePresence>
          {!species && !isOver && (
            <motion.div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Organic + icon */}
              <svg width={36} height={36} viewBox="0 0 36 36" fill="none">
                <circle
                  cx={18} cy={18} r={15}
                  stroke="rgba(92,61,46,0.25)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <path
                  d="M18 11v14M11 18h14"
                  stroke="rgba(92,61,46,0.22)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </svg>
              <span
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 10,
                  color: "rgba(92,61,46,0.4)",
                  letterSpacing: "0.05em",
                  textAlign: "center",
                  maxWidth: 100,
                  lineHeight: 1.4,
                }}
              >
                Drop a creature here…
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Over state hint */}
        <AnimatePresence>
          {isOver && !species && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mansalva), cursive",
                  fontSize: 24,
                  color: "rgba(160,82,45,0.6)",
                }}
              >
                ✦
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Placed animal */}
        <AnimatePresence>
          {species && (
            <motion.div
              key={species.scientific_name}
              initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.3, opacity: 0, rotate: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              {localImg ? (
                <img
                  src={localImg}
                  alt={species.common_name || species.scientific_name}
                  aria-label={species.common_name || species.scientific_name}
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: "contain",
                    
                    filter: "drop-shadow(2px 4px 8px rgba(60,40,10,0.28))",
                  }}
                />
              ) : species.thumbnail_url ? (
                <img
                  src={species.thumbnail_url}
                  alt={species.common_name || species.scientific_name}
                  aria-label={species.common_name || species.scientific_name}
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: "50%",
                    filter: "drop-shadow(2px 4px 8px rgba(60,40,10,0.28))",
                    opacity: 0.92,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 56,
                    filter: "drop-shadow(2px 4px 8px rgba(60,40,10,0.28))",
                  }}
                  aria-label={species.common_name || species.scientific_name}
                >
                  🐾
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clear button */}
        {species && (
          <motion.button
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(244,237,211,0.9)",
              border: "1px solid rgba(92,61,46,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(60,40,10,0.15)",
            }}
            whileHover={{ scale: 1.2, borderColor: "rgba(160,82,45,0.6)" }}
            onClick={onClear}
            aria-label="Clear animal"
          >
            <span style={{ color: "rgba(92,61,46,0.7)", fontSize: 10, lineHeight: 1 }}>✕</span>
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
