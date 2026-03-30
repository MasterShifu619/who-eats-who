"use client"

import { motion } from "framer-motion"
import type { Species } from "@/lib/types"

interface AnimalBlobProps {
  species: Species
  size?: number
  selected?: boolean
  dragging?: boolean
  onClick?: () => void
  onDragStart?: (e: React.PointerEvent) => void
}

// Deterministic blob path based on species name
// Each species gets a unique but consistent blob shape
function getBlobPath(seed: string, size: number): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }

  const r = size / 2
  const cx = r
  const cy = r
  const points = 8
  const angles = Array.from({ length: points }, (_, i) => (i / points) * Math.PI * 2)

  const radii = angles.map((_, i) => {
    const noise = Math.sin(hash * (i + 1) * 2.3) * 0.18
    return r * (0.72 + noise)
  })

  const coords = angles.map((angle, i) => ({
    x: cx + Math.cos(angle) * radii[i],
    y: cy + Math.sin(angle) * radii[i],
  }))

  // Smooth catmull-rom style path
  let path = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length; i++) {
    const curr = coords[i]
    const next = coords[(i + 1) % coords.length]
    const cpx = (curr.x + next.x) / 2
    const cpy = (curr.y + next.y) / 2
    path += ` Q ${curr.x} ${curr.y} ${cpx} ${cpy}`
  }
  path += " Z"
  return path
}

export default function AnimalBlob({
  species,
  size = 72,
  selected = false,
  dragging = false,
  onClick,
  onDragStart,
}: AnimalBlobProps) {
  const blobPath = getBlobPath(species.scientific_name, size)
  const clipId = `blob-clip-${species.scientific_name.replace(/\s+/g, "-")}`
  const label = species.common_name || species.scientific_name

  return (
    <motion.div
      className="relative flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing select-none"
      style={{ width: size, touchAction: "none" }}
      animate={{
        scale: dragging ? 1.1 : selected ? 1.05 : 1,
        opacity: dragging ? 0.85 : 1,
      }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      onPointerDown={onDragStart}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible", filter: dragging ? "drop-shadow(0 8px 24px rgba(0,0,0,0.6))" : "none" }}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={blobPath} />
          </clipPath>

          {/* Glow filter for selected state */}
          <filter id={`glow-${clipId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Blob background */}
        <path
          d={blobPath}
          fill={selected ? "#5C4A2A" : "#2A2018"}
          stroke={selected ? "#C8A96E" : "#6B5A3E"}
          strokeWidth={selected ? 2 : 1.5}
          style={{
            filter: selected ? `url(#glow-${clipId})` : "none",
          }}
        />

        {/* Animal thumbnail clipped to blob */}
        {species.thumbnail_url ? (
          <image
            href={species.thumbnail_url}
            x={0}
            y={0}
            width={size}
            height={size}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            style={{ opacity: 0.75 }}
          />
        ) : (
          // Fallback — first letter of common name
          <text
            x={size / 2}
            y={size / 2 + 6}
            textAnchor="middle"
            fill="#C8A96E"
            fontSize={size * 0.35}
            fontFamily="serif"
            clipPath={`url(#${clipId})`}
          >
            {label[0]}
          </text>
        )}

        {/* Warm overlay tint for cave painting feel */}
        <path
          d={blobPath}
          fill="rgba(180, 120, 40, 0.08)"
          stroke="none"
        />

        {/* Selected ring pulse */}
        {selected && (
          <motion.path
            d={blobPath}
            fill="none"
            stroke="#C8A96E"
            strokeWidth={2}
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
          />
        )}
      </svg>

      {/* Label */}
      <span
        className="text-center leading-tight"
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 9,
          color: selected ? "#C8A96E" : "#8B7355",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          maxWidth: size + 8,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </motion.div>
  )
}