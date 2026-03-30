"use client"

import { motion, AnimatePresence } from "framer-motion"
import AnimalBlob from "@/components/ui/AnimalBlob"
import type { Species } from "@/lib/types"

interface DropZoneProps {
  zoneId: "A" | "B"
  species: Species | null
  isOver: boolean
  label: string
  onClear: () => void
}

export default function DropZone({ zoneId, species, isOver, label, onClear }: DropZoneProps) {
  const size = 180

  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* Zone label */}
      <span
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 11,
          letterSpacing: "0.25em",
          color: "#4A3D2A",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      {/* Drop circle */}
      <motion.div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: isOver
            ? "radial-gradient(circle, #2A1F0F 0%, #1A1208 100%)"
            : "radial-gradient(circle, #1E1609 0%, #120D06 100%)",
        }}
        animate={{
          boxShadow: isOver
            ? "0 0 40px rgba(200, 169, 110, 0.25), inset 0 0 30px rgba(0,0,0,0.5)"
            : species
            ? "0 0 20px rgba(200, 169, 110, 0.1), inset 0 0 20px rgba(0,0,0,0.5)"
            : "inset 0 0 20px rgba(0,0,0,0.5)",
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Dashed border ring */}
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
            r={size / 2 - 4}
            fill="none"
            stroke={isOver ? "#C8A96E" : species ? "#5C4A2A" : "#2E2010"}
            strokeWidth={isOver ? 2 : 1.5}
            strokeDasharray={isOver ? "0" : "6 4"}
            style={{ transition: "all 0.3s ease" }}
          />

          {/* Glowing ring when over */}
          {isOver && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 2}
              fill="none"
              stroke="#C8A96E"
              strokeWidth={1}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.08 }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
            />
          )}
        </svg>

        {/* Empty state hint */}
        <AnimatePresence>
          {!species && !isOver && (
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                <circle cx={16} cy={16} r={14} stroke="#2E2010" strokeWidth={1.5} strokeDasharray="3 3" />
                <path d="M16 10v12M10 16h12" stroke="#2E2010" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
              <span
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  color: "#2E2010",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Drop here
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dropped animal */}
        <AnimatePresence>
          {species && (
            <motion.div
              key={species.scientific_name}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center justify-center"
            >
              <AnimalBlob species={species} size={120} selected />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clear button */}
        {species && (
          <motion.button
            className="absolute top-2 right-2 rounded-full flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              background: "#1A1208",
              border: "1px solid #3E3020",
            }}
            whileHover={{ scale: 1.2, borderColor: "#C8A96E" }}
            onClick={onClear}
          >
            <span style={{ color: "#6B5A3E", fontSize: 10, lineHeight: 1 }}>✕</span>
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}