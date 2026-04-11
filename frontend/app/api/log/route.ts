import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const { animal, action, browser, ip, state = 0, game = "unknown" } = await req.json()
  const timestamp = new Date().toISOString()
  console.log(`${timestamp} | ${game} | ${ip} | ${animal} | ${action} | ${state} | ${browser}`)
  return new Response("ok")
}