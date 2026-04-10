import { Howl } from "howler"

const FREESOUND_KEY = process.env.NEXT_PUBLIC_FREESOUND_KEY || ""

// Search queries per animal — tuned for short, recognizable sounds
const ANIMAL_QUERIES: Record<string, string> = {
  "Sun":                  "birds chirping ai",
  "Persimmon Tree":       "leaves crunching",
  "Earthworm":            "video game squeak",
  "Monarch Butterfly":    "butterfly flying loop",
  "Green June Beetle":    "beetle",
  "Fall Field Cricket":   "cricket chirp",
  "Black Carpenter Ant":  "ant",
  "Blue Dasher":          "fly buzz wings",
  "Yellow Garden Spider": "spider hiss",
  "Bluegill":             "fish splash water",
  "Atlantic Blue Crab":   "crab",
  "American Toad":        "frog ribbit",
  "White-footed Mouse":   "rat squeak",
  "Green Anole lizard":   "Small Dragon cry",
  "Eastern Ratsnake":     "snake hiss",
  "Blue Heron":           "heron bird call",
}

// Cache: animalId -> { place: Howl, remove: Howl }
const soundCache: Record<string, { place?: Howl; remove?: Howl }> = {}
const fetchingSet = new Set<string>()

async function fetchSoundUrl(query: string): Promise<string | null> {
  try {
    // console.log("Fetching sound, key:", FREESOUND_KEY ? "present" : "MISSING")
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews,duration&filter=duration:[0+TO+4]&page_size=5&token=${FREESOUND_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    // console.log("Freesound response for", query, data)
    if (data.results && data.results.length > 0) {
      // Pick first result with a preview
      const result = data.results.find((r: any) => r.previews?.["preview-lq-mp3"])
      return result?.previews?.["preview-lq-mp3"] || null
    }
  } catch (e) {
    console.warn("Freesound fetch failed:", e)
  }
  return null
}

export async function preloadSound(animalId: string): Promise<void> {
  if (soundCache[animalId] || fetchingSet.has(animalId)) return
  fetchingSet.add(animalId)

  const query = ANIMAL_QUERIES[animalId]
  if (!query) return

  const url = await fetchSoundUrl(query)
  if (!url) return

  soundCache[animalId] = {
    place: new Howl({ src: [url], volume: 0.6, preload: true }),
    remove: new Howl({ src: [url], volume: 0.4, rate: 0.7, preload: true }), // lower pitch for removal
  }
  fetchingSet.delete(animalId)
}

export function playPlaceSound(animalId: string) {
  console.log("cache for", animalId, soundCache[animalId])
  soundCache[animalId]?.place?.play()
}

export function playRemoveSound(animalId: string) {
  soundCache[animalId]?.remove?.play()
}

// Cascade warning — a low ominous tone using Web Audio API
let audioCtx: AudioContext | null = null
export function playCascadeWarning() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain); gain.connect(audioCtx.destination)
    osc.frequency.setValueAtTime(180, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 1.5)
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5)
    osc.start(); osc.stop(audioCtx.currentTime + 1.5)
  } catch (e) {}
}

// Place chime — bright pop using Web Audio API (instant, no fetch needed)
export function playPlaceChime() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain); gain.connect(audioCtx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
    osc.start(); osc.stop(audioCtx.currentTime + 0.3)
  } catch (e) {}
}