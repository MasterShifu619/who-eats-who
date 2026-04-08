"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { preloadSound, playPlaceSound, playRemoveSound, playPlaceChime, playCascadeWarning } from "@/lib/sounds"

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

const DWELL_MS=5000, NODE_R=36, REPEL=18000, ATTRACT=0.012, IDEAL_DIST=280, DAMPING=0.78
const SHELF_W = typeof window !== "undefined" ? Math.max(180, Math.min(280, window.innerWidth * 0.20)) : 220
const API_BASE=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000"
const TROPHIC_COLOR: Record<string,string>={
  producer:"#44DD88", primary:"#44AAFF", secondary:"#FFAA00",
  tertiary:"#FF6644", apex:"#FF3333", sun:"#FFD700"
}

const SUN_ID = "Sun"

const SHELF_MAP: Record<string,string>={
  "Sun":        "☀️ Sun",
  "Fruit":      "🌱 Plants",
  "Worm":       "🐛 Bugs","Butterfly":"🐛 Bugs","Beetle":"🐛 Bugs",
  "Grasshopper":"🐛 Bugs","Ant":"🐛 Bugs","Dragonfly":"🐛 Bugs","Spider":"🐛 Bugs",
  "Fish":       "🐟 Water Animals","Crab":"🐟 Water Animals",
  "Frog":       "🐸 Land Animals","Rat":"🐸 Land Animals",
  "Lizard":     "🦎 Reptiles","Snake":"🦎 Reptiles",
  "Blue Heron": "🐦 Birds",
}
const SHELF_ORDER=["☀️ Sun","🌱 Plants","🐛 Bugs","🐟 Water Animals","🐸 Land Animals","🦎 Reptiles","🐦 Birds"]

// All feeding edges [prey, predator]
const ALL_EDGES: [string,string][]=[
  ["Fruit","Grasshopper"],["Fruit","Butterfly"],["Fruit","Worm"],["Fruit","Ant"],["Fruit","Rat"],
  ["Fruit","Beetle"],  // Beetle eats Fruit
  ["Worm","Frog"],["Worm","Snake"],["Worm","Fish"],["Worm","Blue Heron"],
  ["Worm","Crab"],     // Crab eats Worm
  ["Butterfly","Dragonfly"],["Butterfly","Spider"],["Butterfly","Frog"],["Butterfly","Lizard"],
  ["Beetle","Frog"],["Beetle","Spider"],["Beetle","Rat"],
  ["Grasshopper","Dragonfly"],["Grasshopper","Frog"],["Grasshopper","Snake"],["Grasshopper","Lizard"],["Grasshopper","Blue Heron"],
  ["Dragonfly","Frog"],["Dragonfly","Fish"],["Dragonfly","Spider"],["Dragonfly","Lizard"],
  ["Ant","Frog"],["Ant","Spider"],["Ant","Lizard"],
  ["Spider","Frog"],["Spider","Snake"],["Spider","Lizard"],
  ["Crab","Blue Heron"],["Crab","Fish"],["Crab","Snake"],
  ["Fish","Blue Heron"],["Fish","Snake"],["Fish","Lizard"],
  ["Fish","Crab"],     // Crab eats Fish
  ["Frog","Snake"],["Frog","Blue Heron"],["Frog","Lizard"],
  ["Rat","Snake"],["Rat","Blue Heron"],["Rat","Lizard"],
  ["Snake","Blue Heron"],["Lizard","Blue Heron"],["Lizard","Snake"],
]

