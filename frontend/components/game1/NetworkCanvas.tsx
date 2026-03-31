"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { NetworkNode, NetworkLink } from "@/lib/types"

interface NetworkCanvasProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
}

const NODE_RADIUS = 32

export default function NetworkCanvas({ nodes, links }: NetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        console.log("Container rect:", rect.width, rect.height)
        if (rect.width > 0 && rect.height > 0) {
          setDims({ width: rect.width, height: rect.height })
        }
      }
    }
    measure()
    const obs = new ResizeObserver(measure)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const positions: Record<string, { x: number; y: number }> = {}
  if (nodes.length && dims.width) {
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const rx = dims.width / 2 - NODE_RADIUS - 20
      const ry = dims.height / 2 - NODE_RADIUS - 20
      positions[node.scientific_name] = {
        x: dims.width / 2 + Math.cos(angle) * rx * 0.6,
        y: dims.height / 2 + Math.sin(angle) * ry * 0.6,
      }
    })
  }

  const getPos = (name: string) => positions[name]
  
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ minHeight: 200 }}
    >
      {/* Empty state */}
      {nodes.length === 0 && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <svg width={80} height={80} viewBox="0 0 80 80" fill="none" opacity={0.3}>
            <circle cx={20} cy={40} r={10} stroke="#6B5A3E" strokeWidth={1.5} strokeDasharray="3 3" />
            <circle cx={60} cy={20} r={10} stroke="#6B5A3E" strokeWidth={1.5} strokeDasharray="3 3" />
            <circle cx={60} cy={60} r={10} stroke="#6B5A3E" strokeWidth={1.5} strokeDasharray="3 3" />
            <path d="M30 37l20-14M30 43l20 14" stroke="#3E2E18" strokeWidth={1} strokeDasharray="2 2" />
          </svg>
          <p style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 11,
            color: "#3E2E18",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}>
            Discover connections to build the web
          </p>
        </motion.div>
      )}

      {/* SVG links */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#5C4A2A" opacity={0.8} />
          </marker>
        </defs>
        <AnimatePresence>
          {links.map((link) => {
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
            const x2 = tgt.x - ux * (NODE_RADIUS + 8)
            const y2 = tgt.y - uy * (NODE_RADIUS + 8)
            const mx = (x1 + x2) / 2 - uy * 30
            const my = (y1 + y2) / 2 + ux * 30

            return (
              <motion.path
                key={`${link.predator_scientific}-${link.prey_scientific}`}
                d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                fill="none"
                stroke="#5C4A2A"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            )
          })}
        </AnimatePresence>
      </svg>

      {/* Nodes */}
      <AnimatePresence>
        {nodes.map((node) => {
          const pos = getPos(node.scientific_name)
          if (!pos) return null
          return (
            <motion.div
              key={node.scientific_name}
              className="absolute flex flex-col items-center gap-1"
              style={{
                left: pos.x - NODE_RADIUS,
                top: pos.y - NODE_RADIUS,
                width: NODE_RADIUS * 2,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
            >
              <div
                className="relative rounded-full overflow-hidden"
                style={{
                  width: NODE_RADIUS * 2,
                  height: NODE_RADIUS * 2,
                  background: "radial-gradient(circle, #2A1F0F 0%, #1A1208 100%)",
                  border: "1.5px solid #5C4A2A",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                }}
              >
                {node.thumbnail_url ? (
                  <img
                    src={node.thumbnail_url}
                    alt={node.common_name}
                    className="w-full h-full object-cover"
                    style={{ opacity: 0.75 }}
                  />
                ) : (
                  <span style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 14,
                    color: "#C8A96E",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}>
                    {(node.common_name || node.scientific_name)[0]}
                  </span>
                )}
                <div className="absolute inset-0 rounded-full" style={{ background: "rgba(180,120,40,0.08)" }} />
              </div>
              <span style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 8,
                color: "#6B5A3E",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                maxWidth: 80,
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: "center",
              }}>
                {node.common_name || node.scientific_name}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
