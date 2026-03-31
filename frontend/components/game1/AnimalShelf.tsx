"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Species } from "@/lib/types"
import {
  getFieldSection,
  getSpeciesClues,
  getSpeciesLabel,
  getTaxonColor,
  getTrophicTier,
} from "@/lib/game1Hints"

interface AnimalShelfProps {
  species: Species[]
  loading: boolean
  onDragStart: (species: Species, originEl: HTMLElement) => void
  onInspectSpecies: (species: Species | null) => void
  placedSpecies: string[]
  focusSpecies: Species | null
  likelyMatches: string[]
}

const SECTION_ORDER = ["Producers", "Foragers", "Hunters"]

export default function AnimalShelf({
  species,
  loading,
  onDragStart,
  onInspectSpecies,
  placedSpecies,
  focusSpecies,
  likelyMatches,
}: AnimalShelfProps) {
  const [search, setSearch] = useState("")
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const likelyMatchSet = new Set(likelyMatches)

  const filtered = species.filter((entry) => {
    const query = search.toLowerCase().trim()
    if (!query) return true

    return (
      getSpeciesLabel(entry).toLowerCase().includes(query) ||
      entry.scientific_name.toLowerCase().includes(query) ||
      entry.taxon_class.toLowerCase().includes(query)
    )
  })

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    entries: filtered.filter((entry) => getFieldSection(entry) === section),
  })).filter((group) => group.entries.length > 0)

  return (
    <aside
      className="relative flex h-full min-h-0 flex-col"
      style={{
        width: "min(320px, 34vw)",
        minWidth: 250,
        background:
          "linear-gradient(180deg, rgba(49,34,20,0.97) 0%, rgba(28,20,12,0.98) 100%)",
        borderRight: "1px solid rgba(200,169,110,0.18)",
        boxShadow: "inset -18px 0 40px rgba(0,0,0,0.25)",
      }}
    >
      <div
        className="px-5 pt-5 pb-4"
        style={{
          borderBottom: "1px solid rgba(200,169,110,0.12)",
          background:
            "linear-gradient(180deg, rgba(215,194,162,0.08) 0%, rgba(215,194,162,0.02) 100%)",
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontFamily: "var(--font-medieval-display)",
            fontSize: 24,
            color: "#d7c2a2",
            letterSpacing: "0.03em",
          }}
        >
          Specimen Cabinet
        </p>
        <p
          style={{
            margin: "6px 0 0",
            textAlign: "center",
            fontFamily: "var(--font-manuscript)",
            fontSize: 13,
            color: "#9f8a6e",
          }}
        >
          Drag a card into the carved rings to test a food-web clue.
        </p>

        <div
          className="mt-4 rounded-md px-3 py-2"
          style={{
            background: "rgba(215,194,162,0.08)",
            border: "1px solid rgba(200,169,110,0.2)",
          }}
        >
          <input
            type="text"
            placeholder="Search the drawer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{
              fontFamily: "var(--font-manuscript)",
              fontSize: 14,
              color: "#e0cfb3",
              textAlign: "center",
            }}
          />
        </div>

        {focusSpecies && (
          <div
            className="mt-4 rounded-md px-3 py-3"
            style={{
              background: "rgba(140,154,91,0.08)",
              border: "1px solid rgba(140,154,91,0.28)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                textAlign: "center",
                color: "#c8a96e",
              }}
            >
              Field Clues
            </div>
            <div
              style={{
                marginTop: 8,
                textAlign: "center",
                fontFamily: "var(--font-manuscript)",
                fontSize: 16,
                color: "#efe0c7",
              }}
            >
              {getSpeciesLabel(focusSpecies)}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {getSpeciesClues(focusSpecies).slice(0, 3).map((clue) => (
                <span
                  key={clue.label}
                  className="rounded-full px-2 py-1"
                  style={{
                    border: "1px solid rgba(200,169,110,0.28)",
                    background: "rgba(0,0,0,0.12)",
                    fontFamily: "var(--font-display)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#cfbb98",
                  }}
                >
                  {clue.icon} {clue.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="rounded-lg"
                style={{
                  height: 96,
                  background: "rgba(215,194,162,0.08)",
                  border: "1px solid rgba(200,169,110,0.14)",
                }}
              />
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {grouped.map((group) => (
              <motion.section
                key={group.section}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mb-5"
              >
                <div
                  className="mb-3 rounded-md px-3 py-2"
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid rgba(200,169,110,0.12)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 11,
                      color: "#c8a96e",
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      textAlign: "center",
                    }}
                  >
                    {group.section}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {group.entries.map((entry, index) => {
                    const isPlaced = placedSpecies.includes(entry.scientific_name)
                    const tier = getTrophicTier(entry)
                    const isSuggested =
                      !!focusSpecies &&
                      !isPlaced &&
                      likelyMatchSet.has(entry.scientific_name) &&
                      focusSpecies.scientific_name !== entry.scientific_name

                    return (
                      <motion.div
                        key={entry.scientific_name}
                        layout
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: isPlaced ? 0.35 : 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        ref={(node) => {
                          itemRefs.current[entry.scientific_name] = node
                        }}
                        onPointerEnter={() => onInspectSpecies(entry)}
                        onPointerLeave={() => onInspectSpecies(null)}
                        onClick={() => onInspectSpecies(entry)}
                        onPointerDown={(e) => {
                          if (isPlaced) return
                          e.preventDefault()
                          const origin = itemRefs.current[entry.scientific_name]
                          if (origin) onDragStart(entry, origin)
                        }}
                        className="cursor-grab active:cursor-grabbing"
                        style={{
                          position: "relative",
                          borderRadius: 12,
                          padding: 12,
                          background:
                            "linear-gradient(180deg, rgba(220,201,171,0.94) 0%, rgba(188,162,126,0.88) 100%)",
                          border: isSuggested
                            ? "1px solid rgba(140,154,91,0.9)"
                            : "1px solid rgba(99,72,47,0.55)",
                          boxShadow: isSuggested
                            ? "0 0 0 1px rgba(140,154,91,0.28), 0 10px 22px rgba(0,0,0,0.2)"
                            : "0 10px 22px rgba(0,0,0,0.18)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: "#5b4330",
                            boxShadow: "0 1px 0 rgba(255,255,255,0.16)",
                          }}
                        />

                        {isSuggested && (
                          <div
                            className="absolute right-3 top-3 rounded-full px-2 py-1"
                            style={{
                              background: "rgba(108,123,82,0.16)",
                              border: "1px solid rgba(108,123,82,0.42)",
                              fontFamily: "var(--font-display)",
                              fontSize: 9,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "#465037",
                            }}
                          >
                            likely clue
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 10,
                              overflow: "hidden",
                              border: `2px solid ${getTaxonColor(entry)}`,
                              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                              background: "#463324",
                              flexShrink: 0,
                            }}
                          >
                            {entry.thumbnail_url && (
                              <img
                                src={entry.thumbnail_url}
                                alt={getSpeciesLabel(entry)}
                                className="h-full w-full object-cover"
                                style={{ filter: "saturate(0.82) sepia(0.12)" }}
                              />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div
                              style={{
                                fontFamily: "var(--font-manuscript)",
                                fontSize: 17,
                                lineHeight: 1.05,
                                textAlign: "center",
                                color: "#2f2016",
                              }}
                            >
                              {getSpeciesLabel(entry)}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontFamily: "var(--font-display)",
                                fontSize: 10,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                textAlign: "center",
                                color: "#6a4b2e",
                              }}
                            >
                              {entry.scientific_name}
                            </div>
                            <div className="mt-2 flex flex-wrap justify-center gap-2">
                              <span
                                className="rounded-full px-2 py-1"
                                style={{
                                  background: "rgba(0,0,0,0.08)",
                                  color: "#5c422b",
                                  fontFamily: "var(--font-display)",
                                  fontSize: 9,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {tier.icon} {tier.label}
                              </span>
                              <span
                                className="rounded-full px-2 py-1"
                                style={{
                                  background: "rgba(0,0,0,0.08)",
                                  color: "#5c422b",
                                  fontFamily: "var(--font-display)",
                                  fontSize: 9,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {entry.taxon_class || "Unknown"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        )}

        {!loading && filtered.length === 0 && (
          <div
            className="rounded-md px-4 py-8"
            style={{
              background: "rgba(215,194,162,0.08)",
              border: "1px solid rgba(200,169,110,0.15)",
            }}
          >
            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontFamily: "var(--font-manuscript)",
                fontSize: 16,
                color: "#d7c2a2",
              }}
            >
              No specimen matches this search.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
