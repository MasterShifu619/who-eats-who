"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion"
import LizardFace, { LizardState } from "@/components/game2/LizardFace"
import type { BubbleSpecies } from "@/components/game2/FloatingBubble"
import { checkFeed } from "@/lib/api"

const PREDATOR    = "Anolis sagrei"
const REPEL_R     = 200
const STRIKE_R    = 100   // tighter strike zone
const BUBBLE_SIZE = 88
const LIZARD_SIZE = 240
const MOUTH_SVG   = { x: 18, y: 138 } // anchor in SVG viewBox

const BUBBLES: BubbleSpecies[] = [
  { scientific_name:"Anolis sagrei",            common_name:"Brown Anole",          thumbnail_url:"https://static.inaturalist.org/photos/12983784/medium.jpg",                   is_prey:true  },
  { scientific_name:"Erythemis simplicicollis", common_name:"Eastern Pondhawk",     thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/456244021/medium.jpg",  is_prey:true  },
  { scientific_name:"Hemidactylus mabouia",     common_name:"Tropical House Gecko", thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/107753387/medium.jpeg", is_prey:true  },
  { scientific_name:"Vanessa atalanta",         common_name:"Red Admiral",          thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/306750071/medium.jpg",  is_prey:false },
  { scientific_name:"Megascapheus bottae",      common_name:"Pocket Gopher",        thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/12325978/medium.jpeg",  is_prey:false },
  { scientific_name:"Desmognathus monticola",   common_name:"Seal Salamander",      thumbnail_url:"https://static.inaturalist.org/photos/267729758/medium.jpeg",                 is_prey:false },
  { scientific_name:"Araneus diadematus",       common_name:"Cross Orbweaver",      thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/478180364/medium.jpeg", is_prey:false },
  { scientific_name:"Triakis semifasciata",     common_name:"Leopard Shark",        thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/62894394/medium.jpeg",  is_prey:false },
  { scientific_name:"Corvus brachyrhynchos",    common_name:"American Crow",        thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/278841490/medium.jpeg", is_prey:false },
  { scientific_name:"Emerita analoga",          common_name:"Sand Crab",            thumbnail_url:"https://inaturalist-open-data.s3.amazonaws.com/photos/450003101/medium.jpeg", is_prey:false },
]
const TOTAL_PREY = BUBBLES.filter(b => b.is_prey).length

type GameState = "IDLE"|"DRAGGING"|"TONGUE_STRIKE"|"EVALUATING"|"RESULT_VALID"|"RESULT_INVALID"

interface Bubble { sci:string; x:number; y:number; vx:number; vy:number; eaten:boolean }

function seedVel(sci:string) {
  let h=0; for(let i=0;i<sci.length;i++) h=sci.charCodeAt(i)+((h<<5)-h)
  const spd=0.055+(Math.abs(h)%100)*0.0005
  const ang=((Math.abs(h>>3)%360)*Math.PI)/180
  return {vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd}
}

function initBubbles(w:number,h:number,mX:number,mY:number):Bubble[] {
  return BUBBLES.map(s=>{
    let x:number,y:number,tries=0
    do {
      x=80+Math.random()*(w-200); y=80+Math.random()*(h-200); tries++
    } while(tries<60 && Math.hypot(x-mX,y-mY)<REPEL_R+80)
    return {sci:s.scientific_name,x,y,...seedVel(s.scientific_name),eaten:false}
  })
}

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))

export default function LizardPage() {
  const [gs,setGs]                     = useState<GameState>("IDLE")
  const [dims,setDims]                 = useState({w:1440,h:900})
  const [bubbles,setBubbles]           = useState<Bubble[]>([])
  const [score,setScore]               = useState(0)
  const [feedback,setFeedback]         = useState<"valid"|"invalid"|null>(null)
  const [lzState,setLzState]           = useState<LizardState>("idle")
  const [tongueEnd,setTongueEnd]       = useState<{x:number;y:number}|null>(null)
  const [dragSp,setDragSp]             = useState<BubbleSpecies|null>(null)
  const [dragPos,setDragPos]           = useState<{x:number;y:number}|null>(null)
  const [swallowPos,setSwallowPos]     = useState<{x:number;y:number}|null>(null)
  const [bScale,setBScale]             = useState(1)
  const [bOpacity,setBOpacity]         = useState(1)
  const [lizardRect,setLizardRect]     = useState<DOMRect|null>(null)
  const [eyeTarget,setEyeTarget]       = useState<{x:number;y:number}|null>(null)

  const bRef   = useRef<Bubble[]>([])
  const gsRef  = useRef<GameState>("IDLE")
  const lzRef  = useRef<HTMLDivElement>(null)

  const getMouth = useCallback(():{x:number;y:number}=>{
    const lr=lzRef.current?.getBoundingClientRect()
    if(!lr) return {x:dims.w-60,y:160}
    const sc=LIZARD_SIZE/240
    return {x:lr.left+MOUTH_SVG.x*sc, y:lr.top+MOUTH_SVG.y*sc}
  },[dims])

  useEffect(()=>{
    const w=window.innerWidth,h=window.innerHeight
    setDims({w,h})
    const mX=w-LIZARD_SIZE+MOUTH_SVG.x, mY=MOUTH_SVG.y*(LIZARD_SIZE/240)
    const b=initBubbles(w,h,mX,mY)
    bRef.current=b; setBubbles([...b])
  },[])

  // Update lizard rect for pupil tracking
  useEffect(()=>{
    const update=()=>{ if(lzRef.current) setLizardRect(lzRef.current.getBoundingClientRect()) }
    update()
    window.addEventListener("resize",update)
    return ()=>window.removeEventListener("resize",update)
  },[])

  // Physics
  useAnimationFrame(()=>{
    if(gsRef.current!=="IDLE"&&gsRef.current!=="DRAGGING") return
    const {w,h}=dims
    const mouth=getMouth()
    const minX=80,maxX=w-80,minY=80,maxY=h-80

    const next=bRef.current.map(b=>{
      if(b.eaten) return b
      if(gsRef.current==="DRAGGING"&&dragSp?.scientific_name===b.sci) return b
      let{x,y,vx,vy}=b
      const dx=x-mouth.x,dy=y-mouth.y
      const dist=Math.hypot(dx,dy)
      if(dist<REPEL_R&&dist>1){const f=((REPEL_R-dist)/REPEL_R)*0.048;vx+=(dx/dist)*f;vy+=(dy/dist)*f}
      const spd=Math.hypot(vx,vy)
      if(spd>0.45){vx=(vx/spd)*0.45;vy=(vy/spd)*0.45}
      if(spd<0.035){vx*=1.04;vy*=1.04}
      x+=vx;y+=vy
      if(x<=minX){x=minX;vx=Math.abs(vx)} if(x>=maxX){x=maxX;vx=-Math.abs(vx)}
      if(y<=minY){y=minY;vy=Math.abs(vy)} if(y>=maxY){y=maxY;vy=-Math.abs(vy)}
      return {...b,x,y,vx,vy}
    })
    bRef.current=next; setBubbles([...next])
  })

  // Drag
  const startDrag=useCallback((sp:BubbleSpecies,cX:number,cY:number,bx:number,by:number)=>{
    if(gsRef.current!=="IDLE") return
    gsRef.current="DRAGGING"; setGs("DRAGGING")
    setDragSp(sp); setDragPos({x:bx,y:by})
    setEyeTarget({x:bx,y:by})
    const mouth=getMouth()
    const onMove=(e:PointerEvent)=>{
      if(gsRef.current!=="DRAGGING") return
      const nx=bx+(e.clientX-cX), ny=by+(e.clientY-cY)
      setDragPos({x:nx,y:ny}); setEyeTarget({x:nx,y:ny})
      if(Math.hypot(nx-mouth.x,ny-mouth.y)<STRIKE_R){
        window.removeEventListener("pointermove",onMove)
        window.removeEventListener("pointerup",onUp)
        capture(sp,nx,ny)
      }
    }
    const onUp=()=>{
      window.removeEventListener("pointermove",onMove)
      window.removeEventListener("pointerup",onUp)
      gsRef.current="IDLE"; setGs("IDLE")
      setDragSp(null); setDragPos(null); setEyeTarget(null)
    }
    window.addEventListener("pointermove",onMove)
    window.addEventListener("pointerup",onUp)
  },[getMouth])

  // Capture state machine
  const capture=useCallback(async(sp:BubbleSpecies,bx:number,by:number)=>{
    gsRef.current="TONGUE_STRIKE"; setGs("TONGUE_STRIKE")
    setLzState("tongue_out"); setTongueEnd({x:bx,y:by})
    setDragPos(null); setDragSp(null); setEyeTarget({x:bx,y:by})
    setBScale(1); setBOpacity(1); setSwallowPos({x:bx,y:by})
    await sleep(550)

    // EVALUATING — 2 second pause
    gsRef.current="EVALUATING"; setGs("EVALUATING"); setLzState("catching")
    const [res]=await Promise.all([
      checkFeed(PREDATOR,sp.scientific_name).catch(()=>({valid:false})),
      sleep(2000)
    ])

    if(res.valid){
      gsRef.current="RESULT_VALID"; setGs("RESULT_VALID")
      setLzState("swallow"); setFeedback("valid")
      const mouth=getMouth()

      // Animate bubble to mouth — 30 steps over 700ms
      const steps=30, sx=bx, sy=by
      for(let i=0;i<=steps;i++){
        const t=i/steps
        setSwallowPos({x:sx+(mouth.x-sx)*t, y:sy+(mouth.y-sy)*t})
        await sleep(700/steps)
      }
      // Vanish
      setBScale(0); setBOpacity(0)
      await sleep(300)

      // Mark eaten, tongue gone
      bRef.current=bRef.current.map(b=>b.sci===sp.scientific_name?{...b,eaten:true}:b)
      setBubbles([...bRef.current])
      setTongueEnd(null); setSwallowPos(null)
      setScore(s=>s+1)
      setEyeTarget(null)

      // Lick
      await sleep(500); setLzState("lick")
      await sleep(1000)
    } else {
      gsRef.current="RESULT_INVALID"; setGs("RESULT_INVALID")
      setLzState("spit"); setFeedback("invalid")
      await sleep(380)
      setTongueEnd(null); setSwallowPos(null)

      // Kick bubble away — velocity -400x, +400y equivalent
      const mouth=getMouth()
      bRef.current=bRef.current.map(b=>{
        if(b.sci!==sp.scientific_name) return b
        const dx=bx-mouth.x, dy=by-mouth.y
        const dist=Math.hypot(dx,dy)||1
        // Normalize and scale to room-speed equivalent (~3.0)
        return {...b,x:bx,y:by,vx:(dx/dist)*3.0,vy:(dy/dist)*3.0}
      })
      setBubbles([...bRef.current])
      setEyeTarget(null)
      await sleep(1400)
    }

    setLzState("idle"); setFeedback(null)
    setBScale(1); setBOpacity(1)
    gsRef.current="IDLE"; setGs("IDLE")
  },[getMouth])

  const mouth=getMouth()
  const fb=feedback==="valid"?{emoji:"😋",text:"Yummy!",color:"#7BC67E"}
           :feedback==="invalid"?{emoji:"🤢",text:"Nope!",color:"#F87171"}:null

  const {w,h}=dims

  return (
    <div style={{width:"100vw",height:"100vh",position:"relative",overflow:"hidden",userSelect:"none"}}>

      {/* ══════════════════════════════════════════
          FUNKY DESERT TERRARIUM ROOM
          ══════════════════════════════════════════ */}

      {/* Back wall — warm sandy base */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#E8C080 0%,#D4A55A 45%,#C8904A 100%)"}}/>

      {/* Golden sunlight radial overlay */}
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 30% 20%, rgba(255,220,100,0.38) 0%, transparent 70%)",pointerEvents:"none"}}/>

      {/* ── CANYON ROCK LAYERS — back wall ── */}
      <svg style={{position:"absolute",bottom:48,left:0,right:0,width:"100%",height:"55%",pointerEvents:"none"}} viewBox={`0 0 ${w} 400`} preserveAspectRatio="none">
        {/* Layer 1 — deepest, darkest */}
        <path d={`M0 400 Q${w*0.1} 260 ${w*0.25} 280 Q${w*0.4} 300 ${w*0.55} 260 Q${w*0.7} 220 ${w*0.85} 250 Q${w*0.95} 270 ${w} 240 L${w} 400 Z`} fill="#C07840" opacity={0.6}/>
        {/* Layer 2 */}
        <path d={`M0 400 Q${w*0.12} 310 ${w*0.28} 325 Q${w*0.45} 340 ${w*0.6} 305 Q${w*0.75} 270 ${w*0.88} 295 Q${w*0.96} 310 ${w} 285 L${w} 400 Z`} fill="#B86E34" opacity={0.55}/>
        {/* Layer 3 — lightest, top stripe */}
        <path d={`M0 380 Q${w*0.15} 355 ${w*0.3} 365 Q${w*0.5} 375 ${w*0.65} 350 Q${w*0.8} 330 ${w} 345 L${w} 380 Z`} fill="#D4905A" opacity={0.5}/>
        {/* Rock texture lines */}
        <path d={`M${w*0.05} 300 Q${w*0.2} 295 ${w*0.35} 302`} stroke="#A05A28" strokeWidth={2} fill="none" opacity={0.4}/>
        <path d={`M${w*0.4} 280 Q${w*0.55} 272 ${w*0.7} 278`} stroke="#A05A28" strokeWidth={2} fill="none" opacity={0.4}/>
      </svg>

      {/* ── CARTOON SAGUARO CACTUS — back left ── */}
      <svg style={{position:"absolute",bottom:48,left:"6%",pointerEvents:"none",opacity:0.9}} width={90} height={200} viewBox="0 0 90 200">
        {/* Main trunk */}
        <rect x={32} y={40} width={26} height={160} rx={13} fill="#4A8A28"/>
        {/* Left arm */}
        <rect x={10} y={90} width={22} height={14} rx={7} fill="#4A8A28"/>
        <rect x={10} y={70} width={14} height={34} rx={7} fill="#4A8A28"/>
        {/* Right arm */}
        <rect x={58} y={110} width={22} height={14} rx={7} fill="#4A8A28"/>
        <rect x={66} y={90} width={14} height={38} rx={7} fill="#4A8A28"/>
        {/* Spine dots */}
        {[[38,60],[38,80],[38,100],[38,120],[38,140],[38,160],[54,70],[54,90],[54,110],[54,130],[54,150]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r={2} fill="#2A5A14" opacity={0.6}/>
        ))}
        {/* Top */}
        <ellipse cx={45} cy={42} rx={13} ry={8} fill="#5A9A30"/>
      </svg>

      {/* ── CEILING — warm tan ── */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:20,background:"#C89858",borderBottom:"3px solid #A07A3A"}}/>

      {/* ── DRY LEAVES near lizard (top right ceiling) ── */}
      <svg style={{position:"absolute",top:0,right:80,pointerEvents:"none"}} width={180} height={55} viewBox="0 0 180 55">
        {/* Leaf 1 */}
        <motion.path d="M 140 18 Q 158 8 165 22 Q 170 32 152 28 Z" fill="#8B6020" opacity={0.8}
          animate={{rotate:[-2,2,-2]}} transition={{duration:3,repeat:Infinity,ease:"easeInOut"}}
          style={{transformOrigin:"152px 18px"}}
        />
        {/* Leaf 2 */}
        <motion.path d="M 110 14 Q 124 4 132 18 Q 136 28 120 24 Z" fill="#9A6A24" opacity={0.75}
          animate={{rotate:[1,-1,1]}} transition={{duration:2.6,repeat:Infinity,ease:"easeInOut"}}
          style={{transformOrigin:"122px 14px"}}
        />
        {/* Leaf 3 */}
        <path d="M 158 24 Q 172 16 176 28 Q 178 36 164 32 Z" fill="#7A5018" opacity={0.7}/>
        {/* Leaf veins */}
        <path d="M 145 22 L 162 16" stroke="#6A4010" strokeWidth={1} fill="none" opacity={0.5}/>
        <path d="M 116 18 L 130 12" stroke="#6A4010" strokeWidth={1} fill="none" opacity={0.5}/>
      </svg>

      {/* ── FLOOR — textured sand ── */}
      <svg style={{position:"absolute",bottom:0,left:0,width:"100%",height:52,pointerEvents:"none"}} viewBox={`0 0 ${w} 52`} preserveAspectRatio="none">
        <defs>
          <pattern id="sand" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#C8904A"/>
            <circle cx="2" cy="3" r="0.8" fill="#B87A38" opacity="0.6"/>
            <circle cx="6" cy="6" r="0.6" fill="#D4A055" opacity="0.5"/>
            <circle cx="4" cy="1" r="0.5" fill="#A86A28" opacity="0.4"/>
          </pattern>
        </defs>
        <rect width="100%" height="52" fill="url(#sand)"/>
        <path d={`M0 8 Q${w*0.2} 4 ${w*0.5} 6 Q${w*0.8} 8 ${w} 4`} stroke="#B07838" strokeWidth={1.5} fill="none" opacity={0.4}/>
        {/* Floor border */}
        <rect width="100%" height="3" fill="#9A6830"/>
      </svg>

      {/* ── CARTOON PEBBLES on floor ── */}
      <svg style={{position:"absolute",bottom:48,left:"20%",pointerEvents:"none"}} width={280} height={38} viewBox="0 0 280 38">
        <ellipse cx={30} cy={28} rx={28} ry={16} fill="#A07850" opacity={0.85}/>
        <ellipse cx={26} cy={24} rx={14} ry={7} fill="#B89060" opacity={0.4}/>
        <ellipse cx={100} cy={30} rx={20} ry={12} fill="#987040" opacity={0.82}/>
        <ellipse cx={97} cy={26} rx={10} ry={5} fill="#B08858" opacity={0.4}/>
        <ellipse cx={210} cy={28} rx={34} ry={18} fill="#8A6838" opacity={0.8}/>
        <ellipse cx={205} cy={23} rx={18} ry={8} fill="#A07848" opacity={0.4}/>
      </svg>

      {/* ── SIDE WALLS ── */}
      <div style={{position:"absolute",top:0,left:0,bottom:0,width:20,background:"linear-gradient(90deg,#A07848,#C89858)",borderRight:"2px solid #8A6030"}}/>
      <div style={{position:"absolute",top:0,right:0,bottom:0,width:20,background:"linear-gradient(270deg,#A07848,#C89858)",borderLeft:"2px solid #8A6030"}}/>

      {/* ── SCORE ── */}
      <div style={{position:"absolute",top:30,left:36,zIndex:20,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:22}}>🦎</span>
        <span style={{fontFamily:"system-ui,sans-serif",fontWeight:900,fontSize:20,color:"#FFF3DC",textShadow:"0 2px 6px rgba(0,0,0,0.5)"}}>
          {score} / {TOTAL_PREY}
        </span>
      </div>

      {/* ── TITLE ── */}
      <div style={{position:"absolute",top:28,left:"50%",transform:"translateX(-50%)",zIndex:20,textAlign:"center",pointerEvents:"none"}}>
        <div style={{fontFamily:"system-ui,sans-serif",fontWeight:900,fontSize:18,color:"#FFF3DC",textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>
          🦎 Feed the Anole!
        </div>
        <div style={{fontFamily:"system-ui,sans-serif",fontWeight:600,fontSize:11,color:"rgba(255,240,200,0.5)",marginTop:2}}>
          Drag animals close to the lizard
        </div>
      </div>

      <a href="/game2/heron" style={{position:"absolute",top:30,right:36,zIndex:20,fontFamily:"system-ui,sans-serif",fontWeight:700,fontSize:12,color:"rgba(255,240,200,0.45)",textDecoration:"none"}}>← Heron</a>

      {/* ── TONGUE SVG — full screen overlay ── */}
      {tongueEnd && (gs==="TONGUE_STRIKE"||gs==="EVALUATING"||gs==="RESULT_VALID") && (
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:36}}>
          {/* Path A — main bezier from mouth to bubble perimeter */}
          <motion.path
            d={`M ${mouth.x} ${mouth.y}
                Q ${mouth.x-100} ${(mouth.y+tongueEnd.y)/2-50}
                  ${tongueEnd.x+BUBBLE_SIZE*0.38} ${tongueEnd.y-BUBBLE_SIZE*0.32}`}
            stroke="#C01010" strokeWidth={8} strokeLinecap="round" fill="none"
            initial={{pathLength:0}}
            animate={{pathLength: gs==="RESULT_VALID" ? 0 : 1}}
            transition={{duration:0.42,ease:"easeOut"}}
          />
          {/* Path B — C-hook over bubble — higher z rendered last */}
          <motion.path
            d={`M ${tongueEnd.x+BUBBLE_SIZE*0.38} ${tongueEnd.y-BUBBLE_SIZE*0.32}
                C ${tongueEnd.x+BUBBLE_SIZE*0.7}  ${tongueEnd.y-BUBBLE_SIZE*0.58}
                  ${tongueEnd.x+BUBBLE_SIZE*0.7}  ${tongueEnd.y+BUBBLE_SIZE*0.48}
                  ${tongueEnd.x+BUBBLE_SIZE*0.08}  ${tongueEnd.y+BUBBLE_SIZE*0.4}`}
            stroke="#D81818" strokeWidth={7} strokeLinecap="round" fill="none"
            initial={{pathLength:0,opacity:0}}
            animate={{pathLength: gs==="RESULT_VALID"?0:1, opacity: gs==="RESULT_VALID"?0:1}}
            transition={{duration:0.32,delay:0.36}}
          />
        </svg>
      )}

      {/* ── LIZARD ── */}
      <div ref={lzRef} style={{position:"absolute",top:0,right:24,zIndex:30}}>
        <motion.div
          animate={
            gs==="EVALUATING"     ?{rotate:[-1,1,-1,1,0]}:
            gs==="RESULT_VALID"   ?{scale:[1,1.07,1]}:
            gs==="RESULT_INVALID" ?{rotate:[0,5,-5,0]}:{}
          }
          transition={{duration:0.5}}
        >
          <LizardFace
            state={lzState}
            size={LIZARD_SIZE}
            eyeTargetX={eyeTarget?.x}
            eyeTargetY={eyeTarget?.y}
            lizardRect={lizardRect}
          />
        </motion.div>
      </div>

      {/* ── BUBBLES ── */}
      {bubbles.map(b=>{
        if(b.eaten) return null
        const sp=BUBBLES.find(s=>s.scientific_name===b.sci)!
        const isDragged=dragSp?.scientific_name===b.sci
        const isCaptured=swallowPos!==null&&tongueEnd!==null&&!isDragged&&gs!=="IDLE"&&gs!=="DRAGGING"

        let dispX=b.x, dispY=b.y
        if(isDragged&&dragPos){dispX=dragPos.x;dispY=dragPos.y}
        else if(isCaptured&&swallowPos){dispX=swallowPos.x;dispY=swallowPos.y}

        return (
          <motion.div key={b.sci} style={{
            position:"absolute",
            left:dispX-BUBBLE_SIZE/2, top:dispY-BUBBLE_SIZE/2,
            width:BUBBLE_SIZE, height:BUBBLE_SIZE+28,
            zIndex:isCaptured?35:isDragged?38:15,
            display:"flex",flexDirection:"column",alignItems:"center",gap:5,
            cursor:gs==="IDLE"?"grab":"default",
            touchAction:"none",
            pointerEvents:gs==="IDLE"?"auto":"none",
            scale:isCaptured?bScale:1,
            opacity:isCaptured?bOpacity:1,
          }}
            animate={gs==="EVALUATING"&&isCaptured
              ?{x:[-3,3,-2,2,-1,1,0],y:[2,-2,1,-1,0]}
              :{x:0,y:0}
            }
            transition={{duration:0.32,repeat:gs==="EVALUATING"?Infinity:0}}
            onPointerDown={e=>{
              if(gs!=="IDLE") return
              e.preventDefault()
              startDrag(sp,e.clientX,e.clientY,b.x,b.y)
            }}
          >
            <div style={{
              width:BUBBLE_SIZE,height:BUBBLE_SIZE,borderRadius:"50%",overflow:"hidden",
              border:isCaptured?"3px solid #E02020":isDragged?"2px solid rgba(255,220,100,0.7)":"2px solid rgba(255,220,150,0.22)",
              background:"radial-gradient(circle at 35% 30%,rgba(255,255,255,0.22),rgba(180,100,30,0.1))",
              boxShadow:isCaptured
                ?"0 0 28px rgba(220,30,30,0.5),0 6px 20px rgba(0,0,0,0.5)"
                :"0 6px 20px rgba(0,0,0,0.32),inset 0 1px 0 rgba(255,255,255,0.14)",
              position:"relative",transition:"border 0.2s,box-shadow 0.2s",
            }}>
              <img src={sp.thumbnail_url} alt={sp.common_name}
                style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.87,pointerEvents:"none"}}
              />
              <div style={{position:"absolute",top:5,left:9,width:17,height:10,borderRadius:"50%",background:"rgba(255,255,255,0.2)",transform:"rotate(-25deg)"}}/>
            </div>
            <div style={{fontFamily:"system-ui,sans-serif",fontWeight:800,fontSize:10,color:"rgba(255,235,185,0.92)",textAlign:"center",textShadow:"0 1px 4px rgba(0,0,0,0.7)",maxWidth:BUBBLE_SIZE+12,lineHeight:1.2,pointerEvents:"none"}}>
              {sp.common_name}
            </div>
          </motion.div>
        )
      })}

      {/* ── FEEDBACK ── */}
      <AnimatePresence>
        {fb&&(
          <motion.div style={{position:"absolute",top:"32%",left:"38%",transform:"translateX(-50%)",zIndex:50,textAlign:"center",pointerEvents:"none"}}
            initial={{scale:0.3,opacity:0,y:20}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.8,opacity:0}}
            transition={{type:"spring",stiffness:400,damping:18}}
          >
            <div style={{fontSize:68}}>{fb.emoji}</div>
            <div style={{fontFamily:"system-ui,sans-serif",fontWeight:900,fontSize:50,color:fb.color,textShadow:`0 0 24px ${fb.color}99`,marginTop:6}}>{fb.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WIN ── */}
      <AnimatePresence>
        {score===TOTAL_PREY&&score>0&&(
          <motion.div style={{position:"absolute",inset:0,zIndex:60,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(80,40,10,0.78)",backdropFilter:"blur(8px)"}}
            initial={{opacity:0}} animate={{opacity:1}}
          >
            {[...Array(22)].map((_,i)=>(
              <motion.div key={i} style={{position:"absolute",width:10,height:10,borderRadius:"50%",background:["#7BC67E","#F5A623","#E84040","#6BAA42","#FFF3DC"][i%5],left:`${5+(i*4.4)%90}%`,top:"5%"}}
                animate={{y:["0vh","92vh"],rotate:[0,360*(i%2===0?1:-1)],opacity:[1,0]}}
                transition={{duration:2+(i%3)*0.5,delay:i*0.08,repeat:Infinity,ease:"linear"}}
              />
            ))}
            <motion.div style={{fontSize:80}} animate={{scale:[1,1.2,1],rotate:[-5,5,0]}} transition={{duration:0.6,repeat:2}}>🎉</motion.div>
            <motion.div style={{fontFamily:"system-ui,sans-serif",fontWeight:900,fontSize:48,color:"#FFF3DC",textShadow:"0 0 30px rgba(255,200,100,0.5)",marginTop:16,textAlign:"center"}}
              initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}}>
              Lizard is full! 🦎
            </motion.div>
            <motion.button style={{marginTop:36,padding:"14px 48px",fontFamily:"system-ui,sans-serif",fontWeight:800,fontSize:18,color:"#5D3A1A",background:"#F5A623",border:"none",borderRadius:50,cursor:"pointer"}}
              whileHover={{scale:1.08}} whileTap={{scale:0.96}}
              initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}}
              onClick={()=>{
                const m=getMouth()
                const b=initBubbles(dims.w,dims.h,m.x,m.y)
                bRef.current=b; setBubbles([...b])
                setScore(0); gsRef.current="IDLE"; setGs("IDLE")
                setLzState("idle"); setTongueEnd(null); setDragSp(null)
                setBScale(1); setBOpacity(1); setSwallowPos(null); setEyeTarget(null)
              }}
            >🔄 Play Again</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}