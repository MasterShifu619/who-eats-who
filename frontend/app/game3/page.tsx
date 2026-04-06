"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ── Types ──────────────────────────────────────────────────────────────────
interface Node {
  id: string
  label: string
  emoji: string
  trophic: string
  x: number
  y: number
  vx: number
  vy: number
  deleted: boolean
  exploding: boolean
  starving: boolean
  pinned: boolean
}

interface Edge {
  prey: string
  predator: string
  deleting: boolean
  deleted: boolean
}

interface FuseParticle {
  edgeKey: string
  progress: number  // 0 to 1 along the path
  color: string
  startTime: number
  duration: number
  fromX: number; fromY: number
  cpX: number; cpY: number   // control point
  toX: number; toY: number
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  rotation: number
  rotSpeed: number
}

// ── Constants ──────────────────────────────────────────────────────────────
const DWELL_MS     = 5000   // 5 second hold to delete
const NODE_R       = 36
const REPEL        = 18000
const ATTRACT      = 0.012
const IDEAL_DIST   = 320
const DAMPING      = 0.78
const API_BASE     = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const TROPHIC_COLOR: Record<string, string> = {
  producer:  "#44DD88",
  primary:   "#44AAFF",
  secondary: "#FFAA00",
  tertiary:  "#FF6644",
  apex:      "#FF3333",
}

