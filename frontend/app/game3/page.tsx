"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { preloadSound, playPlaceSound, playRemoveSound, playPlaceChime, playCascadeWarning } from "@/lib/sounds"
import Tutorial, { shouldShowTutorial } from "@/components/game3/Tutorial"

// Test 
interface NodeDef {
  id: string; label: string; emoji: string; trophic: string; shelf: string
}
interface PlacedNode {
  id: string; x: number; y: number; vx: number; vy: number
  deleted: boolean; exploding: boolean; starving: boolean; pinned: boolean
}
interface Edge { prey: string; predator: string; deleting: boolean; deleted: boolean }
interface FuseParticle {
  edgeKey: string; progress: number; color: string; startTime: number; duration: number
  fromX: number; fromY: number; cpX: number; cpY: number; toX: number; toY: number
}
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number
  size: number; color: string; alpha: number; rotation: number; rotSpeed: number
}

const DWELL_MS=3000, NODE_R=36, REPEL=18000, ATTRACT=0.012, IDEAL_DIST=280, DAMPING=0.78
const SHELF_W = typeof window !== "undefined" ? Math.max(180, Math.min(280, window.innerWidth * 0.20)) : 220
const API_BASE=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000"

// Watercolor field-guide trophic palette
const TROPHIC_COLOR: Record<string,string>={
  producer:  "#6B8C5E",   // sage green
  primary:   "#C8851A",   // warm ochre
  secondary: "#4A8B8C",   // soft teal
  tertiary:  "#A0522D",   // rust / terracotta
  apex:      "#6B8CAA",   // dusty blue
  sun:       "#D4A847",   // warm amber
}

// PNGs that replace emojis on canvas
const NODE_PNG_MAP: Record<string,string> = {
  "Monarch Butterfly":    "/Butterfly.svg",
  "Atlantic Blue Crab":   "/Crab.svg",
  "Pondhawk Dragonfly":   "/Dragonfly.svg",
  "Green Sunfish":        "/Fish.svg",
  "Tree Frog":            "/Frog.svg",
  "Green Anole lizard":   "/lizard.svg",
  "Eastern Ratsnake":     "/rattlesnake.svg",
  "White-footed Mouse":   "/mouse.svg",
  "Yellow Garden Spider": "/spider.svg",
  "Black Carpenter Ant":  "/ant.svg",
  "Grasshopper":          "/grasshopper.svg",
  "Green June Beetle":    "/beetle.svg",
  "Earthworm":            "/worm.svg",
  "Persimmon":       "/persimmon.svg",
  "Blue Heron":           "/BlueHeron.svg",
}

const SUN_ID = "Sun"

const SHELF_MAP: Record<string,string>={
  "Sun":                  "☀️ Sun",
  "Persimmon":       "🌱 Plants",
  "Earthworm":            "🐛 Bugs","Monarch Butterfly":"🐛 Bugs","Green June Beetle":"🐛 Bugs",
  "Grasshopper":          "🐛 Bugs","Black Carpenter Ant":"🐛 Bugs","Pondhawk Dragonfly":"🐛 Bugs","Yellow Garden Spider":"🐛 Bugs",
  "Green Sunfish":        "🐟 Water Animals","Atlantic Blue Crab":"🐟 Water Animals",
  "Tree Frog":            "🐸 Land Animals","White-footed Mouse":"🐸 Land Animals",
  "Green Anole lizard":   "🦎 Reptiles","Eastern Ratsnake":"🦎 Reptiles",
  "Blue Heron":           "🐦 Birds",
}
const SHELF_ORDER=["☀️ Sun","🌱 Plants","🐛 Bugs","🐟 Water Animals","🐸 Land Animals","🦎 Reptiles","🐦 Birds"]

const logEvent = (animal: string, action: "ADDED" | "DELETED" | "STARTED" | "DELETED_CASCADE", state: 0 | 1 | 2 = 0) => {
  fetch("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(ipData => {
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animal,
          action,
          browser: navigator.userAgent,
          ip: ipData.ip,
          state,
          game: "who-eats-whom"
        }),
      }).catch(() => {})
    })
    .catch(() => {
      // fallback without IP
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animal,
          action,
          browser: navigator.userAgent,
          ip: "unknown",
          state,
          game: "who-eats-whom"
        }),
      }).catch(() => {})
    })
}

// All feeding edges [prey, predator]
const ALL_EDGES: [string,string][]=[
  ["Persimmon","Grasshopper"],["Persimmon","Monarch Butterfly"],["Persimmon","Earthworm"],["Persimmon","Black Carpenter Ant"],["Persimmon","White-footed Mouse"],
  ["Persimmon","Green June Beetle"],
  ["Earthworm","Tree Frog"],["Earthworm","Eastern Ratsnake"],["Earthworm","Green Sunfish"],["Earthworm","Blue Heron"],
  ["Earthworm","Atlantic Blue Crab"],
  ["Monarch Butterfly","Pondhawk Dragonfly"],["Monarch Butterfly","Yellow Garden Spider"],["Monarch Butterfly","Tree Frog"],["Monarch Butterfly","Green Anole lizard"],
  ["Green June Beetle","Tree Frog"],["Green June Beetle","Yellow Garden Spider"],["Green June Beetle","White-footed Mouse"],
  ["Grasshopper","Pondhawk Dragonfly"],["Grasshopper","Tree Frog"],["Grasshopper","Eastern Ratsnake"],["Grasshopper","Green Anole lizard"],["Grasshopper","Blue Heron"],
  ["Pondhawk Dragonfly","Tree Frog"],["Pondhawk Dragonfly","Green Sunfish"],["Pondhawk Dragonfly","Yellow Garden Spider"],["Pondhawk Dragonfly","Green Anole lizard"],
  ["Black Carpenter Ant","Tree Frog"],["Black Carpenter Ant","Yellow Garden Spider"],["Black Carpenter Ant","Green Anole lizard"],
  ["Yellow Garden Spider","Tree Frog"],["Yellow Garden Spider","Eastern Ratsnake"],["Yellow Garden Spider","Green Anole lizard"],
  ["Atlantic Blue Crab","Blue Heron"],["Atlantic Blue Crab","Green Sunfish"],["Atlantic Blue Crab","Eastern Ratsnake"],
  ["Green Sunfish","Blue Heron"],["Green Sunfish","Eastern Ratsnake"],["Green Sunfish","Green Anole lizard"],
  ["Tree Frog","Eastern Ratsnake"],["Tree Frog","Blue Heron"],["Tree Frog","Green Anole lizard"],
  ["White-footed Mouse","Eastern Ratsnake"],["White-footed Mouse","Blue Heron"],["White-footed Mouse","Green Anole lizard"],
  ["Eastern Ratsnake","Blue Heron"],["Green Anole lizard","Blue Heron"],["Green Anole lizard","Eastern Ratsnake"],
]

