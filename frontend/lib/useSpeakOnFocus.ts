"use client"

import { useEffect } from "react"

const SPEAK_KEY = "weew-speak"

export function getSpeakEnabled(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SPEAK_KEY) === "1"
}

export function setSpeakEnabled(val: boolean) {
  if (typeof window === "undefined") return
  localStorage.setItem(SPEAK_KEY, val ? "1" : "0")
  if (!val) window.speechSynthesis?.cancel()
}

export function useSpeakOnFocus(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      const text = el.getAttribute("aria-label") || el.textContent?.trim() || ""
      if (!text) return
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    }
    document.addEventListener("focusin", handler)
    return () => {
      document.removeEventListener("focusin", handler)
      window.speechSynthesis?.cancel()
    }
  }, [enabled])
}
