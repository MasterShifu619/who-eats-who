"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import AnimalShelf from "@/components/game1/AnimalShelf"
import DropZone from "@/components/game1/DropZone"
import PhotoModal from "@/components/game1/PhotoModal"
import NetworkCanvas from "@/components/game1/NetworkCanvas"
import { checkWhoEatsWhom } from "@/lib/api"
import type { Species, WhoEatsWhomResult, NetworkNode, NetworkLink } from "@/lib/types"

interface DragState {
  species: Species
  x: number
  y: number
  startX: number
  startY: number
}

export default function Game1Page() {
  const [zoneA, setZoneA] = useState<Species | null>(null)
  const [zoneB, setZoneB] = useState<Species | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overZone, setOverZone] = useState<"A" | "B" | null>(null)
  const [result, setResult] = useState<WhoEatsWhomResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([])
  const [networkLinks, setNetworkLinks] = useState<NetworkLink[]>([])

  const zoneARef = useRef<HTMLDivElement>(null)
  const zoneBRef = useRef<HTMLDivElement>(null)

  // Auto-check when both zones are filled
  useEffect(() => {
    if (!zoneA || !zoneB || checking) return
    setChecking(true)

    checkWhoEatsWhom(zoneA.scientific_name, zoneB.scientific_name)
      .then((res) => {
        setResult(res)
      })
      .catch((err) => {
        console.error("API error:", err)
        setResult({
          species_a: zoneA.scientific_name,
          species_b: zoneB.scientific_name,
          direction: "none",
          relationship_a_eats_b: null,
          relationship_b_eats_a: null,
        })
      })
      .finally(() => setChecking(false))
  }, [zoneA, zoneB])

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

  return (
    <div
      className="flex w-full h-screen overflow-hidden"
      style={{ background: "#0E0A05", userSelect: "none" }}
    >
      {/* Left shelf */}
      <AnimalShelf onDragStart={handleDragStart} placedSpecies={placedSpecies} />

      {/* Main canvas area */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title */}
        <div style={{ flexShrink: 0, padding: "24px 32px 8px" }}>
          <h1
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 13,
              letterSpacing: "0.3em",
              color: "#3E2E18",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Who Eats Whom
          </h1>
        </div>

        {/* Network canvas — takes all remaining vertical space */}
        <div style={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
          <NetworkCanvas nodes={networkNodes} links={networkLinks} />
        </div>

        {/* Drop zones */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 96,
            padding: "24px 32px",
            position: "relative",
          }}
        >
          <AnimatePresence>
            {checking && (
              <motion.div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 10,
                    color: "#6B5A3E",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                  }}
                >
                  Searching the web of life...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={zoneARef}>
            <DropZone
              zoneId="A"
              species={zoneA}
              isOver={overZone === "A"}
              label="Animal One"
              onClear={() => setZoneA(null)}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div style={{ width: 1, height: 24, background: "#2E2010" }} />
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 10,
                color: "#3E2E18",
                letterSpacing: "0.2em",
              }}
            >
              &
            </span>
            <div style={{ width: 1, height: 24, background: "#2E2010" }} />
          </div>

          <div ref={zoneBRef}>
            <DropZone
              zoneId="B"
              species={zoneB}
              isOver={overZone === "B"}
              label="Animal Two"
              onClear={() => setZoneB(null)}
            />
          </div>
        </div>
      </div>

      {/* Dragging ghost */}
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
            animate={{ scale: 1.1, opacity: 0.9 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
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

      {/* Photo result modal */}
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