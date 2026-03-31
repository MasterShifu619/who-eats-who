import type { Species } from "./types"

export interface SpeciesClue {
  icon: string
  label: string
}

export interface PairSuggestion {
  species: Species
  score: number
  reasons: string[]
}

const AQUATIC_CLASSES = new Set(["Actinopterygii", "Amphibia", "Mollusca"])

export function getSpeciesLabel(species: Species): string {
  return species.common_name || species.scientific_name
}

export function getTrophicTier(species: Species) {
  const raw = (species.trophic_pos || "").trim().toLowerCase()

  if (species.taxon_kingdom === "Plantae" || raw === "producer") {
    return { label: "Producer", icon: "leaf", level: 0 }
  }
  if (raw === "primary") {
    return { label: "Primary", icon: "seed", level: 1 }
  }
  if (raw === "second" || raw === "secondary") {
    return { label: "Secondary", icon: "fang", level: 2 }
  }
  if (raw === "tertiary") {
    return { label: "Tertiary", icon: "crown", level: 3 }
  }

  return { label: "Unmapped", icon: "spark", level: null as number | null }
}

export function getTaxonColor(species: Species): string {
  const palette: Record<string, string> = {
    Plantae: "#8C9A5B",
    Mammalia: "#B08968",
    Aves: "#C9A66B",
    Reptilia: "#6C7B52",
    Amphibia: "#6D8C7A",
    Insecta: "#B76E3A",
    Arachnida: "#7C5B4D",
    Actinopterygii: "#5D7B8C",
    Mollusca: "#8C7B6D",
    Animalia: "#9B8061",
  }

  return palette[species.taxon_class] || "#8B7355"
}

export function getFieldSection(species: Species): string {
  const tier = getTrophicTier(species)
  if (tier.level === 0) return "Producers"
  if (tier.level === 1 || species.taxon_class === "Insecta" || species.taxon_class === "Arachnida") {
    return "Foragers"
  }
  return "Hunters"
}

export function getSpeciesClues(species: Species): SpeciesClue[] {
  const tier = getTrophicTier(species)
  const clues: SpeciesClue[] = []

  clues.push({ icon: tier.icon, label: tier.label })

  if (species.taxon_class) {
    clues.push({ icon: "ring", label: species.taxon_class })
  }

  if (species.community) {
    clues.push({ icon: "web", label: `Field circle ${species.community}` })
  }

  if (AQUATIC_CLASSES.has(species.taxon_class)) {
    clues.push({ icon: "wave", label: "Water-linked" })
  }

  return clues
}

export function scoreSpeciesPair(anchor: Species, candidate: Species): PairSuggestion | null {
  if (anchor.scientific_name === candidate.scientific_name) return null

  let score = 0
  const reasons: string[] = []
  const anchorTier = getTrophicTier(anchor)
  const candidateTier = getTrophicTier(candidate)

  if (anchor.community && candidate.community && anchor.community === candidate.community) {
    score += 3
    reasons.push("same field circle")
  }

  if (anchorTier.level !== null && candidateTier.level !== null) {
    const gap = Math.abs(anchorTier.level - candidateTier.level)
    if (gap === 1) {
      score += 3
      reasons.push("neighboring food-chain tiers")
    } else if (gap === 0 && anchorTier.level !== 0) {
      score += 1
      reasons.push("same feeding band")
    }
  }

  const involvesPlant =
    anchor.taxon_kingdom === "Plantae" || candidate.taxon_kingdom === "Plantae"

  if (involvesPlant && anchor.scientific_name !== candidate.scientific_name) {
    score += 2
    reasons.push("one specimen is a likely food source")
  }

  if (AQUATIC_CLASSES.has(anchor.taxon_class) && AQUATIC_CLASSES.has(candidate.taxon_class)) {
    score += 1
    reasons.push("shared water habitat")
  }

  if (
    anchor.taxon_class &&
    candidate.taxon_class &&
    anchor.taxon_class === candidate.taxon_class &&
    anchor.taxon_class !== "Plantae"
  ) {
    score += 1
    reasons.push("similar body plan")
  }

  if (score <= 0) return null

  return { species: candidate, score, reasons }
}