// Static node definitions — no backend needed for game3
const STATIC_NODES: NodeDef[] = [
  { id:"Sun",        label:"Sun",         emoji:"☀️", trophic:"sun",       shelf:"☀️ Sun" },
  { id:"Persimmon",      label:"Persimmon",       emoji:"🍊", trophic:"producer",  shelf:"🌱 Plants" },
  { id:"Earthworm",       label:"Earthworm",        emoji:"🪱", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Monarch Butterfly",  label:"Monarch Butterfly",   emoji:"🦋", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Green June Beetle",     label:"Green June Beetle",      emoji:"🪲", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Grasshopper",       label:"Grasshopper",        emoji:"🦗", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Black Carpenter Ant",        label:"Black Carpenter Ant",         emoji:"🐜", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Pondhawk Dragonfly",  label:"Pondhawk Dragonfly",   emoji:"🪰", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Yellow Garden Spider",     label:"Yellow Garden Spider",      emoji:"🕷️", trophic:"secondary", shelf:"🐛 Bugs" },
  { id:"Green Sunfish",       label:"Green Sunfish",        emoji:"🐟", trophic:"secondary", shelf:"🐟 Water Animals" },
  { id:"Atlantic Blue Crab",       label:"Atlantic Blue Crab",        emoji:"🦀", trophic:"secondary", shelf:"🐟 Water Animals" },
  { id:"Tree Frog",       label:"Tree Frog",        emoji:"🐸", trophic:"secondary", shelf:"🐸 Land Animals" },
  { id:"White-footed Mouse",        label:"White-footed Mouse",         emoji:"🐀", trophic:"secondary", shelf:"🐸 Land Animals" },
  { id:"Green Anole lizard",     label:"Green Anole lizard",      emoji:"🦎", trophic:"tertiary",  shelf:"🦎 Reptiles" },
  { id:"Eastern Ratsnake",      label:"Eastern Ratsnake",       emoji:"🐍", trophic:"tertiary",  shelf:"🦎 Reptiles" },
  { id:"Blue Heron", label:"Blue Heron",  emoji:"🦤", trophic:"apex",      shelf:"🐦 Birds" },
]

