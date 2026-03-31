"use client"

import { motion, AnimatePresence } from "framer-motion"
import AnimalBlob from "@/components/ui/AnimalBlob"
import type { Species } from "@/lib/types"
import { getSpeciesClues, getSpeciesLabel, getTaxonColor } from "@/lib/game1Hints"

interface FieldDropZoneProps {
  zoneId: "A" | "B"
  species: Species | null
  isOver: boolean
  label: string
  hint: string
  onClear: () => void
}

export default function FieldDropZone({
  zoneId,
  species,
  isOver,
  label,
  hint,
  onClear,
}: FieldDropZoneProps) {
  const size = 220
  const accent = species ? getTaxonColor(species) : "#8B7355"

  return (
    <div className="relative flex flex-col items-center gap-3">
      <div
        style={{
          textAlign: "center",
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "#bda37f",
        }}
      >
        {label}
      </div>

      <motion.div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 35% 30%, rgba(215,194,162,0.15), transparent 26%), radial-gradient(circle at center, #3a291b 0%, #1a120c 65%, #120d08 100%)",
          border: "1px solid rgba(200,169,110,0.18)",
          boxShadow:
            "inset 0 0 28px rgba(255,240,210,0.06), inset 0 -22px 32px rgba(0,0,0,0.46), 0 24px 44px rgba(0,0,0,0.32)",
        }}
        animate={{
          scale: isOver ? 1.03 : 1,
          boxShadow: isOver
            ? "inset 0 0 28px rgba(255,240,210,0.08), inset 0 -22px 32px rgba(0,0,0,0.46), 0 0 0 1px rgba(200,169,110,0.24), 0 0 44px rgba(200,169,110,0.18)"
            : "inset 0 0 28px rgba(255,240,210,0.06), inset 0 -22px 32px rgba(0,0,0,0.46), 0 24px 44px rgba(0,0,0,0.32)",
        }}
        transition={{ duration: 0.25 }}
      >
        <svg
          className="absolute inset-0"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: "visible" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 10}
            fill="none"
            stroke="rgba(215,194,162,0.14)"
            strokeWidth={14}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 18}
            fill="none"
            stroke={species ? accent : "#6a543c"}
            strokeWidth={2.2}
            strokeDasharray="7 10"
          />
          <path
            d={`M ${size / 2 - 28} ${size / 2} L ${size / 2 + 28} ${size / 2}`}
            stroke="rgba(215,194,162,0.18)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <path
            d={`M ${size / 2} ${size / 2 - 28} L ${size / 2} ${size / 2 + 28}`}
            stroke="rgba(215,194,162,0.18)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>

        <AnimatePresence mode="wait">
          {!species ? (
            <motion.div
              key={`empty-${zoneId}`}
              className="flex flex-col items-center gap-3 px-8"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
            >
              <div
                style={{
                  fontFamily: "var(--font-medieval-display)",
                  fontSize: 26,
                  color: "#cfbb98",
                }}
              >
                {zoneId}
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "var(--font-manuscript)",
                  fontSize: 15,
                  lineHeight: 1.3,
                  color: "#ddc9aa",
                  maxWidth: 150,
                }}
              >
                {hint}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={species.scientific_name}
              className="flex flex-col items-center gap-3"
              initial={{ scale: 0.38, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.38, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              <AnimalBlob species={species} size={126} selected />
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "var(--font-manuscript)",
                  fontSize: 18,
                  color: "#eddabf",
                  maxWidth: 150,
                  lineHeight: 1.05,
                }}
              >
                {getSpeciesLabel(species)}
              </div>
              <div className="flex flex-wrap justify-center gap-2 px-6">
                {getSpeciesClues(species).slice(0, 2).map((clue) => (
                  <span
                    key={clue.label}
                    className="rounded-full px-2 py-1"
                    style={{
                      border: "1px solid rgba(215,194,162,0.18)",
                      background: "rgba(0,0,0,0.18)",
                      fontFamily: "var(--font-display)",
                      fontSize: 9,
                      color: "#cfbb98",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {clue.icon} {clue.label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {species && (
          <button
            type="button"
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: "rgba(0,0,0,0.34)",
              border: "1px solid rgba(215,194,162,0.2)",
              color: "#d7c2a2",
              fontFamily: "var(--font-display)",
            }}
            onClick={onClear}
          >
            x
          </button>
        )}
      </motion.div>
    </div>
  )
}
