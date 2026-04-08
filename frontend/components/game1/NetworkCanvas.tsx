"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { NetworkNode, NetworkLink } from "@/lib/types"
import { getLocalAnimalImage } from "@/components/game1/AnimalShelf"

interface NetworkCanvasProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
}

const NODE_RADIUS = 34

// Trophic-level color washes for medallion nodes
function getTrophicColor(taxonClass: string | undefined): string {
  const cls = (taxonClass || "").toLowerCase()
  if (cls.includes("plantae"))                               return "rgba(107,140,94,0.55)"   // sage
  if (cls.includes("insecta") || cls.includes("arachnida")) return "rgba(200,133,26,0.45)"   // ochre
  if (cls.includes("actinopterygii"))                       return "rgba(74,139,140,0.50)"   // teal
  if (cls.includes("amphibia"))                             return "rgba(74,139,140,0.45)"   // teal
  if (cls.includes("reptilia"))                             return "rgba(160,82,45,0.45)"    // rust
  if (cls.includes("aves"))                                 return "rgba(107,140,170,0.50)"  // dusty blue
  if (cls.includes("mammalia"))                             return "rgba(160,82,45,0.50)"    // rust
  return "rgba(200,133,26,0.35)"
}

export default function NetworkCanvas({ nodes, links }: NetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0)
          setDims({ width: rect.width, height: rect.height })
      }
    }
    measure()
    const obs = new ResizeObserver(measure)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (nodes.length === 0 || dims.width === 0) return
    setPositions((prev) => {
      const next = { ...prev }
      nodes.forEach((node, i) => {
        if (!next[node.scientific_name]) {
          const angle = (i / nodes.length) * Math.PI * 2
          const rx = (dims.width / 2  - NODE_RADIUS - 24) * 0.65
          const ry = (dims.height / 2 - NODE_RADIUS - 24) * 0.65
          next[node.scientific_name] = {
            x: dims.width  / 2 + Math.cos(angle) * rx,
            y: dims.height / 2 + Math.sin(angle) * ry,
          }
        }
      })
      return next
    })
  }, [nodes, dims])

  const getPos = (name: string) => positions[name]

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ minHeight: 200 }}
    >
      {/* Empty state — naturalist field note */}
      {nodes.length === 0 && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Faint ink-sketch web */}
          <svg width={100} height={100} viewBox="0 0 100 100" fill="none" opacity={0.25}>
            <circle cx={20} cy={50} r={12} stroke="rgba(92,61,46,0.8)" strokeWidth={1.5} strokeDasharray="3 3" />
            <circle cx={75} cy={22} r={12} stroke="rgba(92,61,46,0.8)" strokeWidth={1.5} strokeDasharray="3 3" />
            <circle cx={75} cy={78} r={12} stroke="rgba(92,61,46,0.8)" strokeWidth={1.5} strokeDasharray="3 3" />
            <path
              d="M32 45 Q53 35 63 28"
              stroke="rgba(92,61,46,0.5)" strokeWidth={1} strokeDasharray="2 2"
              fill="none"
            />
            <path
              d="M32 55 Q53 65 63 72"
              stroke="rgba(92,61,46,0.5)" strokeWidth={1} strokeDasharray="2 2"
              fill="none"
            />
          </svg>

          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "var(--font-mansalva), cursive",
              fontSize: 16,
              color: "rgba(92,61,46,0.45)",
              margin: "0 0 4px",
            }}>
              The web awaits
            </p>
            <p style={{
              fontFamily: "var(--font-playfair), serif",
              fontStyle: "italic",
              fontSize: 11,
              color: "rgba(92,61,46,0.35)",
              letterSpacing: "0.04em",
              margin: 0,
            }}>
              Discover connections to build your field guide
            </p>
          </div>
        </motion.div>
      )}

      {/* SVG links — hand-drawn bezier curves */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none", overflow: "visible" }}
      >
        <defs>
          {/* Slightly rough stroke via turbulence */}
          <filter id="rough-line" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="2" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" />
          </filter>
        </defs>

        <AnimatePresence>
          {links.map((link, idx) => {
            const src = getPos(link.predator_scientific)
            const tgt = getPos(link.prey_scientific)
            if (!src || !tgt) return null

            const dx = tgt.x - src.x
            const dy = tgt.y - src.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const ux = dx / dist
            const uy = dy / dist

            const x1 = src.x + ux * NODE_RADIUS
            const y1 = src.y + uy * NODE_RADIUS
            const x2 = tgt.x - ux * (NODE_RADIUS + 10)
            const y2 = tgt.y - uy * (NODE_RADIUS + 10)

            // Slight organic curve offset
            const perp = idx % 2 === 0 ? 28 : -28
            const mx = (x1 + x2) / 2 - uy * perp
            const my = (y1 + y2) / 2 + ux * perp

            // Estimated path length for dashoffset animation
            const pathLen = Math.round(dist * 1.2) + 60

            return (
              <motion.path
                key={`${link.predator_scientific}-${link.prey_scientific}`}
                d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                fill="none"
                stroke="rgba(139,107,85,0.7)"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeDasharray={`${pathLen}`}
                markerEnd="url(#wc-arrow)"
                style={{ filter: "url(#rough-line)" }}
                initial={{ strokeDashoffset: pathLen, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
              />
            )
          })}
        </AnimatePresence>
      </svg>

      {/* Nodes — watercolor medallions */}
      <AnimatePresence>
        {nodes.map((node) => {
          const pos = getPos(node.scientific_name)
          if (!pos) return null

          const localImg = getLocalAnimalImage({ ...node, thumbnail_url: node.thumbnail_url } as Parameters<typeof getLocalAnimalImage>[0])
          const fillColor = getTrophicColor(node.taxon_class)

          return (
            <motion.div
              key={node.scientific_name}
              className="absolute flex flex-col items-center"
              style={{
                left: pos.x - NODE_RADIUS,
                top:  pos.y - NODE_RADIUS,
                width: NODE_RADIUS * 2,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
            >
              {/* Medallion circle */}
              <div
                style={{
                  width: NODE_RADIUS * 2,
                  height: NODE_RADIUS * 2,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 35%, rgba(255,252,238,0.95) 0%, ${fillColor} 100%)`,
                  border: "1.5px solid rgba(139,107,85,0.4)",
                  boxShadow: "0 3px 14px rgba(60,40,10,0.2), inset 0 1px 4px rgba(255,255,255,0.5)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                {localImg ? (
                  <img
                    src={localImg}
                    alt={node.common_name || node.scientific_name}
                    aria-label={node.common_name || node.scientific_name}
                    style={{
                      width: NODE_RADIUS * 1.5,
                      height: NODE_RADIUS * 1.5,
                      objectFit: "contain",
                      
                      filter: "drop-shadow(1px 2px 3px rgba(60,40,10,0.2))",
                    }}
                  />
                ) : node.thumbnail_url ? (
                  <img
                    src={node.thumbnail_url}
                    alt={node.common_name || node.scientific_name}
                    aria-label={node.common_name || node.scientific_name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: 0.82,
                      
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-mansalva), cursive",
                      fontSize: NODE_RADIUS * 0.75,
                      color: "rgba(92,61,46,0.8)",
                    }}
                    aria-label={node.common_name || node.scientific_name}
                  >
                    {(node.common_name || node.scientific_name)[0]}
                  </span>
                )}

                {/* Subtle warm overlay ring */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 65% 65%, rgba(212,168,71,0.08) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Name tag */}
              <div
                style={{
                  marginTop: 4,
                  background: "rgba(255,252,238,0.85)",
                  borderRadius: 2,
                  border: "0.5px solid rgba(92,61,46,0.2)",
                  padding: "2px 5px",
                  boxShadow: "0 1px 4px rgba(60,40,10,0.1)",
                  maxWidth: 90,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-playfair), serif",
                    fontSize: 8,
                    color: "rgba(44,24,16,0.72)",
                    letterSpacing: "0.03em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  {node.common_name || node.scientific_name}
                </span>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
