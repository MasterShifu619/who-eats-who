"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { NetworkNode, NetworkLink } from "@/lib/types"
import { getTaxonColor } from "@/lib/game1Hints"

interface FieldNetworkCanvasProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
  focusScientificName?: string | null
  latestDiscoveryKey?: string | null
}

const NODE_WIDTH = 102
const NODE_HEIGHT = 118

export default function FieldNetworkCanvas({
  nodes,
  links,
  focusScientificName,
  latestDiscoveryKey,
}: FieldNetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width && rect.height) {
        setDims({ width: rect.width, height: rect.height })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const positions: Record<string, { x: number; y: number; rotate: number }> = {}
  if (nodes.length && dims.width && dims.height) {
    const centerX = dims.width / 2
    const centerY = dims.height / 2
    const radiusX = Math.max(150, dims.width * 0.34)
    const radiusY = Math.max(110, dims.height * 0.28)

    nodes.forEach((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2
      positions[node.scientific_name] = {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
        rotate: (index % 2 === 0 ? -1 : 1) * (5 + (index % 3) * 2),
      }
    })
  }

  const connectedNodes = new Set<string>()
  if (focusScientificName) {
    links.forEach((link) => {
      if (
        link.predator_scientific === focusScientificName ||
        link.prey_scientific === focusScientificName
      ) {
        connectedNodes.add(link.predator_scientific)
        connectedNodes.add(link.prey_scientific)
      }
    })
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-[28px]"
      style={{
        background:
          "radial-gradient(circle at top, rgba(255,245,230,0.16), transparent 28%), linear-gradient(180deg, rgba(215,194,162,0.92) 0%, rgba(186,159,120,0.9) 100%)",
        border: "1px solid rgba(94,74,42,0.35)",
        boxShadow: "inset 0 0 60px rgba(93,66,33,0.15), 0 24px 48px rgba(0,0,0,0.18)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            "linear-gradient(rgba(61,43,28,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(61,43,28,0.4) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />

      {nodes.length === 0 && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center px-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div
            style={{
              fontFamily: "var(--font-medieval-display)",
              fontSize: 32,
              color: "#5a422d",
              textAlign: "center",
            }}
          >
            Field Web
          </div>
          <p
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-manuscript)",
              fontSize: 18,
              lineHeight: 1.35,
              color: "#6e573f",
              textAlign: "center",
              maxWidth: 440,
            }}
          >
            Each confirmed discovery pins a specimen card to this parchment map. Try creatures from
            the same field circle or neighboring food-chain tier.
          </p>
        </motion.div>
      )}

      <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
        <defs>
          <marker id="ink-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#6b5036" />
          </marker>
        </defs>

        <AnimatePresence>
          {links.map((link) => {
            const source = positions[link.predator_scientific]
            const target = positions[link.prey_scientific]
            if (!source || !target) return null

            const dx = target.x - source.x
            const dy = target.y - source.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1
            const unitX = dx / distance
            const unitY = dy / distance
            const x1 = source.x + unitX * 54
            const y1 = source.y + unitY * 60
            const x2 = target.x - unitX * 54
            const y2 = target.y - unitY * 60
            const midX = (x1 + x2) / 2 - unitY * 28
            const midY = (y1 + y2) / 2 + unitX * 28
            const key = `${link.predator_scientific}-${link.prey_scientific}`
            const isFocus =
              !!focusScientificName &&
              (link.predator_scientific === focusScientificName ||
                link.prey_scientific === focusScientificName)
            const isLatest = latestDiscoveryKey === key

            return (
              <motion.path
                key={key}
                d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                fill="none"
                stroke={isLatest ? "#8b5a2b" : isFocus ? "#6c7b52" : "#6b5036"}
                strokeWidth={isLatest ? 3 : isFocus ? 2.6 : 2}
                strokeLinecap="round"
                strokeDasharray={isLatest ? "0" : "3 7"}
                markerEnd="url(#ink-arrow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: isFocus || isLatest ? 0.95 : 0.72 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, ease: "easeOut" }}
              />
            )
          })}
        </AnimatePresence>
      </svg>

      <AnimatePresence>
        {nodes.map((node) => {
          const position = positions[node.scientific_name]
          if (!position) return null

          const isFocus = focusScientificName === node.scientific_name
          const isConnected = connectedNodes.has(node.scientific_name)
          const borderColor = getTaxonColor({
            scientific_name: node.scientific_name,
            common_name: node.common_name,
            taxon_class: node.taxon_class,
            taxon_order: "",
            taxon_family: "",
            taxon_kingdom: "",
            trophic_pos: "",
            totaldegree: "",
            pagerank: "",
            betweenness: "",
            community: "",
            in_giant_foodweb: "",
            thumbnail_url: node.thumbnail_url,
          })

          return (
            <motion.div
              key={node.scientific_name}
              className="absolute"
              style={{
                left: position.x - NODE_WIDTH / 2,
                top: position.y - NODE_HEIGHT / 2,
                width: NODE_WIDTH,
              }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{
                scale: isFocus ? 1.06 : 1,
                opacity: focusScientificName ? (isFocus || isConnected ? 1 : 0.58) : 1,
                rotate: position.rotate,
              }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: 14,
                  padding: 8,
                  background:
                    "linear-gradient(180deg, rgba(244,233,212,0.96) 0%, rgba(220,202,170,0.94) 100%)",
                  border: `1px solid ${borderColor}`,
                  boxShadow: isFocus
                    ? "0 0 0 2px rgba(108,123,82,0.35), 0 12px 24px rgba(0,0,0,0.18)"
                    : "0 12px 24px rgba(0,0,0,0.16)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 7,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "#6b5036",
                  }}
                />
                <div
                  style={{
                    marginTop: 8,
                    borderRadius: 10,
                    overflow: "hidden",
                    height: 72,
                    background: "#5f4b38",
                  }}
                >
                  {node.thumbnail_url && (
                    <img
                      src={node.thumbnail_url}
                      alt={node.common_name || node.scientific_name}
                      className="h-full w-full object-cover"
                      style={{ filter: "sepia(0.16) saturate(0.86)" }}
                    />
                  )}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    textAlign: "center",
                    fontFamily: "var(--font-manuscript)",
                    fontSize: 15,
                    lineHeight: 1.05,
                    color: "#342418",
                  }}
                >
                  {node.common_name || node.scientific_name}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
