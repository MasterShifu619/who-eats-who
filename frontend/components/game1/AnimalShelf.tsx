"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import AnimalBlob from "@/components/ui/AnimalBlob"
import { getNCSpecies } from "@/lib/api"
import type { Species } from "@/lib/types"

interface AnimalShelfProps {
  onDragStart: (species: Species, originEl: HTMLElement) => void
  placedSpecies: string[] // scientific names already in drop zones
}

export default function AnimalShelf({ onDragStart, placedSpecies }: AnimalShelfProps) {
  const [species, setSpecies] = useState<Species[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const itemRefs = useRef<Record<string, HTMLElement>>({})

  useEffect(() => {
    getNCSpecies()
      .then(setSpecies)
      .finally(() => setLoading(false))
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
        width: 140,
        background: "linear-gradient(180deg, #1A1208 0%, #120D06 100%)",
        borderRight: "1px solid #2E2010",
      }}
    >
      {/* Header */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "#6B5A3E",
            textTransform: "uppercase",
          }}
        >
          Creatures
        </h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2 w-full bg-transparent outline-none"
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 10,
            color: "#8B7355",
            borderBottom: "1px solid #2E2010",
            padding: "4px 0",
            letterSpacing: "0.05em",
          }}
        />
      </div>

      {/* Scrollable species list */}
      <div
        className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-3"
        style={{ scrollbarWidth: "none" }}
      >
        {loading ? (
          <div className="flex flex-col gap-3 items-center pt-4">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="rounded-full bg-stone-900"
                style={{ width: 72, height: 72 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((s, i) => {
              const isPlaced = placedSpecies.includes(s.scientific_name)
              return (
                <motion.div
                  key={s.scientific_name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: isPlaced ? 0.35 : 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="flex justify-center"
                  ref={(el) => {
                    if (el) itemRefs.current[s.scientific_name] = el
                  }}
                >
                  <AnimalBlob
                    species={s}
                    size={80}
                    selected={isPlaced}
                    onDragStart={(e) => {
                      if (isPlaced) return
                      e.preventDefault()
                      const el = itemRefs.current[s.scientific_name]
                      if (el) onDragStart(s, el)
                    }}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}

        {!loading && filtered.length === 0 && (
          <p
            className="text-center pt-8"
            style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: "#4A3D2A" }}
          >
            No creatures found
          </p>
        )}
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
        style={{
          background: "linear-gradient(to top, #120D06, transparent)",
        }}
      />
    </div>
  )
}