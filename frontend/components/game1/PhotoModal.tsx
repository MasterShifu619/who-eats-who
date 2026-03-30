"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { WhoEatsWhomResult } from "@/lib/types"

interface PhotoModalProps {
  result: WhoEatsWhomResult | null
  speciesAName: string
  speciesBName: string
  onClose: () => void
  onAddToNetwork: () => void
}

const FEEDING_TYPE_LABELS: Record<string, string> = {
  "Pollination": "pollinator of",
  "Parasitism": "parasite of",
  "Scavenging": "scavenges",
  "No, none of these": "eats",
  "": "eats",
}

function getRelationshipLabel(feedingType: string, predator: string, prey: string): string {
  const verb = FEEDING_TYPE_LABELS[feedingType] ?? "interacts with"
  return `${predator} ${verb} ${prey}`
}

export default function PhotoModal({
  result,
  speciesAName,
  speciesBName,
  onClose,
  onAddToNetwork,
}: PhotoModalProps) {
  if (!result) return null

  const hasRelationship = result.direction !== "none"
  const relationship = result.relationship_a_eats_b || result.relationship_b_eats_a
  const predatorName =
    result.direction === "a_eats_b" ? speciesAName
    : result.direction === "b_eats_a" ? speciesBName
    : speciesAName
  const preyName =
    result.direction === "a_eats_b" ? speciesBName
    : result.direction === "b_eats_a" ? speciesAName
    : speciesBName

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(8, 6, 2, 0.85)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          className="relative flex flex-col overflow-hidden"
          style={{
            width: 480,
            maxWidth: "90vw",
            background: "linear-gradient(160deg, #1E1609 0%, #120D06 100%)",
            border: "1px solid #3E3020",
            borderRadius: 4,
            boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(200,169,110,0.05)",
          }}
          initial={{ scale: 0.85, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Corner decorations */}
          {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos) => (
            <div
              key={pos}
              className={`absolute ${pos} w-4 h-4`}
              style={{
                borderTop: pos.includes("top") ? "1px solid #6B5A3E" : "none",
                borderBottom: pos.includes("bottom") ? "1px solid #6B5A3E" : "none",
                borderLeft: pos.includes("left") ? "1px solid #6B5A3E" : "none",
                borderRight: pos.includes("right") ? "1px solid #6B5A3E" : "none",
              }}
            />
          ))}

          {hasRelationship && relationship?.image_url ? (
            <>
              {/* Photo */}
              <div className="relative w-full" style={{ height: 260 }}>
                <img
                  src={relationship.image_url}
                  alt="Feeding interaction"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.9 }}
                />
                {/* Dark gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(18,13,6,0.95) 100%)",
                  }}
                />

                {/* iNaturalist badge */}
                <div
                  className="absolute top-3 right-3 px-2 py-1"
                  style={{
                    background: "rgba(18,13,6,0.8)",
                    border: "1px solid #3E3020",
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 8,
                      color: "#6B5A3E",
                      letterSpacing: "0.1em",
                    }}
                  >
                    iNaturalist
                  </span>
                </div>

                {/* Relationship text overlaid on photo */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 18,
                      color: "#C8A96E",
                      letterSpacing: "0.05em",
                      lineHeight: 1.4,
                    }}
                  >
                    {getRelationshipLabel(
                      relationship.type_of_feeding,
                      predatorName,
                      preyName
                    )}
                  </motion.p>

                  {relationship.observed_on && (
                    <p
                      style={{
                        fontFamily: "'Cinzel', serif",
                        fontSize: 9,
                        color: "#4A3D2A",
                        marginTop: 4,
                        letterSpacing: "0.1em",
                      }}
                    >
                      Observed{" "}
                      {new Date(relationship.observed_on).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {relationship.place_state ? ` · ${relationship.place_state}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-5 py-4">
                <motion.button
                  className="flex-1 py-2.5"
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    color: "#C8A96E",
                    background: "transparent",
                    border: "1px solid #5C4A2A",
                    borderRadius: 2,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                  whileHover={{
                    background: "rgba(92, 74, 42, 0.3)",
                    borderColor: "#C8A96E",
                  }}
                  onClick={() => {
                    onAddToNetwork()
                  }}
                >
                  Add to Network
                </motion.button>

                {relationship.observation_url && (
                  <motion.a
                    href={relationship.observation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 flex items-center"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      color: "#6B5A3E",
                      border: "1px solid #2E2010",
                      borderRadius: 2,
                      textTransform: "uppercase",
                      textDecoration: "none",
                    }}
                    whileHover={{ borderColor: "#5C4A2A", color: "#8B7355" }}
                  >
                    Source ↗
                  </motion.a>
                )}
              </div>
            </>
          ) : (
            /* No relationship state */
            <div className="flex flex-col items-center px-8 py-10 gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
              >
                <svg width={64} height={64} viewBox="0 0 64 64" fill="none">
                  <circle cx={32} cy={32} r={30} stroke="#2E2010" strokeWidth={1.5} strokeDasharray="4 4" />
                  <path d="M20 20l24 24M44 20L20 44" stroke="#3E2E18" strokeWidth={2} strokeLinecap="round" />
                </svg>
              </motion.div>

              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 16,
                  color: "#6B5A3E",
                  letterSpacing: "0.05em",
                  textAlign: "center",
                }}
              >
                No relationship found
              </p>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 11,
                  color: "#3E2E18",
                  letterSpacing: "0.05em",
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                {speciesAName} and {speciesBName} have no documented feeding relationship in the database.
              </p>

              <motion.button
                className="mt-2 px-6 py-2.5"
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  color: "#6B5A3E",
                  background: "transparent",
                  border: "1px solid #2E2010",
                  borderRadius: 2,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
                whileHover={{ borderColor: "#5C4A2A", color: "#8B7355" }}
                onClick={onClose}
              >
                Try another pair
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}