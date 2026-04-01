import type { Species, WhoEatsWhomResult } from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TIMEOUT_MS = 2000

async function fetchWithFallback<T>(
  apiPath: string,
  fallbackPath: string
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${API_BASE}${apiPath}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  } catch {
    clearTimeout(timer)
    console.warn(`API unreachable, falling back to static: ${fallbackPath}`)
    const res = await fetch(fallbackPath)
    return res.json()
  }
}

async function fetchAPI<T>(apiPath: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${API_BASE}${apiPath}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// ── Species ───────────────────────────────────────────────────────────────────

export async function getNCSpecies(): Promise<Species[]> {
  return fetchWithFallback<Species[]>(
    "/species?state=North Carolina&limit=50",
    "/static/species.json"
  ).then((all) =>
    // filter to NC from static fallback if needed
    all.filter((s) => s.thumbnail_url)
  )
}

export async function getAllSpecies(limit = 100): Promise<Species[]> {
  return fetchWithFallback<Species[]>(
    `/species?limit=${limit}`,
    "/static/species.json"
  )
}

// ── Game 1 ────────────────────────────────────────────────────────────────────

export async function checkWhoEatsWhom(
  speciesA: string,
  speciesB: string
): Promise<WhoEatsWhomResult> {
  return fetchAPI<WhoEatsWhomResult>(
    `/game/who-eats-whom?species_a=${encodeURIComponent(speciesA)}&species_b=${encodeURIComponent(speciesB)}`
  )
}


// ── Game 2 ────────────────────────────────────────────────────────────────────

export interface FeedResult {
  valid: boolean
  predator: string
  prey: string
  type_of_feeding?: string
  image_url?: string
  observation_uri?: string
  observed_on?: string
  place_state?: string
  prey_common_name?: string
}

export async function checkFeed(predator: string, prey: string): Promise<FeedResult> {
  return fetchAPI<FeedResult>(
    `/game/feed?predator=${encodeURIComponent(predator)}&prey=${encodeURIComponent(prey)}`
  )
}