const TROPHIC_LABEL: Record<string, string> = {
  producer:  "Producer",
  primary:   "Primary Consumer",
  secondary: "Secondary Predator",
  tertiary:  "Tertiary Predator",
  apex:      "Apex Predator",
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Game3Page() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const nodesRef    = useRef<Node[]>([])
  const edgesRef    = useRef<Edge[]>([])
  const particlesRef= useRef<Particle[]>([])
  const fusesRef = useRef<FuseParticle[]>([])
  const animRef     = useRef<number>()
  const dwellRef    = useRef<{ nodeId: string; startTime: number; timerId: NodeJS.Timeout | null } | null>(null)
  const dragRef     = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)
  const hoveredRef  = useRef<string | null>(null)

  const [loading, setLoading]   = useState(true)
  const [info, setInfo]         = useState<{ name: string; emoji: string; eats: string[]; eatenBy: string[]; color: string } | null>(null)
  const [dwellProgress, setDwellProgress] = useState<{ nodeId: string; pct: number } | null>(null)
  const [message, setMessage]   = useState<{ text: string; color: string } | null>(null)
  const [deletedCount, setDeletedCount] = useState(0)
  const deletedSetRef = useRef<Set<string>>(new Set())
  const [dims, setDims]         = useState({ w: 1440, h: 900 })

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/game/foodweb/nc`)
      .then(r => r.json())
      .then(data => {
        const w = window.innerWidth, h = window.innerHeight
        setDims({ w, h })

        // Tier-based initial positions
        const tiers: Record<string, number> = { producer: 0, primary: 1, secondary: 2, tertiary: 3, apex: 4 }
        const byTier: Record<number, string[]> = {}
        data.nodes.forEach((n: any) => {
          const t = tiers[n.trophic] ?? 2
          byTier[t] = byTier[t] || []
          byTier[t].push(n.id)
        })

        const cx = w / 2, cy = h / 2
        const radii = [0, h * 0.32, h * 0.46, h * 0.54, h * 0.58]

        nodesRef.current = data.nodes.map((n: any) => {
          const tier = tiers[n.trophic] ?? 2
          const siblings = byTier[tier] || []
          const idx = siblings.indexOf(n.id)
          const total = siblings.length
          const angle = tier === 0 ? 0 : (idx / total) * Math.PI * 2 - Math.PI / 2 + tier * 0.2
          const r = radii[tier] || h * 0.3
          return {
            ...n,
            x: tier === 0 ? cx : cx + Math.cos(angle) * r,
            y: tier === 0 ? cy : cy + Math.sin(angle) * r,
            vx: 0, vy: 0,
            deleted: false, exploding: false, starving: false, pinned: false,
          }
        })

        edgesRef.current = data.edges.map((e: any) => ({
          ...e, deleting: false, deleted: false
        }))

        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // ── Physics tick ──────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const nodes = nodesRef.current.filter(n => !n.deleted)
    const edges = edgesRef.current.filter(e => !e.deleted)
    const { w, h } = dims

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        if (a.pinned && b.pinned) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        const f = REPEL / (d * d)
        a.vx -= (dx/d)*f; a.vy -= (dy/d)*f
        b.vx += (dx/d)*f; b.vy += (dy/d)*f
      }
    }

    // Attraction along edges
    edges.forEach(e => {
      const a = nodes.find(n => n.id === e.prey)
      const b = nodes.find(n => n.id === e.predator)
      if (!a || !b) return
      if (a.pinned && b.pinned) return
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1
      const f = (d - IDEAL_DIST) * ATTRACT
      a.vx += (dx/d)*f; a.vy += (dy/d)*f
      b.vx -= (dx/d)*f; b.vy -= (dy/d)*f
    })

    // Center gravity + integrate
    nodes.forEach(n => {
      if (dragRef.current?.nodeId === n.id) return
      if (n.pinned) {
        // Pinned nodes: zero velocity, stay put, only very gentle nudge if out of bounds
        n.vx = 0; n.vy = 0
        n.x = Math.max(65, Math.min(w - 65, n.x))
        n.y = Math.max(80, Math.min(h - 65, n.y))
        return
      }
      n.vx += (w/2 - n.x) * 0.001
      n.vy += (h/2 - n.y) * 0.001
      n.vx *= DAMPING; n.vy *= DAMPING
      n.x += n.vx; n.y += n.vy
      n.x = Math.max(65, Math.min(w - 65, n.x))
      n.y = Math.max(80, Math.min(h - 65, n.y))
    })
  }, [dims])

  // ── Particle system ───────────────────────────────────────────────────
  const spawnParticles = (x: number, y: number, color: string) => {
    const count = 60
    const newP: Particle[] = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 4
      newP.push({
        id: Date.now() + i,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: 3 + Math.random() * 6,
        color,
        alpha: 1,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
      })
    }
    particlesRef.current = [...particlesRef.current, ...newP]
  }

  // ── Cascade deletion ──────────────────────────────────────────────────
  const triggerCascade = useCallback(async (removedId: string) => {
    try {
        deletedSetRef.current.add(removedId)
        const res = await fetch(`${API_BASE}/game/foodweb/nc/cascade?removed=${encodeURIComponent([...deletedSetRef.current].join(","))}`)        
        const data = await res.json()

      if (data.exploding.length === 0 && data.starving.length === 0) return

      // Show warning message
      setMessage({ text: "⚠️ Watch the cascade...", color: "#FFAA00" })

      // Highlight exploding species
      data.exploding.forEach((id: string) => {
        const n = nodesRef.current.find(n => n.id === id)
        if (n) n.exploding = true
      })
      data.starving.forEach((id: string) => {
        const n = nodesRef.current.find(n => n.id === id)
        if (n) n.starving = true
      })

      await sleep(3000)

      for (const id of data.starving) {
        const n = nodesRef.current.find(n => n.id === id)
        if (!n || n.deleted) continue
        setMessage({ text: `🔴 ${n.emoji} ${n.label} is starving — no food sources remain!`, color: "#FF4444" })
        await sleep(1200)
        await deleteNodeAnimated(id, true)
        await sleep(600)
        // Recurse — this deletion may starve more species
        await triggerCascade(id)
      }
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      console.error(e)
    }
  }, [])

  // ── Delete node with full animation ───────────────────────────────────
  const deleteNodeAnimated = useCallback(async (nodeId: string, isCascade = false) => {
    const node = nodesRef.current.find(n => n.id === nodeId)
    if (!node || node.deleted) return

    const color = TROPHIC_COLOR[node.trophic] || "#FFFFFF"

    // Step 1: Delete connected edges one by one (staggered)
    const connectedEdges = edgesRef.current.filter(
      e => !e.deleted && (e.prey === nodeId || e.predator === nodeId)
    )

    for (const edge of connectedEdges) {
      edge.deleting = true
      const a = nodesRef.current.find(n => n.id === edge.prey)
      const b = nodesRef.current.find(n => n.id === edge.predator)
      if (a && b) {
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        const ux = dx/d, uy = dy/d
        const x1 = a.x + ux * NODE_R
        const y1 = a.y + uy * NODE_R
        const x2 = b.x - ux * (NODE_R + 10)
        const y2 = b.y - uy * (NODE_R + 10)
        const cpX = (x1+x2)/2 - uy*20
        const cpY = (y1+y2)/2 + ux*20
        const color = TROPHIC_COLOR[a.trophic] || "#FFF"
        fusesRef.current.push({
          edgeKey: `${edge.prey}-${edge.predator}`,
          progress: 0,
          color,
          startTime: Date.now(),
          duration: 1200,
          fromX: x1, fromY: y1,
          cpX, cpY,
          toX: x2, toY: y2,
        })
      }
      await sleep(1500)
      edge.deleted = true
      edge.deleting = false
      fusesRef.current = fusesRef.current.filter(f => f.edgeKey !== `${edge.prey}-${edge.predator}`)
    }

    await sleep(800)

    // Step 2: Snap particle explosion
    spawnParticles(node.x, node.y, color)

    // Step 3: Mark node deleted
    node.deleted = true
    setDeletedCount(c => c + 1)

    if (!isCascade) {
      setMessage({
        text: isCascade ? `${node.emoji} ${node.label} collapses...` : `${node.emoji} ${node.label} removed from the web`,
        color: isCascade ? "#FF6644" : color
      })
      setTimeout(() => setMessage(null), 2500)

      // Trigger cascade after node deletion
      await sleep(600)
      await triggerCascade(nodeId)
    }
  }, [triggerCascade])

  // ── Draw ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    let frameTime = 0

    const draw = (t: number) => {
      frameTime = t
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      tick()

      // Background
      ctx.fillStyle = "#06060F"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Stars
      for (let i = 0; i < 60; i++) {
        const sx = (i * 137.5 * canvas.width / 100) % canvas.width
        const sy = (i * 97.3 * canvas.height / 100) % canvas.height
        const sr = (Math.sin(t * 0.001 + i) * 0.5 + 0.5) * 1.8
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 3) * 0.1})`
        ctx.fill()
      }

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const hovId = hoveredRef.current

      // ── Edges ──
      edges.forEach(e => {
        if (e.deleted) return
        const a = nodes.find(n => n.id === e.prey && !n.deleted)
        const b = nodes.find(n => n.id === e.predator && !n.deleted)
        if (!a || !b) return

        const isHov = hovId && (hovId === e.prey || hovId === e.predator)
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        const ux = dx/d, uy = dy/d

        // Energy flows from prey(a) to predator(b)
        const x1 = a.x + ux * NODE_R
        const y1 = a.y + uy * NODE_R
        const x2 = b.x - ux * (NODE_R + 10)
        const y2 = b.y - uy * (NODE_R + 10)
        const mx = (x1+x2)/2 - uy*20
        const my = (y1+y2)/2 + ux*20

        const fuse = fusesRef.current.find(f => f.edgeKey === `${e.prey}-${e.predator}`)
        const fuseT = fuse ? Math.min((Date.now() - fuse.startTime) / fuse.duration, 1) : 0
        if (e.deleted) return
        if (e.deleting && (!fuse || fuseT >= 1)) { e.deleted = true; return }
        const alphaScale = 1

        const aColor = TROPHIC_COLOR[a.trophic] || "#FFF"
        const bColor = TROPHIC_COLOR[b.trophic] || "#FFF"
        const grad = ctx.createLinearGradient(x1, y1, x2, y2)
        grad.addColorStop(0, aColor + (isHov ? "DD" : e.deleting ? "33" : "55"))
        grad.addColorStop(1, bColor + (isHov ? "DD" : e.deleting ? "33" : "55"))

        if (e.deleting && fuse) {
          // Only draw the unconsumed portion (from fuseT to 1)
          ctx.beginPath()
          for (let i = 0; i <= 20; i++) {
            const s = fuseT + (i / 20) * (1 - fuseT)
            const qx = (1-s)*(1-s)*x1 + 2*(1-s)*s*mx + s*s*x2
            const qy = (1-s)*(1-s)*y1 + 2*(1-s)*s*my + s*s*y2
            if (i === 0) ctx.moveTo(qx, qy)
            else ctx.lineTo(qx, qy)
          }
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.2
          ctx.globalAlpha = 1
          ctx.stroke()
          ctx.globalAlpha = 1
        } else {
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.quadraticCurveTo(mx, my, x2, y2)
          ctx.strokeStyle = grad
          ctx.lineWidth = isHov ? 2.5 : 1.2
          ctx.globalAlpha = alphaScale
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        // Arrowhead
        const ang = Math.atan2(y2-my, x2-mx)
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - 11*Math.cos(ang-0.4), y2 - 11*Math.sin(ang-0.4))
        ctx.lineTo(x2 - 11*Math.cos(ang+0.4), y2 - 11*Math.sin(ang+0.4))
        ctx.closePath()
        ctx.fillStyle = bColor + (isHov ? "EE" : e.deleting ? "22" : "66")
        ctx.globalAlpha = alphaScale
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // ── Nodes ──
      nodes.forEach(n => {
        if (n.deleted) return
        const isHov = hovId === n.id
        const isDwelling = dwellRef.current?.nodeId === n.id
        const color = TROPHIC_COLOR[n.trophic] || "#FFF"
        const r = isHov ? NODE_R + 4 : NODE_R

        // Exploding pulse (green glow — population boom)
        if (n.exploding) {
          const pulse = Math.sin(t * 0.008) * 0.5 + 0.5
          const g = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 3)
          g.addColorStop(0, `rgba(100,255,100,${0.3 * pulse})`)
          g.addColorStop(1, "transparent")
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2)
          ctx.fill()
        }

        // Starving pulse (red glow)
        if (n.starving) {
          const pulse = Math.sin(t * 0.01) * 0.5 + 0.5
          const g = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 3)
          g.addColorStop(0, `rgba(255,60,60,${0.35 * pulse})`)
          g.addColorStop(1, "transparent")
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2)
          ctx.fill()
        }

        // Node glow
        if (isHov || isDwelling) {
          const g = ctx.createRadialGradient(n.x, n.y, r*0.3, n.x, n.y, r*3)
          g.addColorStop(0, color + "88")
          g.addColorStop(1, "transparent")
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(n.x, n.y, r*3, 0, Math.PI*2)
          ctx.fill()
        }

        // Circle background
        const bg = ctx.createRadialGradient(n.x - r*0.3, n.y - r*0.3, 2, n.x, n.y, r)
        bg.addColorStop(0, color + (isHov ? "55" : "22"))
        bg.addColorStop(1, "#06060F")
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI*2)
        ctx.fillStyle = bg
        ctx.fill()
        ctx.strokeStyle = isDwelling ? "#FF3333" : n.exploding ? "#44FF44" : n.starving ? "#FF4444" : color
        ctx.lineWidth = isDwelling ? 3 : isHov ? 2.5 : 1.8
        ctx.stroke()

        // Dwell countdown ring
        if (isDwelling && dwellRef.current) {
          const pct = (Date.now() - dwellRef.current.startTime) / DWELL_MS
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 8, -Math.PI/2, -Math.PI/2 + pct * Math.PI * 2)
          ctx.strokeStyle = "#FF3333"
          ctx.lineWidth = 4
          ctx.stroke()
        }

        // Emoji
        ctx.font = `${isHov ? 22 : 18}px serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(n.emoji, n.x, n.y - 1)

        // Label pill
        const lbl = n.label.toUpperCase()
        ctx.font = `bold ${isHov ? 11 : 9}px Arial, sans-serif`
        const tw = ctx.measureText(lbl).width
        const ly = n.y + r + 14
        ctx.fillStyle = "rgba(0,0,0,0.65)"
        ctx.beginPath()
        ctx.roundRect(n.x - tw/2 - 5, ly - 7, tw + 10, 14, 7)
        ctx.fill()
        ctx.fillStyle = n.exploding ? "#44FF44" : n.starving ? "#FF4444" : isHov ? "#FFFFFF" : color
        ctx.fillText(lbl, n.x, ly)
      })

      // ── Fuse particles ──
      const now = Date.now()
      fusesRef.current = fusesRef.current.filter(f => {
        const t = Math.min((now - f.startTime) / f.duration, 1)
        f.progress = t

        // Quadratic bezier point at progress t
        const px = (1-t)*(1-t)*f.fromX + 2*(1-t)*t*f.cpX + t*t*f.toX
        const py = (1-t)*(1-t)*f.fromY + 2*(1-t)*t*f.cpY + t*t*f.toY

        // Draw consumed trail (dark, erased)
        ctx.beginPath()
        ctx.moveTo(f.fromX, f.fromY)
        // Partial bezier — draw from start to current progress
        // Approximate with line segments
        for (let i = 0; i <= 20; i++) {
          const s = (i / 20) * t
          const qx = (1-s)*(1-s)*f.fromX + 2*(1-s)*s*f.cpX + s*s*f.toX
          const qy = (1-s)*(1-s)*f.fromY + 2*(1-s)*s*f.cpY + s*s*f.toY
          if (i === 0) ctx.moveTo(qx, qy)
          else ctx.lineTo(qx, qy)
        }
        ctx.strokeStyle = "#06060F"
        ctx.lineWidth = 6
        ctx.stroke()

        // Tail — last 5% of path behind spark
        ctx.beginPath()
        for (let i = 0; i <= 8; i++) {
          const s = Math.max(0, t - 0.06) + (i / 8) * 0.06
          const qx = (1-s)*(1-s)*f.fromX + 2*(1-s)*s*f.cpX + s*s*f.toX
          const qy = (1-s)*(1-s)*f.fromY + 2*(1-s)*s*f.cpY + s*s*f.toY
          if (i === 0) ctx.moveTo(qx, qy)
          else ctx.lineTo(qx, qy)
        }
        ctx.strokeStyle = "#FF8800"
        ctx.lineWidth = 3
        ctx.globalAlpha = 0.85
        ctx.stroke()
        ctx.globalAlpha = 1

        // Tail — last 5% of path behind spark
        ctx.beginPath()
        for (let i = 0; i <= 8; i++) {
          const s = Math.max(0, t - 0.06) + (i / 8) * 0.06
          const qx = (1-s)*(1-s)*f.fromX + 2*(1-s)*s*f.cpX + s*s*f.toX
          const qy = (1-s)*(1-s)*f.fromY + 2*(1-s)*s*f.cpY + s*s*f.toY
          if (i === 0) ctx.moveTo(qx, qy)
          else ctx.lineTo(qx, qy)
        }
        ctx.strokeStyle = "#FFFFFF"
        ctx.lineWidth = 2.5
        ctx.globalAlpha = 0.6
        ctx.stroke()
        ctx.globalAlpha = 1

        // Bright tip
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI*2)
        ctx.fillStyle = "#FFFFFF"
        ctx.fill()

        // Orange glow around tip
        const glowG = ctx.createRadialGradient(px, py, 0, px, py, 8)
        glowG.addColorStop(0, "rgba(255,200,50,0.9)")
        glowG.addColorStop(0.5, "rgba(255,100,0,0.5)")
        glowG.addColorStop(1, "transparent")
        ctx.fillStyle = glowG
        ctx.beginPath()
        ctx.arc(px, py, 8, 0, Math.PI*2)
        ctx.fill()

        // Sideways sparks — 4 small particles shooting off
        for (let k = 0; k < 4; k++) {
          const sparkAngle = Math.random() * Math.PI * 2
          const sparkDist = 4 + Math.random() * 8
          const sx = px + Math.cos(sparkAngle) * sparkDist
          const sy = py + Math.sin(sparkAngle) * sparkDist
          ctx.beginPath()
          ctx.arc(sx, sy, 1 + Math.random() * 1.5, 0, Math.PI*2)
          ctx.fillStyle = Math.random() > 0.5 ? "#FFFF00" : "#FF8800"
          ctx.globalAlpha = 0.6 + Math.random() * 0.4
          ctx.fill()
          ctx.globalAlpha = 1
        }

        // Flare at destination when done
        if (t >= 1) {
          const flareG = ctx.createRadialGradient(f.toX, f.toY, 0, f.toX, f.toY, 24)
          flareG.addColorStop(0, "#FFFFFF")
          flareG.addColorStop(0.4, f.color)
          flareG.addColorStop(1, "transparent")
          ctx.fillStyle = flareG
          ctx.beginPath()
          ctx.arc(f.toX, f.toY, 24, 0, Math.PI*2)
          ctx.fill()
        }

        return t < 1.15  // keep a bit after completion for flare
      })

      // ── Particles ──
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0.02)
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy
        p.vy += 0.018  // gravity — slow
        p.alpha -= 0.004
        p.rotation += p.rotSpeed
        p.size *= 0.993

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size)
        ctx.restore()
        ctx.globalAlpha = 1
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [loading, tick])

  // ── Pointer helpers ───────────────────────────────────────────────────
  const getNode = (x: number, y: number) =>
    nodesRef.current.find(n => !n.deleted && Math.hypot(x - n.x, y - n.y) < NODE_R + 8)

  const startDwell = useCallback((nodeId: string) => {
    if (dwellRef.current?.nodeId === nodeId) return
    if (dwellRef.current?.timerId) clearTimeout(dwellRef.current.timerId)

    const timerId = setTimeout(async () => {
      dwellRef.current = null
      setDwellProgress(null)
      await deleteNodeAnimated(nodeId)
    }, DWELL_MS)

    dwellRef.current = { nodeId, startTime: Date.now(), timerId }

    // Progress updater
    const progressInterval = setInterval(() => {
      if (!dwellRef.current || dwellRef.current.nodeId !== nodeId) {
        clearInterval(progressInterval)
        return
      }
      const pct = (Date.now() - dwellRef.current.startTime) / DWELL_MS
      setDwellProgress({ nodeId, pct: Math.min(pct, 1) })
      if (pct >= 1) clearInterval(progressInterval)
    }, 50)
  }, [deleteNodeAnimated])

  const cancelDwell = useCallback(() => {
    if (dwellRef.current?.timerId) clearTimeout(dwellRef.current.timerId)
    dwellRef.current = null
    setDwellProgress(null)
  }, [])

  // ── Pointer events ────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const node = getNode(x, y)
    if (node) {
      dragRef.current = { nodeId: node.id, offsetX: node.x - x, offsetY: node.y - y }
      hoveredRef.current = node.id
      startDwell(node.id)
      const eats = edgesRef.current.filter(ed => ed.predator === node.id && !ed.deleted).map(ed => ed.prey)
      const eatenBy = edgesRef.current.filter(ed => ed.prey === node.id && !ed.deleted).map(ed => ed.predator)
      setInfo({ name: node.label, emoji: node.emoji, eats, eatenBy, color: TROPHIC_COLOR[node.trophic] })
    }
  }, [startDwell])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const node = getNode(x, y)

    if (dragRef.current) {
      const n = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (n) { n.x = x + dragRef.current.offsetX; n.y = y + dragRef.current.offsetY; n.vx = 0; n.vy = 0 }

      // Cancel dwell if moved too far
      if (dwellRef.current && node?.id !== dwellRef.current.nodeId) cancelDwell()
    } else {
      hoveredRef.current = node?.id || null
      if (node && !node.deleted) {
        const eats = edgesRef.current.filter(ed => ed.predator === node.id && !ed.deleted).map(ed => ed.prey)
        const eatenBy = edgesRef.current.filter(ed => ed.prey === node.id && !ed.deleted).map(ed => ed.predator)
        setInfo({ name: node.label, emoji: node.emoji, eats, eatenBy, color: TROPHIC_COLOR[node.trophic] })
      } else {
        setInfo(null)
      }
    }
  }, [cancelDwell])

  const handlePointerUp = useCallback(() => {
    if (dragRef.current) {
      // Pin node at its current position so physics won't drag it back
      const n = nodesRef.current.find(n => n.id === dragRef.current!.nodeId)
      if (n) { n.pinned = true; n.vx = 0; n.vy = 0 }
    }
    dragRef.current = null
    cancelDwell()
  }, [cancelDwell])

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ width:"100vw", height:"100vh", background:"#06060F", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontFamily:"system-ui", fontSize:18, color:"#FFAA00", letterSpacing:"0.2em" }}>Loading food web...</div>
    </div>
  )

  const totalNodes = nodesRef.current.length
  const activeCount = totalNodes - deletedCount

  return (
    <div style={{ width:"100vw", height:"100vh", position:"relative", overflow:"hidden", userSelect:"none" }}>
      <canvas ref={canvasRef}
        style={{ display:"block", touchAction:"none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Title */}
      <div style={{ position:"absolute", top:18, left:"50%", transform:"translateX(-50%)", textAlign:"center", pointerEvents:"none" }}>
        <div style={{ fontFamily:"system-ui", fontWeight:900, fontSize:18, color:"white", letterSpacing:"0.2em", textShadow:"0 0 20px rgba(255,255,255,0.3)" }}>
          🌿 NC Food Web
        </div>
        <div style={{ fontFamily:"system-ui", fontSize:10, color:"rgba(255,255,255,0.35)", letterSpacing:"0.15em", marginTop:3 }}>
          Hold on a species for 5 seconds to remove it
        </div>
      </div>

      {/* Species count */}
      <div style={{ position:"absolute", top:20, left:20, fontFamily:"system-ui", fontWeight:900, fontSize:16, color:"rgba(255,255,255,0.5)", pointerEvents:"none" }}>
        {loading ? "Loading..." : `${activeCount} / ${totalNodes} species`}
      </div>

      {/* Back */}
      <a href="/game2/heron" style={{ position:"absolute", top:20, right:20, fontFamily:"system-ui", fontWeight:700, fontSize:12, color:"rgba(255,255,255,0.3)", textDecoration:"none" }}>← Back</a>

      {/* Legend */}
      <div style={{ position:"absolute", bottom:20, left:20, pointerEvents:"none" }}>
        {Object.entries(TROPHIC_LABEL).map(([k, v]) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:TROPHIC_COLOR[k] }}/>
            <span style={{ fontFamily:"system-ui", fontSize:9, color:TROPHIC_COLOR[k], letterSpacing:"0.1em", textTransform:"uppercase" }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#44FF44" }}/>
          <span style={{ fontFamily:"system-ui", fontSize:9, color:"#44FF44", letterSpacing:"0.1em", textTransform:"uppercase" }}>Population boom</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:4 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#FF4444" }}/>
          <span style={{ fontFamily:"system-ui", fontSize:9, color:"#FF4444", letterSpacing:"0.1em", textTransform:"uppercase" }}>May starve</span>
        </div>
      </div>

      {/* Info panel */}
      <AnimatePresence>
        {info && (
          <motion.div
            style={{
              position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)",
              background:"rgba(0,0,0,0.75)", borderRadius:12, padding:"14px 24px",
              border:`1px solid ${info.color}44`, minWidth:280, textAlign:"center",
              backdropFilter:"blur(8px)",
            }}
            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }}
          >
            <div style={{ fontFamily:"system-ui", fontWeight:900, fontSize:20, color:info.color }}>
              {info.emoji} {info.name}
            </div>
            {info.eats.length > 0 && (
              <div style={{ fontFamily:"system-ui", fontSize:11, color:"#FFAA00", marginTop:6, letterSpacing:"0.06em" }}>
                🍽 Eats: {info.eats.join(", ")}
              </div>
            )}
            {info.eatenBy.length > 0 && (
              <div style={{ fontFamily:"system-ui", fontSize:11, color:"#FF6644", marginTop:4, letterSpacing:"0.06em" }}>
                ⚠️ Eaten by: {info.eatenBy.join(", ")}
              </div>
            )}
            {info.eatenBy.length === 0 && (
              <div style={{ fontFamily:"system-ui", fontSize:11, color:"#44FF44", marginTop:4 }}>⬆️ Population is increasing — nothing is hunting this species!</div>
            )}
            <div style={{ fontFamily:"system-ui", fontSize:9, color:"rgba(255,255,255,0.3)", marginTop:8, letterSpacing:"0.1em" }}>
              HOLD FOR 5 SECONDS TO REMOVE
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message banner */}
      <AnimatePresence>
        {message && (
          <motion.div style={{
            position:"absolute", top:"30%", left:"50%", transform:"translateX(-50%)",
            background:"rgba(0,0,0,0.8)", borderRadius:12, padding:"16px 32px",
            border:`2px solid ${message.color}`, pointerEvents:"none",
            backdropFilter:"blur(8px)",
          }}
            initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.8, opacity:0 }}
            transition={{ type:"spring", stiffness:300, damping:22 }}
          >
            <div style={{ fontFamily:"system-ui", fontWeight:900, fontSize:22, color:message.color, textAlign:"center" }}>
              {message.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win/empty state */}
      <AnimatePresence>
        {totalNodes > 0 && activeCount === 0 && (
          <motion.div style={{
            position:"absolute", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          }} initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <div style={{ fontSize:72 }}>💀</div>
            <div style={{ fontFamily:"system-ui", fontWeight:900, fontSize:36, color:"#FF3333", marginTop:16 }}>
              The web has collapsed
            </div>
            <div style={{ fontFamily:"system-ui", fontSize:16, color:"rgba(255,255,255,0.6)", marginTop:8 }}>
              Every species is gone
            </div>
            <button style={{
              marginTop:32, padding:"14px 44px", fontFamily:"system-ui", fontWeight:800,
              fontSize:16, color:"#06060F", background:"#44DD88", border:"none",
              borderRadius:50, cursor:"pointer",
            }}
              onClick={() => window.location.reload()}
            >🔄 Restore the Web</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }