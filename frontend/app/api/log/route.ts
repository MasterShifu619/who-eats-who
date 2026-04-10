import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const { animal, action } = await req.json()
  const timestamp = new Date().toISOString()
  console.log(`${timestamp} | ${animal} | ${action}`)
  return new Response("ok")
}