"use client"

import { motion, AnimatePresence } from "framer-motion"

export type HeronState = "idle" | "chewing" | "happy" | "spit"

interface HeronFaceProps {
  state: HeronState
  size?: number
}

export default function HeronFace({ state, size = 360 }: HeronFaceProps) {
  const isChewing = state === "chewing"
  const isHappy = state === "happy"
  const isSpit = state === "spit"
  const mouthOpen = state === "idle" || state === "happy" || state === "spit"

  // The beak base attaches at the left side of the head
  // Head center: cx=230, cy=185, rx=105, ry=100
  // Beak base left edge of head ≈ x=125
  // Beak tip points to x=0

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 360 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* BODY */}
        <ellipse cx={225} cy={340} rx={58} ry={42} fill="#3A80C9" />
        <ellipse cx={225} cy={340} rx={36} ry={26} fill="#5A9FE0" />

        {/* HEAD — big round */}
        <ellipse cx={228} cy={182} rx={108} ry={104} fill="#3A80C9" />
        <ellipse cx={255} cy={152} rx={56} ry={44} fill="#5A9FE0" opacity={0.35} />

        {/* CROWN STRIPE */}
        <path d="M 172 128 Q 228 112 284 128" stroke="#1A3555" strokeWidth={8} strokeLinecap="round" fill="none" />

        {/* CROWN PLUMES */}
        <motion.g
          animate={isHappy ? { rotate:[-5,5,-3,3,0], y:[0,-8,0] } : isChewing ? { rotate:[-2,2,-2,2,0] } : {}}
          transition={{ duration:0.5, repeat: isHappy ? 1 : 0 }}
          style={{ transformOrigin:"228px 110px" }}
        >
          <path d="M 205 116 Q 198 72 191 36" stroke="#1A3555" strokeWidth={3.5} strokeLinecap="round" fill="none"/>
          <path d="M 222 108 Q 220 62 222 24" stroke="#1A3555" strokeWidth={3.5} strokeLinecap="round" fill="none"/>
          <path d="M 238 110 Q 243 64 248 26" stroke="#1A3555" strokeWidth={3.5} strokeLinecap="round" fill="none"/>
          <path d="M 252 116 Q 261 72 267 38" stroke="#1A3555" strokeWidth={3} strokeLinecap="round" fill="none"/>
          <circle cx={191} cy={33} r={5} fill="#1A3555"/>
          <circle cx={222} cy={21} r={5} fill="#1A3555"/>
          <circle cx={248} cy={23} r={5} fill="#1A3555"/>
          <circle cx={267} cy={35} r={4} fill="#1A3555"/>
        </motion.g>

        {/* LEFT EYE */}
        <motion.g
          animate={isHappy ? { scaleY:[1,0.2,1,0.2,1] } : {}}
          transition={{ duration:0.5 }}
          style={{ transformOrigin:"178px 168px" }}
        >
          <circle cx={178} cy={168} r={24} fill="white"/>
          <circle cx={178} cy={168} r={15} fill="#10102A"/>
          <circle cx={184} cy={161} r={7} fill="white"/>
          <motion.circle cx={178} cy={168} r={8} fill="#06060F"
            animate={isHappy ? { cy:[168,162,168], cx:[178,184,178] } : {}}
            transition={{ duration:0.4, repeat: isHappy ? 2 : 0 }}
          />
        </motion.g>

        {/* RIGHT EYE */}
        <motion.g
          animate={isHappy ? { scaleY:[1,0.2,1,0.2,1] } : {}}
          transition={{ duration:0.5 }}
          style={{ transformOrigin:"272px 168px" }}
        >
          <circle cx={272} cy={168} r={24} fill="white"/>
          <circle cx={272} cy={168} r={15} fill="#10102A"/>
          <circle cx={278} cy={161} r={7} fill="white"/>
          <motion.circle cx={272} cy={168} r={8} fill="#06060F"
            animate={isHappy ? { cy:[168,162,168], cx:[272,278,272] } : {}}
            transition={{ duration:0.4, repeat: isHappy ? 2 : 0 }}
          />
        </motion.g>

        {/* EYEBROWS */}
        <motion.path strokeWidth={5} stroke="#1A3555" fill="none" strokeLinecap="round"
          animate={
            isHappy ? { d:"M 155 144 Q 178 132 201 144" } :
            isSpit  ? { d:"M 155 150 Q 178 146 201 150" } :
                      { d:"M 155 147 Q 178 138 201 147" }
          }
          transition={{ duration:0.2 }}
        />
        <motion.path strokeWidth={5} stroke="#1A3555" fill="none" strokeLinecap="round"
          animate={
            isHappy ? { d:"M 249 144 Q 272 132 295 144" } :
            isSpit  ? { d:"M 249 150 Q 272 146 295 150" } :
                      { d:"M 249 147 Q 272 138 295 147" }
          }
          transition={{ duration:0.2 }}
        />

        {/* ══════════════════════════════
            BEAK — clean, no tongue/teeth
            Upper jaw: flat, attached to head at x≈120
            Lower jaw: drops down when open
            ══════════════════════════════ */}

        {/* UPPER JAW — tapered wedge */}
        <path
          d="M 125 188 L 125 208 L 48 220 L 52 212 Z"
          fill="#F5A623"
          stroke="#D4891A"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* LOWER JAW — animated */}
        <motion.path
          fill="#E89020"
          stroke="#C07A10"
          strokeWidth={1.5}
          strokeLinejoin="round"
          animate={
            isChewing ? {
              d:[
                "M 125 208 L 52 212 L 48 222 L 125 222 Z",
                "M 125 208 L 52 212 L 48 258 L 125 256 Z",
                "M 125 208 L 52 212 L 48 234 L 125 232 Z",
                "M 125 208 L 52 212 L 48 262 L 125 260 Z",
                "M 125 208 L 52 212 L 48 232 L 125 230 Z",
                "M 125 208 L 52 212 L 48 222 L 125 222 Z",
              ]
            } :
            mouthOpen
              ? { d:"M 125 208 L 52 212 L 48 258 L 125 258 Z" }
              : { d:"M 125 208 L 52 212 L 48 220 L 125 218 Z" }
          }
          transition={
            isChewing
              ? { duration:1.6, ease:"easeInOut", times:[0,0.2,0.4,0.6,0.8,1] }
              : { duration:0.3, ease:"backOut" }
          }
        />



        {/* HAPPY CHEEKS */}
        <AnimatePresence>
          {isHappy && (
            <>
              <motion.ellipse cx={162} cy={200} rx={17} ry={10} fill="rgba(255,90,90,0.38)"
                initial={{ opacity:0, scale:0 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                style={{ transformOrigin:"162px 200px" }}
              />
              <motion.ellipse cx={290} cy={200} rx={17} ry={10} fill="rgba(255,90,90,0.38)"
                initial={{ opacity:0, scale:0 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                style={{ transformOrigin:"290px 200px" }}
              />
            </>
          )}
        </AnimatePresence>

        {/* HAPPY SMILE */}
        <AnimatePresence>
          {isHappy && (
            <motion.path d="M 164 218 Q 228 244 290 218"
              stroke="#1A3555" strokeWidth={5} fill="none" strokeLinecap="round"
              initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.35 }}
            />
          )}
        </AnimatePresence>

        {/* SPIT DROPLETS */}
        <AnimatePresence>
          {isSpit && [
            { x:52, y:225, r:5, dx:-28, dy:-12 },
            { x:56, y:238, r:7, dx:-44, dy:6 },
            { x:46, y:244, r:4, dx:-18, dy:18 },
            { x:60, y:230, r:6, dx:-36, dy:-3 },
            { x:44, y:235, r:3, dx:-12, dy:10 },
          ].map((d,i) => (
            <motion.circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#5AAAE0" opacity={0.9}
              initial={{ cx:d.x, cy:d.y, opacity:0.9 }}
              animate={{ cx:d.x+d.dx, cy:d.y+d.dy, opacity:0 }}
              exit={{ opacity:0 }}
              transition={{ duration:0.5, delay:i*0.06, ease:"easeOut" }}
            />
          ))}
        </AnimatePresence>
      </svg>
    </div>
  )
}