export default function Game3Page() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const placedRef    = useRef<PlacedNode[]>([])
  const edgesRef     = useRef<Edge[]>([])
  const particlesRef = useRef<Particle[]>([])
  const fusesRef     = useRef<FuseParticle[]>([])
  const animRef      = useRef<number|null>(null)
  const dwellRef     = useRef<Map<number,{nodeId:string;startTime:number;timerId:ReturnType<typeof setTimeout>|null}>>(new Map())
  const dragRef      = useRef<Map<number,{nodeId:string;fromShelf:boolean;offsetX:number;offsetY:number}>>(new Map())
  const hoveredRef   = useRef<string|null>(null)
  const sunPresentRef = useRef(false)
  const placedIdsRef = useRef<Set<string>>(new Set())
  const nodeImagesRef = useRef<Record<string,HTMLImageElement>>({})


  const [showTutorial, setShowTutorial] = useState(false)
  const [allNodes]   = useState<NodeDef[]>(STATIC_NODES)
  const [placedIds,setPlacedIds]     = useState<Set<string>>(new Set())
  const [message,setMessage]         = useState<{text:string;color:string}|null>(null)
  const [shelfOpen,setShelfOpen]     = useState<Record<string,boolean>>(Object.fromEntries(SHELF_ORDER.map(s=>[s,true])))
  const [shelfVisible,setShelfVisible] = useState(true)
  const [dims,setDims]               = useState({w:1440,h:900})
  const [shelfDrag,setShelfDrag]     = useState<{nodeId:string;x:number;y:number}|null>(null)
  const [sunPresent,setSunPresent]   = useState(false)
  const [daytimeBg,setDaytimeBg]     = useState<HTMLImageElement|null>(null)

  // Show tutorial on every page load
  useEffect(()=>{
  setShowTutorial(true)
  logEvent("SESSION", "STARTED")
},[])

  // Load background + PNG animal images
  useEffect(()=>{
    const bg = new Image()
    bg.src = "/watercolor-lake-background.jpg"
    bg.onload = () => setDaytimeBg(bg)
    setDims({w:window.innerWidth,h:window.innerHeight})
    STATIC_NODES.forEach(n=>preloadSound(n.id))
    // Preload PNG animal illustrations
    Object.entries(NODE_PNG_MAP).forEach(([id, src])=>{
      const img = new Image()
      img.src = src
      img.onload = () => { nodeImagesRef.current[id] = img }
    })
  },[])

  const isSunPlaced = useCallback(()=>sunPresentRef.current,[])

  const placeAnimal=useCallback((id:string,x:number,y:number)=>{
    console.log("placedIdsRef has Sun:", placedIdsRef.current.has("Sun"), [...placedIdsRef.current])
    console.log("passed placedIds check for", id)
    if(placedIdsRef.current.has(id)) return

    // Block non-sun animals if sun is not present
    if(id !== SUN_ID && !isSunPlaced()){
      // Place temporarily, show dying animation
      const px=Math.max(SHELF_W+60,Math.min(dims.w-60,x))
      const py=Math.max(60,Math.min(dims.h-60,y))
      placedRef.current=placedRef.current.filter(n=>n.id!==id)
      placedRef.current.push({id,x:px,y:py,vx:0,vy:0,deleted:false,exploding:false,starving:true,pinned:true})
      setPlacedIds(prev=>new Set([...prev,id]))
      placedIdsRef.current = new Set([...placedIdsRef.current, id])
      setMessage({text:`☀️ No sun — ${STATIC_NODES.find(n=>n.id===id)?.emoji} ${id} cannot survive!`,color:"#FF4444"})
      setTimeout(async()=>{
        const node=placedRef.current.find(n=>n.id===id)
        if(node){
          spawnParticles(node.x,node.y,TROPHIC_COLOR[STATIC_NODES.find(n=>n.id===id)?.trophic||""]||"#FFF")
          node.deleted=true
        }
        setTimeout(()=>{
          placedRef.current=placedRef.current.filter(n=>n.id!==id)
          setPlacedIds(prev=>{const s=new Set(prev);s.delete(id);return s})
          placedIdsRef.current.delete(id)
          setMessage(null)
        },600)
      },1800)
      return
    }

    // Check if animal has at least one food source in play area
    if(id !== SUN_ID) {
      const myPrey=ALL_EDGES.filter(([,pred])=>pred===id).map(([prey])=>prey)
      const present=new Set(placedRef.current.filter(n=>!n.deleted&&n.id!==id).map(n=>n.id))
      if(myPrey.length>0 && myPrey.every(p=>!present.has(p))){
        const def=STATIC_NODES.find(n=>n.id===id)
        const px=Math.max(SHELF_W+60,Math.min(dims.w-60,x))
        const py=Math.max(60,Math.min(dims.h-60,y))
        placedRef.current=placedRef.current.filter(n=>n.id!==id)
        placedRef.current.push({id,x:px,y:py,vx:0,vy:0,deleted:false,exploding:false,starving:true,pinned:true})
        setPlacedIds(prev=>new Set([...prev,id]))
        placedIdsRef.current.add(id)
        setMessage({text:`🍽️ No food for ${def?.emoji} ${id} — add its prey first!`,color:"#FF4444"})
        setTimeout(async()=>{
          const node=placedRef.current.find(n=>n.id===id)
          if(node){
            spawnParticles(node.x,node.y,TROPHIC_COLOR[def?.trophic||""]||"#FFF")
            node.deleted=true
          }
          setTimeout(()=>{
            placedRef.current=placedRef.current.filter(n=>n.id!==id)
            setPlacedIds(prev=>{const s=new Set(prev);s.delete(id);return s})
            placedIdsRef.current.delete(id)
            setMessage(null)
          },600)
        },1800)
        return
      }
    }

    const px=Math.max(SHELF_W+60,Math.min(dims.w-60,x))
    const py=Math.max(60,Math.min(dims.h-60,y))
    console.log("reached placement code for", id)
    placedRef.current=placedRef.current.filter(n=>n.id!==id)
    placedRef.current.push({id,x:px,y:py,vx:0,vy:0,deleted:false,exploding:false,starving:false,pinned:false})
    placedIdsRef.current.add(id)
    if(id===SUN_ID){
      sunPresentRef.current=true
      setSunPresent(true)
      console.log("sun placed, sunPresentRef:", sunPresentRef.current, "placedRef count:", placedRef.current.filter(n=>!n.deleted).length)
    } else {
      const present=new Set(placedRef.current.filter(n=>!n.deleted).map(n=>n.id))
      ALL_EDGES.forEach(([prey,pred])=>{
        if((prey===id&&present.has(pred))||(pred===id&&present.has(prey))){
          const existing=edgesRef.current.find(e=>e.prey===prey&&e.predator===pred)
          if(existing){existing.deleted=false;existing.deleting=false}
          else edgesRef.current.push({prey,predator:pred,deleting:false,deleted:false})
        }
      })
    }

    setPlacedIds(prev=>new Set([...prev,id]))
    placedRef.current.forEach(n=>{if(n.id!==SUN_ID){n.exploding=false;n.starving=false}})
    logEvent(id,"ADDED")
    preloadSound(id).then(() => playPlaceSound(id))
    playPlaceChime()
  },[placedIds,dims,isSunPlaced])

  const returnToShelf=useCallback((id:string)=>{
    placedRef.current=placedRef.current.filter(n=>n.id!==id)
    edgesRef.current=edgesRef.current.filter(e=>e.prey!==id&&e.predator!==id)
    placedIdsRef.current.delete(id)
    setPlacedIds(prev=>{const s=new Set(prev);s.delete(id);return s})
    if(id===SUN_ID){sunPresentRef.current=false;setSunPresent(false)}
  },[])

  const autoFill=useCallback(()=>{
    const unplaced=allNodes.filter(n=>!placedIds.has(n.id)&&n.id!==SUN_ID)
    const {w,h}=dims
    unplaced.forEach((n,i)=>{
      const angle=(i/unplaced.length)*Math.PI*2
      const r=Math.min(w-SHELF_W,h)*0.32
      placeAnimal(n.id,SHELF_W+(w-SHELF_W)/2+Math.cos(angle)*r,h/2+Math.sin(angle)*r)
    })
  },[allNodes,placedIds,dims,placeAnimal])

  const tick=useCallback(()=>{
    const nodes=placedRef.current.filter(n=>!n.deleted&&n.id!==SUN_ID)
    const edges=edgesRef.current.filter(e=>!e.deleted)
    const {w,h}=dims
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j]; if(a.pinned&&b.pinned) continue
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=REPEL/(d*d)
      a.vx-=(dx/d)*f;a.vy-=(dy/d)*f;b.vx+=(dx/d)*f;b.vy+=(dy/d)*f
    }
    edges.forEach(e=>{
      const a=nodes.find(n=>n.id===e.prey),b=nodes.find(n=>n.id===e.predator)
      if(!a||!b||a.pinned&&b.pinned) return
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-IDEAL_DIST)*ATTRACT
      a.vx+=(dx/d)*f;a.vy+=(dy/d)*f;b.vx-=(dx/d)*f;b.vy-=(dy/d)*f
    })
    const cx=SHELF_W+(w-SHELF_W)/2,cy=h/2
    nodes.forEach(n=>{
      if([...dragRef.current.values()].some(d=>d.nodeId===n.id)) return
      if(n.pinned){n.vx=0;n.vy=0;return}
      n.vx+=(cx-n.x)*0.001;n.vy+=(cy-n.y)*0.001
      n.vx*=DAMPING;n.vy*=DAMPING;n.x+=n.vx;n.y+=n.vy
      n.x=Math.max(SHELF_W+55,Math.min(w-55,n.x));n.y=Math.max(55,Math.min(h-55,n.y))
    })
  },[dims])

  const spawnParticles=(x:number,y:number,color:string)=>{
    const newP:Particle[]=[]
    for(let i=0;i<60;i++){
      const a=Math.random()*Math.PI*2,s=1+Math.random()*4
      newP.push({id:Date.now()+i,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,
        size:3+Math.random()*6,color,alpha:1,rotation:Math.random()*360,rotSpeed:(Math.random()-0.5)*8})
    }
    particlesRef.current=[...particlesRef.current,...newP]
  }

  // const triggerCascade=useCallback(async(removedId:string)=>{
  //   const presentIds=new Set(placedRef.current.filter(n=>!n.deleted&&n.id!==SUN_ID).map(n=>n.id))
  //   const starving:string[]=[],exploding:string[]=[]
  //   presentIds.forEach(id=>{
  //     const myPrey=ALL_EDGES.filter(([,pred])=>pred===id).map(([prey])=>prey)
  //     const myPreds=ALL_EDGES.filter(([prey])=>prey===id).map(([,pred])=>pred)
  //     if(myPrey.length>0&&myPrey.every(p=>!presentIds.has(p))) starving.push(id)
  //     if(myPreds.length>0&&myPreds.every(p=>!presentIds.has(p))) exploding.push(id)
  //   })
  const triggerCascade=useCallback(async(removedId:string)=>{
    const presentIds=new Set(placedRef.current.filter(n=>!n.deleted&&n.id!==SUN_ID).map(n=>n.id))
    const starving:string[]=[],exploding:string[]=[]

    // Species that removedId was eating — they might now explode (no predators)
    const preyOfRemoved=ALL_EDGES
      .filter(([,pred])=>pred===removedId)
      .map(([prey])=>prey)
      .filter(id=>presentIds.has(id))

    // Species that were eating removedId — they might now starve (no food)
    const predatorsOfRemoved=ALL_EDGES
      .filter(([prey])=>prey===removedId)
      .map(([,pred])=>pred)
      .filter(id=>presentIds.has(id))

    preyOfRemoved.forEach(id=>{
      const myPreds=ALL_EDGES.filter(([prey])=>prey===id).map(([,pred])=>pred)
      if(myPreds.length>0&&myPreds.every(p=>!presentIds.has(p))) exploding.push(id)
    })
    predatorsOfRemoved.forEach(id=>{
      const myPrey=ALL_EDGES.filter(([,pred])=>pred===id).map(([prey])=>prey)
      if(myPrey.length>0&&myPrey.every(p=>!presentIds.has(p))) starving.push(id)
    })
    if(starving.length===0&&exploding.length===0) return
    setMessage({text:"⚠️ Watch the cascade...",color:"#FFAA00"})
    playCascadeWarning()
    exploding.forEach(id=>{const n=placedRef.current.find(n=>n.id===id);if(n)n.exploding=true})
    starving.forEach(id=>{const n=placedRef.current.find(n=>n.id===id);if(n)n.starving=true})
    await sleep(3000)
    for(const id of starving){
      const n=placedRef.current.find(n=>n.id===id);if(!n||n.deleted) continue
      const def=STATIC_NODES.find(d=>d.id===id)
      setMessage({text:`🔴 ${def?.emoji} ${id} is starving — no food sources remain!`,color:"#FF4444"})
      await sleep(1200);await deleteNodeAnimated(id,true);await sleep(600);await triggerCascade(id)
    }
    setTimeout(()=>setMessage(null),2000)
  },[])

  const killAllAnimals=useCallback(async()=>{
    const animals=placedRef.current.filter(n=>!n.deleted&&n.id!==SUN_ID)
    setMessage({text:"🌑 The sun is gone — nothing can survive...",color:"#FF4444"})
    playCascadeWarning()
    for(const node of animals){
      node.starving=true
      await sleep(400)
      const def=STATIC_NODES.find(d=>d.id===node.id)
      const color=TROPHIC_COLOR[def?.trophic||""]||"#FFF"
      const connected=edgesRef.current.filter(e=>!e.deleted&&(e.prey===node.id||e.predator===node.id))
      connected.forEach(e=>{e.deleted=true})
      await sleep(600)
      spawnParticles(node.x,node.y,color)
      node.deleted=true
      logEvent(node.id,"DELETED")
      playRemoveSound(node.id)
      setTimeout(()=>returnToShelf(node.id),500)
    }
    setTimeout(()=>setMessage(null),3000)
  },[returnToShelf])

  const deleteNodeAnimated=useCallback(async(nodeId:string,isCascade=false)=>{
    const node=placedRef.current.find(n=>n.id===nodeId);if(!node||node.deleted) return
    const def=STATIC_NODES.find(d=>d.id===nodeId)
    const color=TROPHIC_COLOR[def?.trophic||""]||"#FFF"

    // Sun deletion — kill everything
    if(nodeId===SUN_ID){
      node.deleted=true
      logEvent(SUN_ID,"DELETED")
      sunPresentRef.current=false;setSunPresent(false)
      setTimeout(()=>returnToShelf(SUN_ID),500)
      await killAllAnimals()
      return
    }

    const connected=edgesRef.current.filter(e=>!e.deleted&&(e.prey===nodeId||e.predator===nodeId))
    for(const edge of connected){
      edge.deleting=true
      const a=placedRef.current.find(n=>n.id===edge.prey),b=placedRef.current.find(n=>n.id===edge.predator)
      if(a&&b){
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d
        const x1=a.x+ux*NODE_R,y1=a.y+uy*NODE_R,x2=b.x-ux*(NODE_R+10),y2=b.y-uy*(NODE_R+10)
        fusesRef.current.push({edgeKey:`${edge.prey}-${edge.predator}`,progress:0,
          color,startTime:Date.now(),duration:1200,
          fromX:x1,fromY:y1,cpX:(x1+x2)/2-uy*20,cpY:(y1+y2)/2+ux*20,toX:x2,toY:y2})
      }
      await sleep(1500);edge.deleted=true;edge.deleting=false
      fusesRef.current=fusesRef.current.filter(f=>f.edgeKey!==`${edge.prey}-${edge.predator}`)
    }
    await sleep(800);spawnParticles(node.x,node.y,color);node.deleted=true
    logEvent(nodeId, isCascade ? "DELETED_CASCADE" : "DELETED")
    playRemoveSound(nodeId)
    setTimeout(()=>returnToShelf(nodeId),500)
    if(!isCascade){
      setMessage({text:`${def?.emoji} ${nodeId} removed — back to shelf`,color})
      setTimeout(()=>setMessage(null),2500);await sleep(600);await triggerCascade(nodeId)
    }
  },[returnToShelf,triggerCascade,killAllAnimals])

  // Draw loop
  useEffect(()=>{
    if(allNodes.length===0) return
    const canvas=canvasRef.current;if(!canvas) return
    const ctx=canvas.getContext("2d")!
    const draw=(t:number)=>{
      canvas.width=window.innerWidth;canvas.height=window.innerHeight;tick()
      const isDay=sunPresentRef.current

      // ── Watercolor background ──
      if(daytimeBg){
        ctx.drawImage(daytimeBg,0,0,canvas.width,canvas.height)
      } else {
        ctx.fillStyle=isDay?"#C8DEBB":"#2A3A4A"
        ctx.fillRect(0,0,canvas.width,canvas.height)
      }
      if(isDay){
        // Very faint parchment wash — let the lake show through
        ctx.globalAlpha=0.10
        ctx.fillStyle="#F4EDD3"
        ctx.fillRect(0,0,canvas.width,canvas.height)
        ctx.globalAlpha=1
        // Subtle sun-glow
        const sunGlow=ctx.createRadialGradient(canvas.width*0.78,canvas.height*0.14,0,canvas.width*0.78,canvas.height*0.14,canvas.height*0.55)
        sunGlow.addColorStop(0,"rgba(212,168,71,0.10)")
        sunGlow.addColorStop(1,"transparent")
        ctx.fillStyle=sunGlow;ctx.fillRect(0,0,canvas.width,canvas.height)
      } else {
        // Night: dark overlay
        ctx.globalAlpha=0.72
        ctx.fillStyle="#0D1520"
        ctx.fillRect(0,0,canvas.width,canvas.height)
        ctx.globalAlpha=1
        // Ink-dot stars
        for(let i=0;i<80;i++){
          const sx=(i*137.5*canvas.width/100)%canvas.width,sy=(i*97.3*canvas.height/100)%canvas.height
          const sz=(Math.sin(t*0.001+i)*0.5+0.5)*1.6
          ctx.beginPath();ctx.arc(sx,sy,sz,0,Math.PI*2)
          ctx.fillStyle=`rgba(220,210,190,${0.15+(i%4)*0.08})`;ctx.fill()
        }
      }

      if(shelfVisible){
        ctx.strokeStyle="rgba(92,61,46,0.18)"
        ctx.lineWidth=1;ctx.setLineDash([5,7])
        ctx.beginPath();ctx.moveTo(SHELF_W,0);ctx.lineTo(SHELF_W,canvas.height);ctx.stroke();ctx.setLineDash([])
      }

      const nodes=placedRef.current,edges=edgesRef.current,hovId=hoveredRef.current

      // Draw sun node — warm amber watercolor medallion
      const sunNode=nodes.find(n=>n.id===SUN_ID&&!n.deleted)
      if(sunNode){
        const pulse=Math.sin(t*0.003)*0.5+0.5
        // Soft amber glow
        const sg=ctx.createRadialGradient(sunNode.x,sunNode.y,0,sunNode.x,sunNode.y,NODE_R*4.5)
        sg.addColorStop(0,`rgba(212,168,71,${0.45+pulse*0.25})`)
        sg.addColorStop(0.5,`rgba(200,133,26,${0.18+pulse*0.1})`)
        sg.addColorStop(1,"transparent")
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sunNode.x,sunNode.y,NODE_R*4.5,0,Math.PI*2);ctx.fill()
        // Parchment fill
        const snFill=ctx.createRadialGradient(sunNode.x-NODE_R*0.3,sunNode.y-NODE_R*0.3,4,sunNode.x,sunNode.y,NODE_R)
        snFill.addColorStop(0,"rgba(255,252,220,0.96)")
        snFill.addColorStop(1,`rgba(212,168,71,0.88)`)
        ctx.beginPath();ctx.arc(sunNode.x,sunNode.y,NODE_R,0,Math.PI*2)
        ctx.fillStyle=snFill;ctx.fill()
        ctx.strokeStyle="rgba(212,168,71,0.85)";ctx.lineWidth=2.5;ctx.stroke()
        const sunDwell=[...dwellRef.current.values()].find(d=>d.nodeId===SUN_ID)
        if(sunDwell){
          const pct=(Date.now()-sunDwell.startTime)/DWELL_MS
          ctx.beginPath();ctx.arc(sunNode.x,sunNode.y,NODE_R+8,-Math.PI/2,-Math.PI/2+pct*Math.PI*2)
          ctx.strokeStyle="rgba(160,82,45,0.9)";ctx.lineWidth=3.5;ctx.stroke()
        }
        ctx.font="22px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("☀️",sunNode.x,sunNode.y-1)
        // Name tag
        ctx.font="bold 10px Georgia, serif"
        const tw=ctx.measureText("Sun").width, ly=sunNode.y+NODE_R+16
        ctx.fillStyle="rgba(244,237,211,0.90)"
        ctx.beginPath();ctx.roundRect(sunNode.x-tw/2-7,ly-8,tw+14,16,8);ctx.fill()
        ctx.fillStyle="rgba(160,82,45,0.85)";ctx.fillText("Sun",sunNode.x,ly)
      }

      // Edges
      edges.forEach(e=>{
        if(e.deleted) return
        const a=nodes.find(n=>n.id===e.prey&&!n.deleted),b=nodes.find(n=>n.id===e.predator&&!n.deleted)
        if(!a||!b) return
        const defA=STATIC_NODES.find(d=>d.id===a.id),defB=STATIC_NODES.find(d=>d.id===b.id)
        const aColor=TROPHIC_COLOR[defA?.trophic||""]||"#FFF"
        const bColor=TROPHIC_COLOR[defB?.trophic||""]||"#FFF"
        const isHov=hovId&&(hovId===e.prey||hovId===e.predator)
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d
        const x1=a.x+ux*NODE_R,y1=a.y+uy*NODE_R,x2=b.x-ux*(NODE_R+10),y2=b.y-uy*(NODE_R+10)
        const mx=(x1+x2)/2-uy*20,my=(y1+y2)/2+ux*20
        const fuse=fusesRef.current.find(f=>f.edgeKey===`${e.prey}-${e.predator}`)
        const fuseT=fuse?Math.min((Date.now()-fuse.startTime)/fuse.duration,1):0
        if(e.deleting&&(!fuse||fuseT>=1)){e.deleted=true;return}
        const grad=ctx.createLinearGradient(x1,y1,x2,y2)
        if(e.deleting&&fuse){
          grad.addColorStop(0,aColor+"55");grad.addColorStop(1,bColor+"55")
          ctx.beginPath()
          for(let i=0;i<=20;i++){const s=fuseT+(i/20)*(1-fuseT)
            const qx=(1-s)*(1-s)*x1+2*(1-s)*s*mx+s*s*x2,qy=(1-s)*(1-s)*y1+2*(1-s)*s*my+s*s*y2
            if(i===0)ctx.moveTo(qx,qy);else ctx.lineTo(qx,qy)}
          ctx.strokeStyle=grad;ctx.lineWidth=1.2;ctx.globalAlpha=1;ctx.stroke();ctx.globalAlpha=1
        } else {
          // Ink-warm edges — prominent lines + large arrow heads
          const opA=isHov?"FF":"CC", opB=isHov?"FF":"BB"
          grad.addColorStop(0,aColor+opA);grad.addColorStop(1,bColor+opB)
          ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(mx,my,x2,y2)
          ctx.strokeStyle=grad;ctx.lineWidth=isHov?4.5:3;ctx.globalAlpha=1;ctx.stroke();ctx.globalAlpha=1
          // Large solid arrowhead
          const ang=Math.atan2(y2-my,x2-mx)
          ctx.beginPath();ctx.moveTo(x2,y2)
          ctx.lineTo(x2-18*Math.cos(ang-0.42),y2-18*Math.sin(ang-0.42))
          ctx.lineTo(x2-18*Math.cos(ang+0.42),y2-18*Math.sin(ang+0.42))
          ctx.closePath();ctx.fillStyle=bColor+(isHov?"FF":"CC");ctx.fill()
        }
      })

      // Animal nodes — watercolor medallion style
      nodes.forEach(n=>{
        if(n.deleted||n.id===SUN_ID) return
        const def=STATIC_NODES.find(d=>d.id===n.id);if(!def) return
        const isHov=hovId===n.id,isDwelling=[...dwellRef.current.values()].some(d=>d.nodeId===n.id)
        const color=TROPHIC_COLOR[def.trophic]||"#8B6B55",r=isHov?NODE_R+4:NODE_R

        // State aura (starving / overpopulated)
        if(n.starving){
          const pulse=Math.sin(t*0.01)*0.5+0.5
          const g=ctx.createRadialGradient(n.x,n.y,r,n.x,n.y,r*3)
          g.addColorStop(0,`rgba(160,82,45,${0.35*pulse})`);g.addColorStop(1,"transparent")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,r*3,0,Math.PI*2);ctx.fill()
        }
        if(n.exploding){
          const pulse=Math.sin(t*0.008)*0.5+0.5
          const g=ctx.createRadialGradient(n.x,n.y,r,n.x,n.y,r*3)
          g.addColorStop(0,`rgba(107,140,94,${0.3*pulse})`);g.addColorStop(1,"transparent")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,r*3,0,Math.PI*2);ctx.fill()
        }
        if(isHov||isDwelling){
          const g=ctx.createRadialGradient(n.x,n.y,r*0.3,n.x,n.y,r*2.8)
          g.addColorStop(0,color+"66");g.addColorStop(1,"transparent")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,r*2.8,0,Math.PI*2);ctx.fill()
        }


        const png=nodeImagesRef.current[n.id]
        const hasPng=!!(png&&png.complete)
        const dwellEntry=[...dwellRef.current.values()].find(d=>d.nodeId===n.id)
        // PNG size — no circle container, just the image
        const imgR=isHov?r*1.95:r*1.8

        // Ghost dwell ring — pulses on hover to hint the hold mechanic
        if(isHov&&!isDwelling){
          const pulse=Math.sin(t*0.004)*0.5+0.5
          ctx.beginPath()
          ctx.arc(n.x,n.y,(hasPng?imgR:r)+8,-Math.PI/2,Math.PI*1.5)
          ctx.strokeStyle=`rgba(160,82,45,${0.18+pulse*0.28})`
          ctx.lineWidth=2.5
          ctx.setLineDash([6,5])
          ctx.stroke()
          ctx.setLineDash([])
        }

        if(hasPng){
          // ── PNG node: image only, no circle border ──
          ctx.drawImage(png,n.x-imgR,n.y-imgR,imgR*2,imgR*2)
          if(isDwelling&&dwellEntry){
            const pct=(Date.now()-dwellEntry.startTime)/DWELL_MS
            ctx.beginPath();ctx.arc(n.x,n.y,imgR+8,-Math.PI/2,-Math.PI/2+pct*Math.PI*2)
            ctx.strokeStyle="rgba(160,82,45,0.88)";ctx.lineWidth=3.5;ctx.stroke()
          }
        } else {
          // ── Emoji node: parchment medallion ──
          const bg=ctx.createRadialGradient(n.x-r*0.3,n.y-r*0.3,3,n.x,n.y,r)
          bg.addColorStop(0,"rgba(255,252,238,0.95)")
          bg.addColorStop(1,color+(isHov?"88":"55"))
          ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fillStyle=bg;ctx.fill()
          ctx.font=`${isHov?24:20}px serif`;ctx.textAlign="center";ctx.textBaseline="middle"
          ctx.fillText(def.emoji,n.x,n.y-1)
          ctx.strokeStyle=isDwelling?"rgba(160,82,45,0.9)":n.starving?"rgba(160,82,45,0.8)":n.exploding?"rgba(107,140,94,0.8)":color+"CC"
          ctx.lineWidth=isDwelling?3:isHov?2.2:1.8;ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.stroke()
          if(isDwelling&&dwellEntry){
            const pct=(Date.now()-dwellEntry.startTime)/DWELL_MS
            ctx.beginPath();ctx.arc(n.x,n.y,r+7,-Math.PI/2,-Math.PI/2+pct*Math.PI*2)
            ctx.strokeStyle="rgba(160,82,45,0.85)";ctx.lineWidth=3.5;ctx.stroke()
          }
        }

        // Mini-animal spawns for overpopulated nodes
        if(n.exploding){
          const miniCount=3
          const miniPulse=Math.sin(t*0.008)*0.5+0.5
          const miniAlpha=0.55+miniPulse*0.3
          for(let mi=0;mi<miniCount;mi++){
            const angle=(mi/miniCount)*Math.PI*2+t*0.0006
            const dist=(hasPng?imgR:r)*1.55
            const mx2=n.x+Math.cos(angle)*dist
            const my2=n.y+Math.sin(angle)*dist
            const miniR=(hasPng?imgR:r)*0.45
            ctx.save()
            ctx.globalAlpha=miniAlpha
            if(hasPng){
              ctx.drawImage(png,mx2-miniR,my2-miniR,miniR*2,miniR*2)
            } else {
              const mbg=ctx.createRadialGradient(mx2-miniR*0.3,my2-miniR*0.3,2,mx2,my2,miniR)
              mbg.addColorStop(0,"rgba(255,252,238,0.95)")
              mbg.addColorStop(1,color+"55")
              ctx.beginPath();ctx.arc(mx2,my2,miniR,0,Math.PI*2);ctx.fillStyle=mbg;ctx.fill()
              ctx.strokeStyle="rgba(107,140,94,0.65)";ctx.lineWidth=1;ctx.stroke()
              ctx.font=`${Math.round(miniR*1.1)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle"
              ctx.fillText(def.emoji,mx2,my2-1)
            }
            ctx.restore()
          }
        }

        // Parchment name tag (below node, accounting for actual size)
        const nameR=hasPng?imgR:r
        ctx.font="bold 10px Georgia, serif"
        const lbl=def.label,tw=ctx.measureText(lbl).width,ly=n.y+nameR+14
        ctx.fillStyle="rgba(244,237,211,0.90)"
        ctx.beginPath();ctx.roundRect(n.x-tw/2-7,ly-8,tw+14,16,8);ctx.fill()
        ctx.fillStyle=n.starving?"rgba(160,82,45,0.9)":n.exploding?"rgba(107,140,94,0.9)":"rgba(44,24,16,0.78)"
        ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(lbl,n.x,ly)
      })

      // Fuse sparks
      const now=Date.now()
      fusesRef.current=fusesRef.current.filter(f=>{
        const ft=Math.min((now-f.startTime)/f.duration,1);f.progress=ft
        const px=(1-ft)*(1-ft)*f.fromX+2*(1-ft)*ft*f.cpX+ft*ft*f.toX
        const py=(1-ft)*(1-ft)*f.fromY+2*(1-ft)*ft*f.cpY+ft*ft*f.toY
        ctx.beginPath()
        for(let i=0;i<=8;i++){const s=Math.max(0,ft-0.08)+(i/8)*0.08
          const qx=(1-s)*(1-s)*f.fromX+2*(1-s)*s*f.cpX+s*s*f.toX,qy=(1-s)*(1-s)*f.fromY+2*(1-s)*s*f.cpY+s*s*f.toY
          if(i===0)ctx.moveTo(qx,qy);else ctx.lineTo(qx,qy)}
        ctx.strokeStyle="#FF8800";ctx.lineWidth=3;ctx.globalAlpha=0.85;ctx.stroke();ctx.globalAlpha=1
        ctx.beginPath()
        for(let i=0;i<=5;i++){const s=Math.max(0,ft-0.04)+(i/5)*0.04
          const qx=(1-s)*(1-s)*f.fromX+2*(1-s)*s*f.cpX+s*s*f.toX,qy=(1-s)*(1-s)*f.fromY+2*(1-s)*s*f.cpY+s*s*f.toY
          if(i===0)ctx.moveTo(qx,qy);else ctx.lineTo(qx,qy)}
        ctx.strokeStyle="#FFFFFF";ctx.lineWidth=1.5;ctx.globalAlpha=0.7;ctx.stroke();ctx.globalAlpha=1
        ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fillStyle="#FFFFFF";ctx.fill()
        const g=ctx.createRadialGradient(px,py,0,px,py,8)
        g.addColorStop(0,"rgba(255,200,50,0.9)");g.addColorStop(0.5,"rgba(255,100,0,0.5)");g.addColorStop(1,"transparent")
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,8,0,Math.PI*2);ctx.fill()
        for(let k=0;k<4;k++){const sa=Math.random()*Math.PI*2,sd=4+Math.random()*8
          ctx.beginPath();ctx.arc(px+Math.cos(sa)*sd,py+Math.sin(sa)*sd,1+Math.random()*1.5,0,Math.PI*2)
          ctx.fillStyle=Math.random()>0.5?"#FFFF00":"#FF8800";ctx.globalAlpha=0.6+Math.random()*0.4;ctx.fill();ctx.globalAlpha=1}
        if(ft>=1){const fg=ctx.createRadialGradient(f.toX,f.toY,0,f.toX,f.toY,20)
          fg.addColorStop(0,"#FFF");fg.addColorStop(0.4,f.color);fg.addColorStop(1,"transparent")
          ctx.fillStyle=fg;ctx.beginPath();ctx.arc(f.toX,f.toY,20,0,Math.PI*2);ctx.fill()}
        return ft<1.1
      })

      // Snap particles
      particlesRef.current=particlesRef.current.filter(p=>p.alpha>0.02)
      particlesRef.current.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy;p.vy+=0.018;p.alpha-=0.004;p.rotation+=p.rotSpeed;p.size*=0.993
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180)
        ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size)
        ctx.restore();ctx.globalAlpha=1
      })

      animRef.current=requestAnimationFrame(draw)
    }
    animRef.current=requestAnimationFrame(draw)
    return ()=>{if(animRef.current!==null)cancelAnimationFrame(animRef.current)}
  },[allNodes,shelfVisible,tick,daytimeBg])

  const getPlacedNode=(x:number,y:number)=>placedRef.current.find(n=>!n.deleted&&Math.hypot(x-n.x,y-n.y)<NODE_R+8)

  const startDwell=useCallback((pointerId:number, nodeId:string)=>{
    const existing=dwellRef.current.get(pointerId)
    if(existing?.nodeId===nodeId) return
    if(existing?.timerId) clearTimeout(existing.timerId)
    const timerId=setTimeout(async()=>{
      dwellRef.current.delete(pointerId)
      await deleteNodeAnimated(nodeId)
    },DWELL_MS)
    dwellRef.current.set(pointerId,{nodeId,startTime:Date.now(),timerId})
  },[deleteNodeAnimated])

  const cancelDwell=useCallback((pointerId:number)=>{
    const d=dwellRef.current.get(pointerId)
    if(d?.timerId) clearTimeout(d.timerId)
    dwellRef.current.delete(pointerId)
  },[])

  const handlePointerDown=useCallback((e:React.PointerEvent)=>{
    const canvas=canvasRef.current;if(!canvas) return
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top
    const node=getPlacedNode(x,y)
    if(node){
      dragRef.current.set(e.pointerId,{nodeId:node.id,fromShelf:false,offsetX:node.x-x,offsetY:node.y-y})
      hoveredRef.current=node.id
      startDwell(e.pointerId,node.id)
    }
  },[startDwell])

  const handlePointerMove=useCallback((e:React.PointerEvent)=>{
    const canvas=canvasRef.current;if(!canvas) return
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top
    const drag=dragRef.current.get(e.pointerId)
    if(drag&&!drag.fromShelf){
      const n=placedRef.current.find(n=>n.id===drag.nodeId)
      if(n){n.x=x+drag.offsetX;n.y=y+drag.offsetY;n.vx=0;n.vy=0}
      const dwell=dwellRef.current.get(e.pointerId)
      if(dwell&&getPlacedNode(x,y)?.id!==dwell.nodeId) cancelDwell(e.pointerId)
    } else {
      hoveredRef.current=getPlacedNode(x,y)?.id||null
    }
  },[cancelDwell])

  const handlePointerUp=useCallback((e:React.PointerEvent)=>{
    const drag=dragRef.current.get(e.pointerId)
    if(drag?.fromShelf){return}
    if(drag){
      const n=placedRef.current.find(n=>n.id===drag.nodeId)
      if(n&&n.id!==SUN_ID){n.pinned=true;n.vx=0;n.vy=0}
    }
    dragRef.current.delete(e.pointerId)
    cancelDwell(e.pointerId)
  },[cancelDwell])

  const handleShelfDragStart=useCallback((e:React.PointerEvent,nodeId:string)=>{
    e.preventDefault()
    const pointerId=e.pointerId
    dragRef.current.set(pointerId,{nodeId,fromShelf:true,offsetX:0,offsetY:0})
    const onMove=(ev:PointerEvent)=>{
      if(ev.pointerId!==pointerId) return
      setShelfDrag({nodeId,x:ev.clientX,y:ev.clientY})
    }
    const onUp=(ev:PointerEvent)=>{
      if(ev.pointerId!==pointerId) return
      window.removeEventListener("pointermove",onMove)
      window.removeEventListener("pointerup",onUp)
      setShelfDrag(null)
      const drag=dragRef.current.get(pointerId)
      if(!drag?.fromShelf){dragRef.current.delete(pointerId);return}
      const canvas=canvasRef.current;if(!canvas){dragRef.current.delete(pointerId);return}
      const rect=canvas.getBoundingClientRect()
      const x=ev.clientX-rect.left,y=ev.clientY-rect.top
      if(x>SHELF_W) placeAnimal(nodeId,x,y)
      dragRef.current.delete(pointerId)
    }
    window.addEventListener("pointermove",onMove)
    window.addEventListener("pointerup",onUp)
  },[placeAnimal])

  const unplacedCount=allNodes.filter(n=>!placedIds.has(n.id)).length
  const isDay=sunPresent

  return(
    <div style={{width:"100vw",height:"100vh",position:"relative",overflow:"hidden",userSelect:"none",cursor:"crosshair",WebkitUserSelect:"none",WebkitTouchCallout:"none"}}>
      <canvas ref={canvasRef} style={{display:"block",touchAction:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"}}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp}
        onContextMenu={e=>e.preventDefault()}/>

      {/* ── Watercolor Specimen Shelf ── */}
      <AnimatePresence>
        {shelfVisible&&(
          <motion.div initial={{x:-SHELF_W}} animate={{x:0}} exit={{x:-SHELF_W}}
            transition={{type:"spring",stiffness:280,damping:28}}
            style={{
              position:"absolute",top:0,left:0,bottom:0,width:SHELF_W,
              background:isDay?"rgba(244,237,211,0.92)":"rgba(12,18,28,0.94)",
              backdropFilter:"blur(10px)",
              borderRight:isDay?"1px solid rgba(92,61,46,0.2)":"1px solid rgba(255,255,255,0.07)",
              boxShadow:isDay
                ?"inset -4px 0 20px rgba(92,61,46,0.06), 4px 0 24px rgba(44,24,16,0.12)"
                :"inset -4px 0 20px rgba(0,0,0,0.3), 4px 0 24px rgba(0,0,0,0.4)",
              zIndex:20,display:"flex",flexDirection:"column",overflow:"hidden",
              transition:"background 0.8s ease, border-color 0.8s ease",
            }}>

            {/* Header */}
            <div style={{
              padding:"16px 12px 10px",
              borderBottom:isDay?"1px solid rgba(92,61,46,0.15)":"1px solid rgba(255,255,255,0.07)",
              background:isDay?"rgba(232,216,180,0.55)":"rgba(8,12,20,0.6)",
            }}>
              <div style={{fontFamily:"var(--font-mansalva), cursive",fontSize:15,color:isDay?"rgba(44,24,16,0.82)":"rgba(180,200,230,0.85)",marginBottom:8}}>
                Field Specimens
              </div>
              <div style={{fontFamily:"var(--font-playfair), serif",fontStyle:"italic",fontSize:10,color:isDay?"rgba(92,61,46,0.55)":"rgba(120,150,190,0.55)",marginBottom:10}}>
                {unplacedCount} awaiting placement
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={autoFill} style={{
                  flex:1,padding:"6px 0",
                  fontFamily:"var(--font-mansalva), cursive",fontSize:11,
                  color:"rgba(107,140,94,0.95)",
                  background:"rgba(107,140,94,0.12)",
                  border:"1px solid rgba(107,140,94,0.4)",
                  borderRadius:"4px 8px 5px 7px / 7px 4px 8px 5px",
                  cursor:"pointer",
                }}>⚡ Fill All</button>
                <button onClick={()=>setShelfVisible(false)} style={{
                  padding:"6px 10px",
                  fontFamily:"var(--font-playfair), serif",fontStyle:"italic",fontSize:11,
                  color:isDay?"rgba(92,61,46,0.6)":"rgba(120,150,190,0.6)",
                  background:"transparent",
                  border:isDay?"1px solid rgba(92,61,46,0.2)":"1px solid rgba(255,255,255,0.1)",
                  borderRadius:"3px 6px 4px 5px / 5px 3px 6px 4px",
                  cursor:"pointer",
                }}>Hide</button>
              </div>
            </div>

            {/* Scrollable specimen list */}
            <div style={{flex:1,overflowY:"auto",padding:"6px 0",scrollbarWidth:"none"}}>
              {SHELF_ORDER.map(shelf=>{
                const shelfNodes=allNodes.filter(n=>n.shelf===shelf&&!placedIds.has(n.id))
                const isSunShelf=shelf==="☀️ Sun"
                const sectionColor=isSunShelf
                  ?"rgba(212,168,71,0.9)"
                  :isDay?"rgba(92,61,46,0.65)":"rgba(140,165,200,0.65)"
                return(
                  <div key={shelf}>
                    <button onClick={()=>setShelfOpen(p=>({...p,[shelf]:!p[shelf]}))} style={{
                      width:"100%",padding:"7px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",
                      background:"transparent",border:"none",cursor:"pointer",
                      fontFamily:"var(--font-playfair), serif",fontStyle:"italic",fontSize:11,
                      color:sectionColor,letterSpacing:"0.04em",
                    }}>
                      <span>{shelf}</span>
                      <span style={{fontSize:8,opacity:0.6}}>{shelfOpen[shelf]?"▲":"▼"}</span>
                    </button>
                    <AnimatePresence>
                      {shelfOpen[shelf]&&(
                        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
                          transition={{duration:0.22}} style={{overflow:"hidden"}}>
                          {shelfNodes.length===0?(
                            <div style={{padding:"3px 14px 10px",fontFamily:"var(--font-playfair), serif",fontStyle:"italic",fontSize:10,
                              color:isDay?"rgba(92,61,46,0.4)":"rgba(120,150,190,0.4)"}}>
                              {isSunShelf?"Sun is shining ☀️":"All placed"}
                            </div>
                          ):(
                            <div style={{padding:"4px 8px 10px",display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
                              {shelfNodes.map(node=>{
                                const color=node.id===SUN_ID?"rgba(212,168,71,0.85)":TROPHIC_COLOR[node.trophic]||"rgba(139,107,85,0.7)"
                                const pngSrc=NODE_PNG_MAP[node.id]
                                const isSun=node.id===SUN_ID
                                return(
                                  <motion.div key={node.id} whileHover={{scale:1.06,rotate:1.5}}
                                    style={{
                                      width:isSun?SHELF_W-28:62,
                                      display:"flex",flexDirection:"column",alignItems:"center",
                                      cursor:"grab",padding:"7px 4px 5px",
                                      background:isDay?"rgba(255,252,238,0.9)":"rgba(20,30,48,0.85)",
                                      border:`1px solid ${color}55`,
                                      borderRadius:"3px 8px 4px 7px / 6px 3px 8px 4px",
                                      boxShadow:isDay?"0 2px 8px rgba(60,40,10,0.12)":"0 2px 8px rgba(0,0,0,0.4)",
                                      touchAction:"none",
                                    }}
                                    onPointerDown={e=>handleShelfDragStart(e,node.id)}>
                                    {/* Illustration or emoji */}
                                    {pngSrc?(
                                      <img src={pngSrc} alt={node.label} aria-label={node.label}
                                        style={{width:isSun?40:44,height:isSun?40:36,objectFit:"contain",
                                          filter:isDay
                                            ?"drop-shadow(1px 2px 4px rgba(60,40,10,0.22))"
                                            :"drop-shadow(0 0 6px rgba(100,150,220,0.3))"}}/>
                                    ):(
                                      <span style={{fontSize:isSun?28:22,filter:isDay
                                        ?"drop-shadow(1px 2px 4px rgba(60,40,10,0.2))"
                                        :"drop-shadow(0 0 6px rgba(100,150,220,0.3))"}}
                                        aria-label={node.label}>{node.emoji}</span>
                                    )}
                                    {/* Name label */}
                                    <span style={{
                                      fontFamily:"var(--font-playfair), serif",fontSize:isSun?10:8,
                                      color:isDay?"rgba(44,24,16,0.72)":"rgba(160,190,230,0.8)",
                                      textAlign:"center",marginTop:4,
                                      lineHeight:1.2,letterSpacing:"0.02em",
                                    }}>{node.label}</span>
                                  </motion.div>
                                )
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Bottom fade */}
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:36,pointerEvents:"none",
              background:isDay
                ?"linear-gradient(to top, rgba(244,237,211,0.95), transparent)"
                :"linear-gradient(to top, rgba(12,18,28,0.95), transparent)"}}/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show shelf button */}
      <AnimatePresence>
        {!shelfVisible&&(
          <motion.button initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setShelfVisible(true)}
            style={{
              position:"absolute",top:20,left:16,zIndex:20,padding:"8px 16px",
              fontFamily:"var(--font-mansalva), cursive",fontSize:13,
              color:isDay?"rgba(44,24,16,0.78)":"rgba(160,190,230,0.85)",
              background:isDay?"rgba(244,237,211,0.90)":"rgba(12,18,28,0.88)",
              border:isDay?"1px solid rgba(92,61,46,0.25)":"1px solid rgba(255,255,255,0.1)",
              borderRadius:"4px 8px 5px 7px / 7px 4px 8px 5px",
              cursor:"pointer",
              boxShadow:isDay?"0 3px 12px rgba(44,24,16,0.15)":"0 3px 12px rgba(0,0,0,0.4)",
            }}>☰ Creatures</motion.button>
        )}
      </AnimatePresence>

      {/* ── Title ── */}
      <div style={{position:"absolute",top:18,left:"50%",transform:"translateX(-50%)",textAlign:"center",pointerEvents:"none",zIndex:10}}>
        <div style={{
          fontFamily:"var(--font-mansalva), cursive",fontSize:22,
          color:isDay?"rgba(44,24,16,0.82)":"rgba(220,210,190,0.90)",
          textShadow:isDay?"1px 2px 0 rgba(255,255,255,0.45)":"0 0 16px rgba(100,80,40,0.4)",
          letterSpacing:"0.02em",
        }}>
          {isDay?"🌿":"🌑"} Who Eats Whom
        </div>
        <div style={{
          fontFamily:"var(--font-playfair), serif",fontStyle:"italic",fontSize:11,
          color:isDay?"rgba(92,61,46,0.6)":"rgba(180,165,130,0.55)",
          letterSpacing:"0.05em",marginTop:3,
        }}>
          {isDay?"The sun is shining — life thrives":"Add the sun to begin · Hold 3s to remove"}
        </div>
      </div>

      {/* ── Hold-to-remove hint pill ── fades in once any animal is placed */}
      <AnimatePresence>
        {placedIds.size > 0 && (
          <motion.div
            initial={{opacity:0, y:10}}
            animate={{opacity:1, y:0}}
            exit={{opacity:0, y:10}}
            transition={{duration:0.6, ease:"easeOut"}}
            style={{
              position:"absolute",
              bottom:28,
              left:"50%",
              transform:"translateX(-50%)",
              pointerEvents:"none",
              zIndex:10,
              display:"flex",
              alignItems:"center",
              gap:8,
              padding:"7px 16px",
              borderRadius:"999px",
              background:isDay?"rgba(244,237,211,0.78)":"rgba(12,18,28,0.78)",
              border:isDay?"1px solid rgba(92,61,46,0.18)":"1px solid rgba(255,255,255,0.08)",
              backdropFilter:"blur(6px)",
              boxShadow:isDay?"0 2px 12px rgba(44,24,16,0.12)":"0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            {/* Animated hold icon */}
            <motion.span
              animate={{scale:[1, 1.18, 1]}}
              transition={{duration:1.8, repeat:Infinity, ease:"easeInOut"}}
              style={{fontSize:14, lineHeight:1}}
            >
              ✋
            </motion.span>
            <span style={{
              fontFamily:"var(--font-playfair), serif",
              fontStyle:"italic",
              fontSize:11,
              color:isDay?"rgba(92,61,46,0.75)":"rgba(160,190,230,0.75)",
              whiteSpace:"nowrap",
              letterSpacing:"0.03em",
            }}>
              Hold any creature for 3 seconds to remove it
            </span>
            {/* Dwell ring miniature illustration */}
            <svg width={18} height={18} viewBox="0 0 18 18" fill="none" style={{flexShrink:0}}>
              <circle cx={9} cy={9} r={7} stroke={isDay?"rgba(92,61,46,0.25)":"rgba(160,190,230,0.2)"} strokeWidth={1.5} strokeDasharray="3 3"/>
              <motion.circle
                cx={9} cy={9} r={7}
                stroke={isDay?"rgba(160,82,45,0.7)":"rgba(160,120,80,0.7)"}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
                strokeDasharray="44"
                animate={{strokeDashoffset:[44, 0]}}
                transition={{duration:2.2, repeat:Infinity, ease:"linear", repeatDelay:0.8}}
                style={{rotate:"-90deg", transformOrigin:"9px 9px"}}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Message bubble ── */}
      <AnimatePresence>
        {message&&(
          <motion.div style={{
            position:"absolute",top:"28%",left:"50%",transform:"translateX(-50%)",
            background:"rgba(244,237,211,0.94)",
            borderRadius:"4px 12px 6px 10px / 10px 4px 12px 6px",
            padding:"16px 32px",
            border:`1.5px solid ${message.color}88`,
            boxShadow:`0 8px 32px rgba(44,24,16,0.25), 0 0 0 1px ${message.color}22`,
            pointerEvents:"none",
            backdropFilter:"blur(6px)",
            zIndex:30,
            maxWidth:"60vw",
          }}
            initial={{scale:0.8,opacity:0,y:-10}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.85,opacity:0}}
            transition={{type:"spring",stiffness:300,damping:22}}>
            <div style={{
              fontFamily:"var(--font-mansalva), cursive",fontSize:20,
              color:message.color,textAlign:"center",
              textShadow:"0 1px 0 rgba(255,255,255,0.4)",
            }}>{message.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drag ghost ── */}
      <AnimatePresence>
        {shelfDrag&&(()=>{
          const def=allNodes.find(n=>n.id===shelfDrag.nodeId)
          const pngSrc=def?NODE_PNG_MAP[def.id]:null
          const color=def?.id===SUN_ID?"rgba(212,168,71,0.7)":TROPHIC_COLOR[def?.trophic||""]||"rgba(139,107,85,0.6)"
          return(
            <motion.div style={{
              position:"fixed",left:shelfDrag.x-36,top:shelfDrag.y-36,
              width:72,height:72,
              borderRadius:"55% 45% 60% 40% / 50% 50% 45% 55%",
              background:"rgba(244,237,211,0.92)",
              border:`1.5px solid ${color}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              pointerEvents:"none",zIndex:100,
              boxShadow:"0 8px 24px rgba(44,24,16,0.25)",
              transform:"rotate(3deg)",
            }}
              initial={{scale:0.8,opacity:0}} animate={{scale:1.1,opacity:1}} exit={{scale:0.7,opacity:0}}
            >
              {pngSrc?(
                <img src={pngSrc} alt={def?.label} style={{
                  width:54,height:54,objectFit:"contain",
                  filter:"drop-shadow(1px 2px 4px rgba(60,40,10,0.25))",
                }}/>
              ):(
                <span style={{fontSize:30,filter:"drop-shadow(1px 2px 4px rgba(60,40,10,0.2))"}}>{def?.emoji}</span>
              )}
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* ── Tutorial overlay ── */}
      <AnimatePresence>
        {showTutorial && (
          <Tutorial onDone={() => setShowTutorial(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}