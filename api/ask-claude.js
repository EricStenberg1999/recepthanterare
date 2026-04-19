import Anthropic from "@anthropic-ai/sdk"

// Test-endpoint: tar en prompt, skickar till Claude, returnerar svaret
export default async function handler(req, res) {
  // Bara POST tillåtet
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { prompt } = req.body

  if (!prompt) {
    return res.status(400).json({ error: "Saknar 'prompt' i request body" })
  }

  try {
  console.log("API KEY PRESENT:", !!process.env.ANTHROPIC_API_KEY)
  console.log("API KEY LENGTH:", process.env.ANTHROPIC_API_KEY?.length)
  console.log("API KEY STARTS WITH:", process.env.ANTHROPIC_API_KEY?.substring(0, 10))
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  })

  const responseText = message.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("")

  res.status(200).json({
    response: responseText,
    usage: message.usage,
  })
} catch (error) {
    console.error("Anthropic API-fel:", error)
    res.status(500).json({ error: error.message })
  }
}