// Static node definitions — no backend needed for game3
const STATIC_NODES: NodeDef[] = [
  { id:"Sun",        label:"Sun",         emoji:"☀️", trophic:"sun",       shelf:"☀️ Sun" },
  { id:"Fruit",      label:"Fruit",       emoji:"🍎", trophic:"producer",  shelf:"🌱 Plants" },
  { id:"Worm",       label:"Worm",        emoji:"🪱", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Butterfly",  label:"Butterfly",   emoji:"🦋", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Beetle",     label:"Beetle",      emoji:"🪲", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Grasshopper",label:"Grasshopper", emoji:"🦗", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Ant",        label:"Ant",         emoji:"🐜", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Dragonfly",  label:"Dragonfly",   emoji:"🪰", trophic:"primary",   shelf:"🐛 Bugs" },
  { id:"Spider",     label:"Spider",      emoji:"🕷️", trophic:"secondary", shelf:"🐛 Bugs" },
  { id:"Fish",       label:"Fish",        emoji:"🐟", trophic:"secondary", shelf:"🐟 Water Animals" },
  { id:"Crab",       label:"Crab",        emoji:"🦀", trophic:"secondary", shelf:"🐟 Water Animals" },
  { id:"Frog",       label:"Frog",        emoji:"🐸", trophic:"secondary", shelf:"🐸 Land Animals" },
  { id:"Rat",        label:"Rat",         emoji:"🐀", trophic:"secondary", shelf:"🐸 Land Animals" },
  { id:"Lizard",     label:"Lizard",      emoji:"🦎", trophic:"tertiary",  shelf:"🦎 Reptiles" },
  { id:"Snake",      label:"Snake",       emoji:"🐍", trophic:"tertiary",  shelf:"🦎 Reptiles" },
  { id:"Blue Heron", label:"Blue Heron",  emoji:"🦤", trophic:"apex",      shelf:"🐦 Birds" },
]

export default function Game3Page() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const placedRef    = useRef<PlacedNode[]>([])
  const edgesRef     = useRef<Edge[]>([])
  const particlesRef = useRef<Particle[]>([])
  const fusesRef     = useRef<FuseParticle[]>([])
  const animRef      = useRef<number|null>(null)
  const dwellRef     = useRef<{nodeId:string;startTime:number;timerId:ReturnType<typeof setTimeout>|null}|null>(null)
  const dragRef      = useRef<{nodeId:string;fromShelf:boolean;offsetX:number;offsetY:number}|null>(null)
  const hoveredRef   = useRef<string|null>(null)
  const sunPresentRef = useRef(false)
  const placedIdsRef = useRef<Set<string>>(new Set())


  const [allNodes]   = useState<NodeDef[]>(STATIC_NODES)
  const [placedIds,setPlacedIds]     = useState<Set<string>>(new Set())
  const [message,setMessage]         = useState<{text:string;color:string}|null>(null)
  const [shelfOpen,setShelfOpen]     = useState<Record<string,boolean>>(Object.fromEntries(SHELF_ORDER.map(s=>[s,true])))
  const [shelfVisible,setShelfVisible] = useState(true)
  const [dims,setDims]               = useState({w:1440,h:900})
  const [shelfDrag,setShelfDrag]     = useState<{nodeId:string;x:number;y:number}|null>(null)
  const [sunPresent,setSunPresent]   = useState(false)
  const [daytimeBg,setDaytimeBg]     = useState<HTMLImageElement|null>(null)

  // Load daytime bg image
  useEffect(()=>{
    const img = new Image()
    img.src = "/images/daytime-bg.jpg"
    img.onload = () => setDaytimeBg(img)
    setDims({w:window.innerWidth,h:window.innerHeight})
    STATIC_NODES.forEach(n=>preloadSound(n.id))
  },[])

  const isSunPlaced = useCallback(()=>sunPresentRef.current,[])

  const placeAnimal=useCallback((id:string,x:number,y:number)=>{
    console.log("placeAnimal called", id, x, y)
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

    const px=Math.max(SHELF_W+60,Math.min(dims.w-60,x))
    const py=Math.max(60,Math.min(dims.h-60,y))
    placedRef.current=placedRef.current.filter(n=>n.id!==id)
    placedRef.current.push({id,x:px,y:py,vx:0,vy:0,deleted:false,exploding:false,starving:false,pinned:false})

    if(id===SUN_ID){
      sunPresentRef.current=true
      setSunPresent(true)
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
    playPlaceSound(id)
    playPlaceChime()
  },[placedIds,dims,isSunPlaced])

  const returnToShelf=useCallback((id:string)=>{
    placedRef.current=placedRef.current.filter(n=>n.id!==id)
    edgesRef.current=edgesRef.current.filter(e=>e.prey!==id&&e.predator!==id)
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
      if(dragRef.current?.nodeId===n.id) return
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

  const triggerCascade=useCallback(async(removedId:string)=>{
    const presentIds=new Set(placedRef.current.filter(n=>!n.deleted&&n.id!==SUN_ID).map(n=>n.id))
    const starving:string[]=[],exploding:string[]=[]
    presentIds.forEach(id=>{
      const myPrey=ALL_EDGES.filter(([,pred])=>pred===id).map(([prey])=>prey)
      const myPreds=ALL_EDGES.filter(([prey])=>prey===id).map(([,pred])=>pred)
      if(myPrey.length>0&&myPrey.every(p=>!presentIds.has(p))) starving.push(id)
      if(myPreds.length>0&&myPreds.every(p=>!presentIds.has(p))) exploding.push(id)
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

      // Background
      if(isDay&&daytimeBg){
        // Daytime: draw image at low opacity over light bg
        ctx.fillStyle="#D4EAF7"
        ctx.fillRect(0,0,canvas.width,canvas.height)
        ctx.globalAlpha=0.18
        ctx.drawImage(daytimeBg,0,0,canvas.width,canvas.height)
        ctx.globalAlpha=1
        // Warm golden overlay
        const sunGlow=ctx.createRadialGradient(canvas.width*0.8,canvas.height*0.15,0,canvas.width*0.8,canvas.height*0.15,canvas.height*0.6)
        sunGlow.addColorStop(0,"rgba(255,220,100,0.18)")
        sunGlow.addColorStop(1,"transparent")
        ctx.fillStyle=sunGlow;ctx.fillRect(0,0,canvas.width,canvas.height)
      } else {
        ctx.fillStyle="#06060F";ctx.fillRect(0,0,canvas.width,canvas.height)
        // Stars only at night
        for(let i=0;i<60;i++){
          const sx=(i*137.5*canvas.width/100)%canvas.width,sy=(i*97.3*canvas.height/100)%canvas.height
          ctx.beginPath();ctx.arc(sx,sy,(Math.sin(t*0.001+i)*0.5+0.5)*1.8,0,Math.PI*2)
          ctx.fillStyle=`rgba(255,255,255,${0.2+(i%3)*0.1})`;ctx.fill()
        }
      }

      if(shelfVisible){
        ctx.strokeStyle=isDay?"rgba(0,0,0,0.08)":"rgba(255,255,255,0.06)"
        ctx.lineWidth=1;ctx.setLineDash([6,8])
        ctx.beginPath();ctx.moveTo(SHELF_W,0);ctx.lineTo(SHELF_W,canvas.height);ctx.stroke();ctx.setLineDash([])
      }

      const nodes=placedRef.current,edges=edgesRef.current,hovId=hoveredRef.current

      // Draw sun node special
      const sunNode=nodes.find(n=>n.id===SUN_ID&&!n.deleted)
      if(sunNode){
        const pulse=Math.sin(t*0.003)*0.5+0.5
        const sg=ctx.createRadialGradient(sunNode.x,sunNode.y,0,sunNode.x,sunNode.y,NODE_R*4)
        sg.addColorStop(0,`rgba(255,220,50,${0.5+pulse*0.3})`)
        sg.addColorStop(0.5,`rgba(255,180,0,${0.2+pulse*0.1})`)
        sg.addColorStop(1,"transparent")
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sunNode.x,sunNode.y,NODE_R*4,0,Math.PI*2);ctx.fill()
        ctx.beginPath();ctx.arc(sunNode.x,sunNode.y,NODE_R,0,Math.PI*2)
        ctx.fillStyle=`rgba(255,220,50,0.9)`;ctx.fill()
        ctx.strokeStyle="#FFD700";ctx.lineWidth=3;ctx.stroke()
        if(dwellRef.current?.nodeId===SUN_ID){
          const pct=(Date.now()-dwellRef.current.startTime)/DWELL_MS
          ctx.beginPath();ctx.arc(sunNode.x,sunNode.y,NODE_R+8,-Math.PI/2,-Math.PI/2+pct*Math.PI*2)
          ctx.strokeStyle="#FF3333";ctx.lineWidth=4;ctx.stroke()
        }
        ctx.font="22px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("☀️",sunNode.x,sunNode.y-1)
        ctx.font="bold 11px Arial, sans-serif"
        const tw=ctx.measureText("SUN").width
        const ly=sunNode.y+NODE_R+16
        ctx.fillStyle=isDay?"rgba(0,0,0,0.5)":"rgba(0,0,0,0.65)"
        ctx.beginPath();ctx.roundRect(sunNode.x-tw/2-5,ly-7,tw+10,14,7);ctx.fill()
        ctx.fillStyle="#FFD700";ctx.fillText("SUN",sunNode.x,ly)
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
          const opacity=isDay?"88":"55"
          grad.addColorStop(0,aColor+(isHov?"DD":opacity));grad.addColorStop(1,bColor+(isHov?"DD":opacity))
          ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(mx,my,x2,y2)
          ctx.strokeStyle=grad;ctx.lineWidth=isHov?2.5:1.5;ctx.globalAlpha=1;ctx.stroke();ctx.globalAlpha=1
          const ang=Math.atan2(y2-my,x2-mx)
          ctx.beginPath();ctx.moveTo(x2,y2)
          ctx.lineTo(x2-11*Math.cos(ang-0.4),y2-11*Math.sin(ang-0.4))
          ctx.lineTo(x2-11*Math.cos(ang+0.4),y2-11*Math.sin(ang+0.4))
          ctx.closePath();ctx.fillStyle=bColor+(isHov?"EE":"88");ctx.fill()
        }
      })

      // Animal nodes
      nodes.forEach(n=>{
        if(n.deleted||n.id===SUN_ID) return
        const def=STATIC_NODES.find(d=>d.id===n.id);if(!def) return
        const isHov=hovId===n.id,isDwelling=dwellRef.current?.nodeId===n.id
        const color=TROPHIC_COLOR[def.trophic]||"#FFF",r=isHov?NODE_R+4:NODE_R
        if(n.exploding){
          const pulse=Math.sin(t*0.008)*0.5+0.5,g=ctx.createRadialGradient(n.x,n.y,r,n.x,n.y,r*3)
          g.addColorStop(0,`rgba(100,255,100,${0.3*pulse})`);g.addColorStop(1,"transparent")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,r*3,0,Math.PI*2);ctx.fill()
        }
        if(n.starving){
          const pulse=Math.sin(t*0.01)*0.5+0.5,g=ctx.createRadialGradient(n.x,n.y,r,n.x,n.y,r*3)
          g.addColorStop(0,`rgba(255,60,60,${0.35*pulse})`);g.addColorStop(1,"transparent")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,r*3,0,Math.PI*2);ctx.fill()
        }
        if(isHov||isDwelling){
          const g=ctx.createRadialGradient(n.x,n.y,r*0.3,n.x,n.y,r*3)
          g.addColorStop(0,color+"88");g.addColorStop(1,"transparent")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,r*3,0,Math.PI*2);ctx.fill()
        }
        const bgEnd=isDay?"#D4EAF7":"#06060F"
        const bg=ctx.createRadialGradient(n.x-r*0.3,n.y-r*0.3,2,n.x,n.y,r)
        bg.addColorStop(0,color+(isHov?"66":"33"));bg.addColorStop(1,bgEnd)
        ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fillStyle=bg;ctx.fill()
        ctx.strokeStyle=isDwelling?"#FF3333":n.exploding?"#44FF44":n.starving?"#FF4444":color
        ctx.lineWidth=isDwelling?3:isHov?2.5:2;ctx.stroke()
        if(isDwelling&&dwellRef.current){
          const pct=(Date.now()-dwellRef.current.startTime)/DWELL_MS
          ctx.beginPath();ctx.arc(n.x,n.y,r+8,-Math.PI/2,-Math.PI/2+pct*Math.PI*2)
          ctx.strokeStyle="#FF3333";ctx.lineWidth=4;ctx.stroke()
        }
        ctx.font=`${isHov?24:20}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(def.emoji,n.x,n.y-1)
        ctx.font=`bold ${isHov?13:11}px Arial, sans-serif`
        const lbl=def.label.toUpperCase(),tw=ctx.measureText(lbl).width,ly=n.y+r+16
        ctx.fillStyle=isDay?"rgba(255,255,255,0.75)":"rgba(0,0,0,0.65)"
        ctx.beginPath();ctx.roundRect(n.x-tw/2-6,ly-8,tw+12,16,8);ctx.fill()
        ctx.fillStyle=n.exploding?"#44FF44":n.starving?"#FF4444":isHov?(isDay?"#000":"#FFF"):isDay?"#1A3A1A":color
        ctx.fillText(lbl,n.x,ly)
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

  const startDwell=useCallback((nodeId:string)=>{
    if(dwellRef.current?.nodeId===nodeId) return
    if(dwellRef.current?.timerId) clearTimeout(dwellRef.current.timerId)
    const timerId=setTimeout(async()=>{dwellRef.current=null;await deleteNodeAnimated(nodeId)},DWELL_MS)
    dwellRef.current={nodeId,startTime:Date.now(),timerId}
  },[deleteNodeAnimated])

  const cancelDwell=useCallback(()=>{if(dwellRef.current?.timerId)clearTimeout(dwellRef.current.timerId);dwellRef.current=null},[])

  const handlePointerDown=useCallback((e:React.PointerEvent)=>{
    const canvas=canvasRef.current;if(!canvas) return
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top
    const node=getPlacedNode(x,y)
    if(node){
      dragRef.current={nodeId:node.id,fromShelf:false,offsetX:node.x-x,offsetY:node.y-y}
      hoveredRef.current=node.id;startDwell(node.id)
    }
  },[startDwell])

  const handlePointerMove=useCallback((e:React.PointerEvent)=>{
    const canvas=canvasRef.current;if(!canvas) return
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top
    if(dragRef.current&&!dragRef.current.fromShelf){
      const n=placedRef.current.find(n=>n.id===dragRef.current!.nodeId)
      if(n){n.x=x+dragRef.current.offsetX;n.y=y+dragRef.current.offsetY;n.vx=0;n.vy=0}
      if(dwellRef.current&&getPlacedNode(x,y)?.id!==dwellRef.current.nodeId)cancelDwell()
    } else {
      hoveredRef.current=getPlacedNode(x,y)?.id||null
    }
  },[cancelDwell])

  const handlePointerUp=useCallback(()=>{
    if(dragRef.current?.fromShelf){return} // shelf drags handled by window listener
    if(dragRef.current){const n=placedRef.current.find(n=>n.id===dragRef.current!.nodeId);if(n&&n.id!==SUN_ID){n.pinned=true;n.vx=0;n.vy=0}}
    dragRef.current=null;cancelDwell()
  },[cancelDwell])

  const handleShelfDragStart=useCallback((e:React.PointerEvent,nodeId:string)=>{
    e.preventDefault()
    dragRef.current={nodeId,fromShelf:true,offsetX:0,offsetY:0}
    const onMove=(ev:PointerEvent)=>setShelfDrag({nodeId,x:ev.clientX,y:ev.clientY})
    const onUp=(ev:PointerEvent)=>{
      console.log("onUp fired", nodeId, ev.clientX, ev.clientY)
      window.removeEventListener("pointermove",onMove)
      window.removeEventListener("pointerup",onUp)
      setShelfDrag(null)
      if(!dragRef.current?.fromShelf){dragRef.current=null;return}
      const canvas=canvasRef.current;if(!canvas){dragRef.current=null;return}
      const rect=canvas.getBoundingClientRect()
      const x=ev.clientX-rect.left,y=ev.clientY-rect.top
      console.log("about to place", nodeId, x, SHELF_W, x>SHELF_W)
      if(x>SHELF_W) placeAnimal(nodeId,x,y)
      dragRef.current=null
    }
    window.addEventListener("pointermove",onMove)
    window.addEventListener("pointerup",onUp)
  },[placeAnimal])

  const unplacedCount=allNodes.filter(n=>!placedIds.has(n.id)).length
  const isDay=sunPresent

  // Shelf panel styles based on day/night
  const shelfBg=isDay?"rgba(240,248,255,0.95)":"rgba(6,6,15,0.92)"
  const shelfBorder=isDay?"rgba(0,0,0,0.08)":"rgba(255,255,255,0.08)"
  const shelfTextColor=isDay?"rgba(0,0,0,0.6)":"rgba(255,255,255,0.5)"
  const titleColor=isDay?"#1A3A1A":"white"

  return(
    <div style={{width:"100vw",height:"100vh",position:"relative",overflow:"hidden",userSelect:"none"}}>
      <canvas ref={canvasRef} style={{display:"block",touchAction:"none"}}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}/>

      {/* Shelf */}
      <AnimatePresence>
        {shelfVisible&&(
          <motion.div initial={{x:-SHELF_W}} animate={{x:0}} exit={{x:-SHELF_W}}
            transition={{type:"spring",stiffness:300,damping:30}}
            style={{position:"absolute",top:0,left:0,bottom:0,width:SHELF_W,
              background:shelfBg,borderRight:`1px solid ${shelfBorder}`,
              backdropFilter:"blur(12px)",zIndex:20,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"14px 12px 10px",borderBottom:`1px solid ${shelfBorder}`}}>
              <div style={{fontFamily:"system-ui",fontWeight:900,fontSize:13,color:shelfTextColor,letterSpacing:"0.12em",textTransform:"uppercase"}}>
                Animals ({unplacedCount} left)
              </div>
              <div style={{display:"flex",gap:6,marginTop:10}}>
                <button onClick={autoFill} style={{flex:1,padding:"6px 0",fontFamily:"system-ui",fontWeight:700,fontSize:11,
                  color:"#44DD88",background:"rgba(68,221,136,0.1)",border:"1px solid rgba(68,221,136,0.3)",
                  borderRadius:6,cursor:"pointer",letterSpacing:"0.08em"}}>⚡ Auto Fill</button>
                <button onClick={()=>setShelfVisible(false)} style={{padding:"6px 10px",fontFamily:"system-ui",fontWeight:700,fontSize:11,
                  color:shelfTextColor,background:"transparent",border:`1px solid ${shelfBorder}`,
                  borderRadius:6,cursor:"pointer"}}>Hide</button>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
              {SHELF_ORDER.map(shelf=>{
                const shelfNodes=allNodes.filter(n=>n.shelf===shelf&&!placedIds.has(n.id))
                const isSunShelf=shelf==="☀️ Sun"
                return(
                  <div key={shelf}>
                    <button onClick={()=>setShelfOpen(p=>({...p,[shelf]:!p[shelf]}))} style={{
                      width:"100%",padding:"7px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",
                      background:"transparent",border:"none",cursor:"pointer",fontFamily:"system-ui",fontWeight:700,
                      fontSize:12,color:isSunShelf?"#FFB700":shelfTextColor,letterSpacing:"0.08em"}}>
                      <span>{shelf}</span><span style={{fontSize:9,opacity:0.5}}>{shelfOpen[shelf]?"▲":"▼"}</span>
                    </button>
                    <AnimatePresence>
                      {shelfOpen[shelf]&&(
                        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
                          transition={{duration:0.2}} style={{overflow:"hidden"}}>
                          {shelfNodes.length===0?(
                            <div style={{padding:"4px 14px 10px",fontFamily:"system-ui",fontSize:11,color:shelfTextColor,fontStyle:"italic",opacity:0.5}}>
                              {isSunShelf?"Sun is in the sky ☀️":"All placed"}
                            </div>
                          ):(
                            <div style={{padding:"4px 10px 10px",display:"flex",flexWrap:"wrap",gap:6}}>
                              {shelfNodes.map(node=>{
                                const color=node.id===SUN_ID?"#FFD700":TROPHIC_COLOR[node.trophic]||"#FFF"
                                return(
                                  <motion.div key={node.id} whileHover={{scale:1.08}}
                                    style={{width:node.id===SUN_ID?SHELF_W-28:58,display:"flex",flexDirection:"column",alignItems:"center",
                                      cursor:"grab",padding:"7px 4px",borderRadius:10,
                                      border:`1px solid ${color}44`,background:`${color}15`,touchAction:"none"}}
                                    onPointerDown={e=>handleShelfDragStart(e,node.id)}>
                                    <span style={{fontSize:node.id===SUN_ID?28:22}}>{node.emoji}</span>
                                    <span style={{fontFamily:"system-ui",fontWeight:700,fontSize:node.id===SUN_ID?10:8,color,
                                      textAlign:"center",marginTop:3,lineHeight:1.2,letterSpacing:"0.05em"}}>
                                      {node.label.toUpperCase()}</span>
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!shelfVisible&&(
          <motion.button initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setShelfVisible(true)}
            style={{position:"absolute",top:20,left:16,zIndex:20,padding:"8px 14px",
              fontFamily:"system-ui",fontWeight:700,fontSize:13,
              color:isDay?"rgba(0,0,0,0.6)":"rgba(255,255,255,0.6)",
              background:isDay?"rgba(240,248,255,0.9)":"rgba(6,6,15,0.8)",
              border:`1px solid ${isDay?"rgba(0,0,0,0.12)":"rgba(255,255,255,0.12)"}`,
              borderRadius:8,cursor:"pointer"}}>☰ Animals</motion.button>
        )}
      </AnimatePresence>

      {/* Title */}
      <div style={{position:"absolute",top:18,left:"50%",transform:"translateX(-50%)",textAlign:"center",pointerEvents:"none",zIndex:10}}>
        <div style={{fontFamily:"system-ui",fontWeight:900,fontSize:20,color:titleColor,letterSpacing:"0.2em",
          textShadow:isDay?"0 1px 8px rgba(255,255,255,0.8)":"0 0 20px rgba(255,255,255,0.3)"}}>
          {isDay?"🌿":"🌑"} NC Food Web
        </div>
        <div style={{fontFamily:"system-ui",fontSize:12,color:isDay?"rgba(0,80,0,0.6)":"rgba(255,255,255,0.35)",letterSpacing:"0.15em",marginTop:3}}>
          {isDay?"☀️ The sun is shining — life thrives!":"🌑 Add the sun to begin · Hold 5s to remove"}
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message&&(
          <motion.div style={{position:"absolute",top:"30%",left:"50%",transform:"translateX(-50%)",
            background:"rgba(0,0,0,0.85)",borderRadius:14,padding:"18px 36px",
            border:`2px solid ${message.color}`,pointerEvents:"none",backdropFilter:"blur(8px)",zIndex:30}}
            initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.8,opacity:0}}
            transition={{type:"spring",stiffness:300,damping:22}}>
            <div style={{fontFamily:"system-ui",fontWeight:900,fontSize:24,color:message.color,textAlign:"center"}}>{message.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shelf drag ghost */}
      <AnimatePresence>
        {shelfDrag&&(()=>{
          const def=allNodes.find(n=>n.id===shelfDrag.nodeId)
          const color=def?.id===SUN_ID?"#FFD700":TROPHIC_COLOR[def?.trophic||""]||"#FFF"
          return(
            <motion.div style={{
              position:"fixed",left:shelfDrag.x-32,top:shelfDrag.y-32,
              width:64,height:64,borderRadius:"50%",
              background:`${color}22`,border:`2px solid ${color}88`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:28,pointerEvents:"none",zIndex:100,
            }}
              initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.8,opacity:0}}
            >{def?.emoji}</motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}

function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}