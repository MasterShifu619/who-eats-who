import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const { animal, action, browser, ip } = await req.json()
  const timestamp = new Date().toISOString()
  console.log(`${timestamp} | ${ip} | ${animal} | ${action} | ${browser}`)
  return new Response("ok")
}