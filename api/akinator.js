import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const GLOBAL_LIMIT_PER_HOUR = 30
const USER_LIMIT_PER_DAY = 10
const ENDPOINT_NAME = "akinator"
const MAX_QUESTIONS = 8

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkRateLimit(userId) {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { count: globalCount, error: globalError } = await supabaseAdmin
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", ENDPOINT_NAME)
    .gte("created_at", oneHourAgo)

  if (globalError) return null
  if (globalCount >= GLOBAL_LIMIT_PER_HOUR) {
    return `Global rate limit nådd (${GLOBAL_LIMIT_PER_HOUR} förfrågningar/timme).`
  }

  const { count: userCount, error: userError } = await supabaseAdmin
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", ENDPOINT_NAME)
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo)

  if (userError) return null
  if (userCount >= USER_LIMIT_PER_DAY) {
    return `Du har använt din dagliga gräns (${USER_LIMIT_PER_DAY}/dag).`
  }

  return null
}

// Akinator-stil dialog för att gissa vad användaren är sugen på
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { history, userId } = req.body

  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "Saknar 'history' (array)" })
  }

  if (!userId) {
    return res.status(400).json({ error: "Saknar 'userId'" })
  }

  // Rate limiting kollas bara för det FÖRSTA anropet i ett samtal
  // (history är tom när samtalet startar)
  if (history.length === 0) {
    const rateLimitError = await checkRateLimit(userId)
    if (rateLimitError) {
      return res.status(429).json({ error: rateLimitError })
    }
    await supabaseAdmin.from("api_usage").insert([
      { user_id: userId, endpoint: ENDPOINT_NAME },
    ])
  }

  try {
    // Bygg en human-readable historik för Claude
    const historyText = history
      .map((h, i) => `Fråga ${i + 1}: ${h.question}\nSvar: ${h.answer}`)
      .join("\n\n")

    const questionsAsked = history.length
    const isLastQuestion = questionsAsked >= MAX_QUESTIONS - 1

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Du är en Akinator-stil AI-kock som hjälper en användare hitta vad de ska laga genom att ställa frågor.

VIKTIGT: Svara ENDAST med giltig JSON, ingen förklarande text runt omkring.

${
  questionsAsked === 0
    ? "Detta är första frågan. Börja brett och naturligt, t.ex. om matlust, tid, eller stil."
    : `Tidigare frågor och svar:\n\n${historyText}\n\nDu har ställt ${questionsAsked} frågor av max ${MAX_QUESTIONS}.`
}

Du har TVÅ alternativ:

ALTERNATIV A — Ställ en till fråga (om du behöver mer info):
{
  "type": "question",
  "question": "Frågetexten på svenska",
  "options": ["Alternativ 1", "Alternativ 2", "Alternativ 3", "Alternativ 4"]
}

Regler för frågor:
- 2-4 alternativ per fråga
- Korta svar (max 3 ord per alternativ)
- Börja BRETT — fråga om matlust, tid, måltidstyp, smaker, energinivå, season, sällskap, etc.
- Undvik LEDANDE frågor som direkt pekar mot en specifik ingrediens eller rätt
- Undvik att hoppa direkt från en kategori till en specifik produkt (t.ex. "kött" → "köttfärs" är för snabbt)
- Variera typen av frågor: ibland ja/nej, ibland multiple choice, ibland skalor (mild/medium/stark)
- Frågorna ska gradvis isolera vilken typ av rätt användaren vill ha
- Avsluta med 'type: "ready"' så snart du har nog info — det MÅSTE ske senast efter ${MAX_QUESTIONS} frågor

ALTERNATIV B — Ge ETT receptförslag (när du är säker):
{
  "type": "ready",
  "suggestions": [
    {
      "name": "Receptets namn",
      "description": "Kort beskrivning som motiverar varför detta passar baserat på svaren",
      "base_servings": 4,
      "ingredients": [
        {"name": "ingrediens", "amount": 200, "unit": "g"}
      ],
      "instructions": "Steg 1...\\nSteg 2...\\nSteg 3..."
    }
  ]
}

Regler för förslag:
- Exakt 1 förslag (inte 3) — det här ska vara ETT skarpt val baserat på svaren
- Beskrivningen ska tydligt motivera varför detta passar användarens svar
- Använd vanliga ingrediensnamn
- Enheter: g, kg, dl, l, ml, msk, tsk, krm, st
- Portionerna mellan 1 och 6
- Instruktionerna ska vara tydliga, separerade med radbrytningar (\\n)

${isLastQuestion ? "OBSERVERA: Du har nu nått maxgränsen för frågor — du MÅSTE returnera type: 'ready' med 1 förslag." : ""}

Välj nu antingen "question" eller "ready" och svara med EXAKT JSON enligt formaten ovan.`,
        },
      ],
    })

    const responseText = message.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("")

    let parsed
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("Ingen JSON i svaret")
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      return res.status(500).json({
        error: "Kunde inte parsa svaret",
        rawResponse: responseText,
      })
    }

    res.status(200).json({
      ...parsed,
      usage: message.usage,
      questionsAsked,
    })
  } catch (error) {
    console.error("Akinator-fel:", error)
    res.status(500).json({ error: error.message })
  }
}