"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import AnimalShelf from "@/components/game1/AnimalShelf"
import FieldDropZone from "@/components/game1/FieldDropZone"
import PhotoModal from "@/components/game1/PhotoModal"
import FieldNetworkCanvas from "@/components/game1/FieldNetworkCanvas"
import { checkWhoEatsWhom, getNCSpecies } from "@/lib/api"
import type { Species, WhoEatsWhomResult, NetworkNode, NetworkLink } from "@/lib/types"
import { getSpeciesClues, getSpeciesLabel, scoreSpeciesPair } from "@/lib/game1Hints"

interface DragState {
  species: Species
  x: number
  y: number
  startX: number
  startY: number
}

export default function Game1Page() {
  const [species, setSpecies] = useState<Species[]>([])
  const [speciesLoading, setSpeciesLoading] = useState(true)
  const [zoneA, setZoneA] = useState<Species | null>(null)
  const [zoneB, setZoneB] = useState<Species | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overZone, setOverZone] = useState<"A" | "B" | null>(null)
  const [inspectedSpecies, setInspectedSpecies] = useState<Species | null>(null)
  const [result, setResult] = useState<WhoEatsWhomResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([])
  const [networkLinks, setNetworkLinks] = useState<NetworkLink[]>([])
  const [latestDiscoveryKey, setLatestDiscoveryKey] = useState<string | null>(null)

  const zoneARef = useRef<HTMLDivElement>(null)
  const zoneBRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getNCSpecies()
      .then(setSpecies)
      .finally(() => setSpeciesLoading(false))
  }, [])

  // Auto-check when both zones are filled
  useEffect(() => {
    if (!zoneA || !zoneB || checking) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      setChecking(true)

      checkWhoEatsWhom(zoneA.scientific_name, zoneB.scientific_name)
        .then((res) => {
          if (!cancelled) setResult(res)
        })
        .catch((err) => {
          console.error("API error:", err)
          if (cancelled) return
          setResult({
            species_a: zoneA.scientific_name,
            species_b: zoneB.scientific_name,
            direction: "none",
            relationship_a_eats_b: null,
            relationship_b_eats_a: null,
          })
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [zoneA, zoneB, checking])

  // Add confirmed pair to network
  const handleAddToNetwork = useCallback(() => {
    if (!result || result.direction === "none" || !zoneA || !zoneB) return

    const relationship = result.relationship_a_eats_b || result.relationship_b_eats_a
    if (!relationship) return

    const predatorSpecies = result.direction === "a_eats_b" ? zoneA : zoneB
    const preySpecies = result.direction === "a_eats_b" ? zoneB : zoneA

    setNetworkNodes((prev) => {
      const names = new Set(prev.map((n) => n.scientific_name))
      const toAdd: NetworkNode[] = []
      if (!names.has(predatorSpecies.scientific_name)) {
        toAdd.push({
          scientific_name: predatorSpecies.scientific_name,
          common_name: predatorSpecies.common_name,
          taxon_class: predatorSpecies.taxon_class,
          thumbnail_url: predatorSpecies.thumbnail_url,
        })
      }
      if (!names.has(preySpecies.scientific_name)) {
        toAdd.push({
          scientific_name: preySpecies.scientific_name,
          common_name: preySpecies.common_name,
          taxon_class: preySpecies.taxon_class,
          thumbnail_url: preySpecies.thumbnail_url,
        })
      }
      return [...prev, ...toAdd]
    })

    setNetworkLinks((prev) => {
      const key = `${predatorSpecies.scientific_name}-${preySpecies.scientific_name}`
      if (prev.some((l) => `${l.predator_scientific}-${l.prey_scientific}` === key)) return prev
      return [
        ...prev,
        {
          predator_scientific: predatorSpecies.scientific_name,
          prey_scientific: preySpecies.scientific_name,
          type_of_feeding: relationship.type_of_feeding,
          image_url: relationship.image_url,
        },
      ]
    })
    setLatestDiscoveryKey(`${predatorSpecies.scientific_name}-${preySpecies.scientific_name}`)
  }, [result, zoneA, zoneB])

  // Pointer drag logic
  const handleDragStart = useCallback((species: Species, originEl: HTMLElement) => {
    const rect = originEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const onMove = (e: PointerEvent) => {
      setDrag((prev) =>
        prev ? { ...prev, x: e.clientX - cx, y: e.clientY - cy } : null
      )

      const aRect = zoneARef.current?.getBoundingClientRect()
      const bRect = zoneBRef.current?.getBoundingClientRect()

      const inZone = (r: DOMRect) =>
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom

      if (aRect && inZone(aRect)) setOverZone("A")
      else if (bRect && inZone(bRect)) setOverZone("B")
      else setOverZone(null)
    }

    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)

      const aRect = zoneARef.current?.getBoundingClientRect()
      const bRect = zoneBRef.current?.getBoundingClientRect()

      const inZone = (r: DOMRect) =>
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom

      if (aRect && inZone(aRect) && !zoneA) setZoneA(species)
      else if (bRect && inZone(bRect) && !zoneB) setZoneB(species)

      setDrag(null)
      setOverZone(null)
    }

    setDrag({ species, x: 0, y: 0, startX: cx, startY: cy })
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [zoneA, zoneB])

  const placedSpecies = [
    zoneA?.scientific_name,
    zoneB?.scientific_name,
  ].filter(Boolean) as string[]

  const guideSpecies = zoneA ?? zoneB ?? inspectedSpecies
  const likelyMatches = guideSpecies
    ? species
        .filter((entry) => !placedSpecies.includes(entry.scientific_name))
        .map((entry) => scoreSpeciesPair(guideSpecies, entry))
        .filter((entry): entry is NonNullable<typeof entry> => !!entry)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
    : []

  const clueSummary = guideSpecies ? getSpeciesClues(guideSpecies).slice(0, 3) : []
  const suggestionSummary = likelyMatches.slice(0, 3).map((entry) => getSpeciesLabel(entry.species))
  const zoneHint =
    guideSpecies && likelyMatches.length > 0
      ? `Try a nearby food-chain match such as ${suggestionSummary.join(", ")}.`
      : "Place a specimen here. Start with creatures from the same field circle."

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at top, rgba(200,169,110,0.12), transparent 26%), linear-gradient(180deg, #1b120a 0%, #0e0a05 100%)",
        userSelect: "none",
      }}
    >
      <AnimalShelf
        species={species}
        loading={speciesLoading}
        onDragStart={handleDragStart}
        onInspectSpecies={setInspectedSpecies}
        placedSpecies={placedSpecies}
        focusSpecies={guideSpecies}
        likelyMatches={likelyMatches.map((entry) => entry.species.scientific_name)}
      />

      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{
          padding: "18px 20px 20px",
          gap: 14,
        }}
      >
        <div
          className="rounded-[26px] px-8 py-6"
          style={{
            background:
              "linear-gradient(180deg, rgba(221,204,175,0.96) 0%, rgba(193,164,126,0.94) 100%)",
            border: "1px solid rgba(94,74,42,0.35)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
          }}
        >
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontSize: 11,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#6c5036",
            }}
          >
            Naturalist Ledger
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              textAlign: "center",
              fontFamily: "var(--font-medieval-display)",
              fontSize: 40,
              lineHeight: 1,
              color: "#2d1d13",
            }}
          >
            Who Eats Whom
          </h1>
          <p
            style={{
              margin: "10px auto 0",
              maxWidth: 640,
              textAlign: "center",
              fontFamily: "var(--font-manuscript)",
              fontSize: 18,
              lineHeight: 1.35,
              color: "#553d2a",
            }}
          >
            Build the food web like a field investigator. Match creatures by tier, body plan, and
            field circle before you test the pair.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {guideSpecies ? (
              <>
                <span
                  className="rounded-full px-3 py-1"
                  style={{
                    background: "rgba(45,29,19,0.08)",
                    border: "1px solid rgba(94,74,42,0.18)",
                    fontFamily: "var(--font-display)",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#5f452f",
                  }}
                >
                  Active clue: {getSpeciesLabel(guideSpecies)}
                </span>
                {clueSummary.map((clue) => (
                  <span
                    key={clue.label}
                    className="rounded-full px-3 py-1"
                    style={{
                      background: "rgba(108,123,82,0.1)",
                      border: "1px solid rgba(108,123,82,0.22)",
                      fontFamily: "var(--font-display)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#4d573d",
                    }}
                  >
                    {clue.icon} {clue.label}
                  </span>
                ))}
              </>
            ) : (
              <span
                className="rounded-full px-3 py-1"
                style={{
                  background: "rgba(45,29,19,0.08)",
                  border: "1px solid rgba(94,74,42,0.18)",
                  fontFamily: "var(--font-display)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#5f452f",
                }}
              >
                Start by dragging a producer, forager, or hunter card.
              </span>
            )}
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 gap-4"
          style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 420px)" }}
        >
          <div className="min-h-0">
            <FieldNetworkCanvas
              nodes={networkNodes}
              links={networkLinks}
              focusScientificName={guideSpecies?.scientific_name}
              latestDiscoveryKey={latestDiscoveryKey}
            />
          </div>

          <div
            className="flex flex-col rounded-[28px] px-6 py-6"
            style={{
              background: "linear-gradient(180deg, rgba(31,22,15,0.96) 0%, rgba(18,13,8,0.98) 100%)",
              border: "1px solid rgba(200,169,110,0.18)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.24)",
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontFamily: "var(--font-medieval-display)",
                fontSize: 28,
                color: "#d7c2a2",
              }}
            >
              Investigation Altar
            </div>
            <p
              style={{
                margin: "8px 0 0",
                textAlign: "center",
                fontFamily: "var(--font-manuscript)",
                fontSize: 16,
                lineHeight: 1.4,
                color: "#b9a284",
              }}
            >
              Place two specimens, then compare their clues before the archive checks the record.
            </p>

            <div className="mt-5 flex-1">
              <div
                className="relative flex h-full items-center justify-center"
                style={{ gap: 36 }}
              >
                <AnimatePresence>
                  {checking && (
                    <motion.div
                      style={{
                        position: "absolute",
                        top: -8,
                        left: "50%",
                        transform: "translateX(-50%)",
                        textAlign: "center",
                      }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 10,
                          color: "#c8a96e",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                        }}
                      >
                        Searching the archive...
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={zoneARef}>
                  <FieldDropZone
                    zoneId="A"
                    species={zoneA}
                    isOver={overZone === "A"}
                    label="Specimen One"
                    hint={zoneHint}
                    onClear={() => setZoneA(null)}
                  />
                </div>

                <div
                  className="flex flex-col items-center justify-center gap-3"
                  style={{ minWidth: 70 }}
                >
                  <div
                    style={{
                      width: 1,
                      height: 44,
                      background: "linear-gradient(180deg, transparent, rgba(200,169,110,0.4), transparent)",
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "var(--font-medieval-display)",
                      fontSize: 26,
                      color: "#8c6d48",
                    }}
                  >
                    vs
                  </div>
                  <div
                    style={{
                      width: 1,
                      height: 44,
                      background: "linear-gradient(180deg, transparent, rgba(200,169,110,0.4), transparent)",
                    }}
                  />
                </div>

                <div ref={zoneBRef}>
                  <FieldDropZone
                    zoneId="B"
                    species={zoneB}
                    isOver={overZone === "B"}
                    label="Specimen Two"
                    hint={zoneHint}
                    onClear={() => setZoneB(null)}
                  />
                </div>
              </div>
            </div>

            <div
              className="mt-4 rounded-2xl px-4 py-4"
              style={{
                background: "rgba(215,194,162,0.06)",
                border: "1px solid rgba(200,169,110,0.12)",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 11,
                  color: "#c8a96e",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                Investigation Hints
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  textAlign: "center",
                  fontFamily: "var(--font-manuscript)",
                  fontSize: 15,
                  lineHeight: 1.35,
                  color: "#d9c4a3",
                }}
              >
                {guideSpecies
                  ? `When exploring ${getSpeciesLabel(guideSpecies)}, look for species in the same field circle or a neighboring food-chain tier.`
                  : "Plants often lead to foragers. Foragers often lead to hunters. Shared field circles are strong clues."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drag && (
          <motion.div
            style={{
              position: "fixed",
              left: drag.startX - 40,
              top: drag.startY - 40,
              x: drag.x,
              y: drag.y,
              pointerEvents: "none",
              zIndex: 50,
            }}
            initial={{ scale: 0.9, opacity: 0.8 }}
            animate={{ scale: 1.06, opacity: 0.92 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 18,
                overflow: "hidden",
                border: "2px solid #C8A96E",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(200,169,110,0.2)",
              }}
            >
              {drag.species.thumbnail_url && (
                <img
                  src={drag.species.thumbnail_url}
                  alt={drag.species.common_name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.85,
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {result && zoneA && zoneB && (
        <PhotoModal
          result={result}
          speciesAName={zoneA.common_name || zoneA.scientific_name}
          speciesBName={zoneB.common_name || zoneB.scientific_name}
          onClose={() => {
            setResult(null)
            setZoneA(null)
            setZoneB(null)
          }}
          onAddToNetwork={() => {
            handleAddToNetwork()
            setResult(null)
            setZoneA(null)
            setZoneB(null)
          }}
        />
      )}
    </div>
  )
}
