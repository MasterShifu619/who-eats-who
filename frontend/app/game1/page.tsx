"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import AnimalShelf from "@/components/game1/AnimalShelf"
import DropZone from "@/components/game1/DropZone"
import PhotoModal from "@/components/game1/PhotoModal"
import NetworkCanvas from "@/components/game1/NetworkCanvas"
import { checkWhoEatsWhom } from "@/lib/api"
import type { Species, WhoEatsWhomResult, NetworkNode, NetworkLink } from "@/lib/types"
import { useReducedMotion } from "@/lib/useReducedMotion"
import { getMuted, setMuted } from "@/lib/sounds"
import { getSpeakEnabled, setSpeakEnabled, useSpeakOnFocus } from "@/lib/useSpeakOnFocus"

const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0,
  margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap", border: 0,
}

interface DragState {
  species: Species
  x: number
  y: number
  startX: number
  startY: number
  localImage: string | null
}

export default function Game1Page() {
  const prefersReduced = useReducedMotion()
  const [muted, setMutedState] = useState(false)
  const [speak, setSpeak] = useState(false)
  useSpeakOnFocus(speak)
  const [zoneA, setZoneA] = useState<Species | null>(null)
  const [zoneB, setZoneB] = useState<Species | null>(null)
  const [keyboardPick, setKeyboardPick] = useState<{ species: Species; localImage: string | null } | null>(null)
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
      .then((res) => { setResult(res) })
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

  const handleAddToNetwork = useCallback(() => {
    if (!result || result.direction === "none" || !zoneA || !zoneB) return
    const relationship = result.relationship_a_eats_b || result.relationship_b_eats_a
    if (!relationship) return

    const predatorSpecies = result.direction === "a_eats_b" ? zoneA : zoneB
    const preySpecies     = result.direction === "a_eats_b" ? zoneB : zoneA

    setNetworkNodes((prev) => {
      const names = new Set(prev.map((n) => n.scientific_name))
      const toAdd: NetworkNode[] = []
      if (!names.has(predatorSpecies.scientific_name))
        toAdd.push({ scientific_name: predatorSpecies.scientific_name, common_name: predatorSpecies.common_name, taxon_class: predatorSpecies.taxon_class, thumbnail_url: predatorSpecies.thumbnail_url })
      if (!names.has(preySpecies.scientific_name))
        toAdd.push({ scientific_name: preySpecies.scientific_name, common_name: preySpecies.common_name, taxon_class: preySpecies.taxon_class, thumbnail_url: preySpecies.thumbnail_url })
      return [...prev, ...toAdd]
    })

    setNetworkLinks((prev) => {
      const key = `${predatorSpecies.scientific_name}-${preySpecies.scientific_name}`
      if (prev.some((l) => `${l.predator_scientific}-${l.prey_scientific}` === key)) return prev
      return [...prev, { predator_scientific: predatorSpecies.scientific_name, prey_scientific: preySpecies.scientific_name, type_of_feeding: relationship.type_of_feeding, image_url: relationship.image_url }]
    })
  }, [result, zoneA, zoneB])

  const handleDragStart = useCallback((species: Species, originEl: HTMLElement, localImage: string | null) => {
    const rect = originEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const onMove = (e: PointerEvent) => {
      setDrag((prev) => prev ? { ...prev, x: e.clientX - cx, y: e.clientY - cy } : null)
      const aRect = zoneARef.current?.getBoundingClientRect()
      const bRect = zoneBRef.current?.getBoundingClientRect()
      const inZone = (r: DOMRect) =>
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top  && e.clientY <= r.bottom
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
        e.clientY >= r.top  && e.clientY <= r.bottom
      if (aRect && inZone(aRect) && !zoneA) setZoneA(species)
      else if (bRect && inZone(bRect) && !zoneB) setZoneB(species)
      setDrag(null)
      setOverZone(null)
    }

    setDrag({ species, x: 0, y: 0, startX: cx, startY: cy, localImage })
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [zoneA, zoneB])

  const handleKeyboardSelect = useCallback((species: Species, localImage: string | null) => {
    setKeyboardPick({ species, localImage })
  }, [])

  const handleKeyboardDrop = useCallback((zone: "A" | "B") => {
    if (!keyboardPick) return
    if (zone === "A" && !zoneA) setZoneA(keyboardPick.species)
    else if (zone === "B" && !zoneB) setZoneB(keyboardPick.species)
    setKeyboardPick(null)
  }, [keyboardPick, zoneA, zoneB])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setKeyboardPick(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setMutedState(getMuted())
    setSpeak(getSpeakEnabled())
  }, [])

  const placedSpecies = [zoneA?.scientific_name, zoneB?.scientific_name].filter(Boolean) as string[]

  const ariaStatus = checking
    ? `Checking relationship between ${zoneA?.common_name ?? ""} and ${zoneB?.common_name ?? ""}…`
    : result && zoneA && zoneB
      ? result.direction === "a_eats_b"
        ? `${zoneA.common_name} eats ${zoneB.common_name}.`
        : result.direction === "b_eats_a"
          ? `${zoneB.common_name} eats ${zoneA.common_name}.`
          : `No predator-prey relationship found between ${zoneA.common_name} and ${zoneB.common_name}.`
      : ""

  return (
    <div
      className="flex w-full h-screen overflow-hidden wc-cursor"
      style={{ userSelect: "none", position: "relative" }}
    >
      {/* ── Watercolor lake background ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/watercolor-lake-background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />
      {/* Warm parchment overlay to soften and unify */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(244, 237, 211, 0.18)",
          zIndex: 1,
        }}
      />

      {/* ── Left shelf ── */}
      <div style={{ position: "relative", zIndex: 10 }}>
        <AnimalShelf onDragStart={handleDragStart} onKeyboardSelect={handleKeyboardSelect} placedSpecies={placedSpecies} />
      </div>

      {/* ── Main canvas area ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* Title */}
        <div style={{ flexShrink: 0, padding: "20px 36px 6px", display: "flex", alignItems: "baseline", gap: 12, position: "relative" }}>
          {/* Mute + speak buttons */}
          <div style={{ position: "absolute", top: 16, right: 36, display: "flex", gap: 6, zIndex: 10 }}>
            <button
              onClick={() => { const next = !speak; setSpeakEnabled(next); setSpeak(next) }}
              aria-label={speak ? "Turn off read aloud" : "Turn on read aloud"}
              title={speak ? "Read aloud: on" : "Read aloud: off"}
              style={{
                width: 36, height: 36, padding: 0, fontSize: 18, lineHeight: "34px",
                background: "rgba(244,237,211,0.88)", border: "1px solid rgba(92,61,46,0.2)",
                borderRadius: "50%", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(44,24,16,0.12)",
                opacity: speak ? 1 : 0.45,
              }}
            >🗣️</button>
            <button
              onClick={() => { const next = !muted; setMuted(next); setMutedState(next) }}
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
              style={{
                width: 36, height: 36, padding: 0, fontSize: 18, lineHeight: "34px",
                background: "rgba(244,237,211,0.88)", border: "1px solid rgba(92,61,46,0.2)",
                borderRadius: "50%", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(44,24,16,0.12)",
              }}
            >{muted ? "🔇" : "🔊"}</button>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-mansalva), cursive",
              fontSize: 28,
              color: "rgba(44, 24, 16, 0.82)",
              margin: 0,
              letterSpacing: "0.02em",
              textShadow: "1px 2px 0 rgba(255,255,255,0.4)",
              filter: "url(#ink-wash)",
            }}
          >
            Who Eats Whom?
          </h1>
          <span
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontStyle: "italic",
              fontSize: 12,
              color: "rgba(92, 61, 46, 0.65)",
              letterSpacing: "0.04em",
            }}
          >
            a naturalist field study
          </span>
        </div>

        {/* Network canvas */}
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
            gap: 80,
            padding: "20px 32px 28px",
            position: "relative",
          }}
        >
          {/* Checking indicator */}
          <AnimatePresence>
            {checking && (
              <motion.div
                style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)" }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-playfair), serif",
                    fontStyle: "italic",
                    fontSize: 12,
                    color: "rgba(92, 61, 46, 0.75)",
                    letterSpacing: "0.06em",
                  }}
                >
                  Searching the web of life…
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keyboard-pick status banner */}
          {keyboardPick && (
            <div
              role="status"
              style={{
                position: "absolute", top: -32, left: "50%", transform: "translateX(-50%)",
                fontFamily: "var(--font-playfair), serif", fontStyle: "italic",
                fontSize: 12, color: "rgba(107,140,94,0.95)",
                background: "rgba(244,237,211,0.95)", padding: "4px 14px",
                borderRadius: 20, border: "1px solid rgba(107,140,94,0.5)",
                whiteSpace: "nowrap",
              }}
            >
              {keyboardPick.species.common_name} selected — Tab to a zone, Enter to place, Escape to cancel
            </div>
          )}

          <div ref={zoneARef}>
            <DropZone
              zoneId="A"
              species={zoneA}
              isOver={overZone === "A"}
              label="First Creature"
              onClear={() => setZoneA(null)}
              isKeyboardTarget={!!keyboardPick && !zoneA}
              onKeyboardDrop={() => handleKeyboardDrop("A")}
            />
          </div>

          {/* Separator */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 1, height: 20, background: "rgba(92,61,46,0.3)" }} />
            <span
              style={{
                fontFamily: "var(--font-mansalva), cursive",
                fontSize: 18,
                color: "rgba(92, 61, 46, 0.55)",
              }}
            >
              &amp;
            </span>
            <div style={{ width: 1, height: 20, background: "rgba(92,61,46,0.3)" }} />
          </div>

          <div ref={zoneBRef}>
            <DropZone
              zoneId="B"
              species={zoneB}
              isOver={overZone === "B"}
              label="Second Creature"
              onClear={() => setZoneB(null)}
              isKeyboardTarget={!!keyboardPick && !zoneB}
              onKeyboardDrop={() => handleKeyboardDrop("B")}
            />
          </div>
        </div>
      </div>

      {/* Screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" style={SR_ONLY}>{ariaStatus}</div>

      {/* ── Drag ghost ── */}
      <AnimatePresence>
        {drag && (
          <motion.div
            style={{
              position: "fixed",
              left: drag.startX - 44,
              top: drag.startY - 44,
              x: drag.x,
              y: drag.y,
              pointerEvents: "none",
              zIndex: 100,
            }}
            initial={{ scale: 0.9, opacity: 0.8, rotate: 0 }}
            animate={{ scale: prefersReduced ? 1 : 1.12, opacity: 0.95, rotate: prefersReduced ? 0 : 3 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.15 }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "55% 45% 60% 40% / 50% 50% 45% 55%",
                overflow: "hidden",
                background: "rgba(244, 237, 211, 0.92)",
                border: "1.5px solid rgba(92,61,46,0.5)",
                filter: "url(#specimen-shadow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {drag.localImage ? (
                <img
                  src={drag.localImage}
                  alt={drag.species.common_name}
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: "contain",
                    mixBlendMode: "multiply",
                    filter: "drop-shadow(1px 2px 4px rgba(60,40,10,0.25))",
                  }}
                />
              ) : drag.species.thumbnail_url ? (
                <img
                  src={drag.species.thumbnail_url}
                  alt={drag.species.common_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.88 }}
                />
              ) : (
                <span style={{
                  fontFamily: "var(--font-mansalva), cursive",
                  fontSize: 32,
                  color: "rgba(92,61,46,0.7)",
                }}>
                  {(drag.species.common_name || drag.species.scientific_name)[0]}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Photo result modal ── */}
      {result && zoneA && zoneB && (
        <PhotoModal
          result={result}
          speciesAName={zoneA.common_name || zoneA.scientific_name}
          speciesBName={zoneB.common_name || zoneB.scientific_name}
          onClose={() => { setResult(null); setZoneA(null); setZoneB(null) }}
          onAddToNetwork={() => { handleAddToNetwork(); setResult(null); setZoneA(null); setZoneB(null) }}
        />
      )}
    </div>
  )
}
