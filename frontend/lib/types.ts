export interface Species {
  scientific_name: string
  common_name: string
  taxon_class: string
  taxon_order: string
  taxon_family: string
  taxon_kingdom: string
  trophic_pos: string
  totaldegree: string
  pagerank: string
  betweenness: string
  community: string
  in_giant_foodweb: string
  thumbnail_url: string
}

export interface Relationship {
  predator_scientific: string
  prey_scientific: string
  image_url: string
  type_of_feeding: string
  observation_url: string
  observed_on: string
  place_state: string
  place_county: string
  prey_common_name: string
  prey_taxon_class: string
}

export type RelationshipDirection = "a_eats_b" | "b_eats_a" | "both" | "none"

export interface WhoEatsWhomResult {
  species_a: string
  species_b: string
  direction: RelationshipDirection
  relationship_a_eats_b: Relationship | null
  relationship_b_eats_a: Relationship | null
}

export interface NetworkNode {
  scientific_name: string
  common_name: string
  taxon_class: string
  thumbnail_url: string
  x?: number
  y?: number
}

export interface NetworkLink {
  predator_scientific: string
  prey_scientific: string
  type_of_feeding: string
  image_url: string
}

export interface DroppedAnimal {
  species: Species
  zoneId: "A" | "B"
}