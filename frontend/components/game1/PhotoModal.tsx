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
  "Pollination":       "pollinates",
  "Parasitism":        "is a parasite of",
  "Scavenging":        "scavenges",
  "No, none of these": "eats",
  "":                  "eats",
}

function getRelationshipLabel(feedingType: string, predator: string, prey: string): string {
  const verb = FEEDING_TYPE_LABELS[feedingType] ?? "interacts with"
  return `${predator} ${verb} ${prey}`
}

// Falling leaf shapes for success animation
const LEAVES = [
  { emoji: "🍂", x: "15%",  delay: 0,    duration: 2.8 },
  { emoji: "🍃", x: "30%",  delay: 0.3,  duration: 3.2 },
  { emoji: "🍁", x: "55%",  delay: 0.15, duration: 2.6 },
  { emoji: "🍃", x: "70%",  delay: 0.5,  duration: 3.5 },
  { emoji: "🍂", x: "85%",  delay: 0.1,  duration: 2.9 },
  { emoji: "✿",  x: "42%",  delay: 0.4,  duration: 3.1 },
  { emoji: "❋",  x: "60%",  delay: 0.6,  duration: 2.7 },
]

export default function PhotoModal({
  result,
  speciesAName,
  speciesBName,
  onClose,
  onAddToNetwork,
}: PhotoModalProps) {
  if (!result) return null

  const hasRelationship = result.direction !== "none"
  const relationship    = result.relationship_a_eats_b || result.relationship_b_eats_a
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
        style={{
          background: "rgba(44, 24, 16, 0.55)",
          backdropFilter: "blur(6px)",
        }}
        onClick={onClose}
      >
        {/* Falling leaves — only on success */}
        {hasRelationship && LEAVES.map((leaf, i) => (
          <div
            key={i}
            style={{
              position: "fixed",
              top: "-10px",
              left: leaf.x,
              fontSize: 20,
              animation: `fall-leaf ${leaf.duration}s ${leaf.delay}s ease-in forwards`,
              pointerEvents: "none",
              zIndex: 60,
            }}
          >
            {leaf.emoji}
          </div>
        ))}

        {/* Modal card — parchment */}
        <motion.div
          className="relative flex flex-col overflow-hidden"
          style={{
            width: 500,
            maxWidth: "92vw",
            background: "linear-gradient(150deg, #FAF5E4 0%, #EDE0BC 100%)",
            borderRadius: "4px 12px 6px 10px / 10px 5px 12px 4px",
            border: "1px solid rgba(139,107,85,0.3)",
            boxShadow: "0 24px 72px rgba(44,24,16,0.35), 0 4px 16px rgba(44,24,16,0.15)",
          }}
          initial={{ scale: 0.82, y: 48, opacity: 0, rotate: -1 }}
          animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.82, y: 48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Corner ink flourishes */}
          <CornerFlourishes />

          {hasRelationship && relationship?.image_url ? (
            <>
              {/* Photo */}
              <div style={{ position: "relative", width: "100%", height: 240, overflow: "hidden" }}>
                <img
                  src={relationship.image_url}
                  alt="Feeding interaction"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.88,
                    
                    borderRadius: "3px 10px 0 0",
                  }}
                />
                {/* Parchment gradient overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to bottom, rgba(244,237,211,0.1) 0%, rgba(232,216,176,0.92) 100%)",
                  }}
                />

                {/* iNaturalist badge */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "rgba(244,237,211,0.88)",
                    border: "1px solid rgba(92,61,46,0.25)",
                    borderRadius: 2,
                    padding: "3px 8px",
                  }}
                >
                  <span style={{
                    fontFamily: "var(--font-playfair), serif",
                    fontStyle: "italic",
                    fontSize: 9,
                    color: "rgba(92,61,46,0.75)",
                    letterSpacing: "0.05em",
                  }}>
                    iNaturalist
                  </span>
                </div>

                {/* Relationship text */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 16px" }}>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    style={{
                      fontFamily: "var(--font-mansalva), cursive",
                      fontSize: 20,
                      color: "rgba(44, 24, 16, 0.88)",
                      margin: "0 0 4px",
                      lineHeight: 1.35,
                      textShadow: "0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    {getRelationshipLabel(relationship.type_of_feeding, predatorName, preyName)}
                  </motion.p>

                  {relationship.observed_on && (
                    <p style={{
                      fontFamily: "var(--font-playfair), serif",
                      fontStyle: "italic",
                      fontSize: 10,
                      color: "rgba(92,61,46,0.65)",
                      margin: 0,
                      letterSpacing: "0.04em",
                    }}>
                      Observed{" "}
                      {new Date(relationship.observed_on).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                      {relationship.place_state ? ` · ${relationship.place_state}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, padding: "14px 18px 18px" }}>
                <motion.button
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontFamily: "var(--font-mansalva), cursive",
                    fontSize: 13,
                    color: "rgba(44,24,16,0.85)",
                    background: "rgba(200,133,26,0.18)",
                    border: "1.5px solid rgba(200,133,26,0.4)",
                    borderRadius: "3px 8px 4px 7px / 6px 3px 8px 4px",
                    cursor: "pointer",
                    letterSpacing: "0.02em",
                    transition: "all 0.3s ease",
                  }}
                  whileHover={{
                    background: "rgba(200,133,26,0.30)",
                    borderColor: "rgba(200,133,26,0.7)",
                    scale: 1.02,
                  }}
                  onClick={onAddToNetwork}
                >
                  Add to Field Guide
                </motion.button>

                {relationship.observation_url && (
                  <motion.a
                    href={relationship.observation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      fontFamily: "var(--font-playfair), serif",
                      fontStyle: "italic",
                      fontSize: 11,
                      color: "rgba(92,61,46,0.65)",
                      border: "1px solid rgba(92,61,46,0.25)",
                      borderRadius: "4px 3px 8px 5px / 5px 8px 3px 4px",
                      textDecoration: "none",
                      transition: "all 0.3s ease",
                    }}
                    whileHover={{ borderColor: "rgba(92,61,46,0.5)", color: "rgba(92,61,46,0.9)" }}
                  >
                    Source ↗
                  </motion.a>
                )}
              </div>
            </>
          ) : (
            /* No relationship — wax seal "not found" */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 32px 32px", gap: 16 }}>
              {/* Wax seal style badge */}
              <motion.div
                initial={{ scale: 1.6, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 38% 38%, rgba(160,82,45,0.9) 0%, rgba(120,50,20,0.95) 100%)",
                  border: "2px solid rgba(160,82,45,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 18px rgba(44,24,16,0.3), inset 0 1px 4px rgba(255,200,150,0.2)",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 32, filter: "grayscale(0.3)" }}>✕</span>
              </motion.div>

              <p style={{
                fontFamily: "var(--font-mansalva), cursive",
                fontSize: 20,
                color: "rgba(92,61,46,0.85)",
                margin: 0,
                textAlign: "center",
              }}>
                No record found
              </p>
              <p style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic",
                fontSize: 12,
                color: "rgba(92,61,46,0.6)",
                margin: 0,
                textAlign: "center",
                lineHeight: 1.6,
                maxWidth: 320,
              }}>
                {speciesAName} and {speciesBName} have no documented feeding
                relationship in our field records.
              </p>

              <motion.button
                style={{
                  marginTop: 4,
                  padding: "10px 28px",
                  fontFamily: "var(--font-mansalva), cursive",
                  fontSize: 13,
                  color: "rgba(92,61,46,0.8)",
                  background: "transparent",
                  border: "1.5px solid rgba(92,61,46,0.3)",
                  borderRadius: "4px 8px 5px 7px / 7px 4px 8px 5px",
                  cursor: "pointer",
                }}
                whileHover={{ borderColor: "rgba(92,61,46,0.6)", background: "rgba(92,61,46,0.06)" }}
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

// ── Corner ink flourishes ─────────────────────────────────────────────────────
function CornerFlourishes() {
  return (
    <>
      {/* Top-left */}
      <svg
        style={{ position: "absolute", top: 6, left: 6, pointerEvents: "none" }}
        width={28} height={28} viewBox="0 0 28 28" fill="none"
      >
        <path d="M4 24 L4 4 L24 4" stroke="rgba(92,61,46,0.35)" strokeWidth={1.2} strokeLinecap="round" />
        <circle cx={4} cy={4} r={2} fill="rgba(92,61,46,0.25)" />
      </svg>
      {/* Top-right */}
      <svg
        style={{ position: "absolute", top: 6, right: 6, pointerEvents: "none" }}
        width={28} height={28} viewBox="0 0 28 28" fill="none"
      >
        <path d="M24 24 L24 4 L4 4" stroke="rgba(92,61,46,0.35)" strokeWidth={1.2} strokeLinecap="round" />
        <circle cx={24} cy={4} r={2} fill="rgba(92,61,46,0.25)" />
      </svg>
      {/* Bottom-left */}
      <svg
        style={{ position: "absolute", bottom: 6, left: 6, pointerEvents: "none" }}
        width={28} height={28} viewBox="0 0 28 28" fill="none"
      >
        <path d="M4 4 L4 24 L24 24" stroke="rgba(92,61,46,0.35)" strokeWidth={1.2} strokeLinecap="round" />
        <circle cx={4} cy={24} r={2} fill="rgba(92,61,46,0.25)" />
      </svg>
      {/* Bottom-right */}
      <svg
        style={{ position: "absolute", bottom: 6, right: 6, pointerEvents: "none" }}
        width={28} height={28} viewBox="0 0 28 28" fill="none"
      >
        <path d="M24 4 L24 24 L4 24" stroke="rgba(92,61,46,0.35)" strokeWidth={1.2} strokeLinecap="round" />
        <circle cx={24} cy={24} r={2} fill="rgba(92,61,46,0.25)" />
      </svg>
    </>
  )
}
