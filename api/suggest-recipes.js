import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

// Rate limiting (samma struktur som import-recipe)
const GLOBAL_LIMIT_PER_HOUR = 30
const USER_LIMIT_PER_DAY = 10
const ENDPOINT_NAME = "suggest-recipes"

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

  if (globalError) {
    console.error("Rate limit check error (global):", globalError)
    return null
  }

  if (globalCount >= GLOBAL_LIMIT_PER_HOUR) {
    return `Global rate limit nådd (${GLOBAL_LIMIT_PER_HOUR} förslag/timme). Försök igen om en stund.`
  }

  const { count: userCount, error: userError } = await supabaseAdmin
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", ENDPOINT_NAME)
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo)

  if (userError) {
    console.error("Rate limit check error (user):", userError)
    return null
  }

  if (userCount >= USER_LIMIT_PER_DAY) {
    return `Du har använt din dagliga gräns (${USER_LIMIT_PER_DAY} förslag/dag). Försök igen imorgon.`
  }

  return null
}

// Föreslår 3 recept som ENBART använder ingredienser från matförrådet
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { fridgeItems, userId, mode, maxExtra } = req.body

  if (!fridgeItems || !Array.isArray(fridgeItems)) {
    return res.status(400).json({ error: "Saknar 'fridgeItems'" })
  }

  if (!userId) {
    return res.status(400).json({ error: "Saknar 'userId'" })
  }

  if (fridgeItems.length === 0) {
    return res.status(400).json({
      error: "Matförrådet är tomt — lägg till några varor först!",
    })
  }

  // mode: "strict" (default) eller "creative"
  const isCreative = mode === "creative"
  // Hur många extra ingredienser får läggas till per recept (gäller bara creative)
  const maxExtraIngredients = Math.max(0, Math.min(10, parseInt(maxExtra) || 3))

  // Rate limit check
  const rateLimitError = await checkRateLimit(userId)
  if (rateLimitError) {
    return res.status(429).json({ error: rateLimitError })
  }

  // Logga användning innan vi gör anropet
  await supabaseAdmin.from("api_usage").insert([
    {
      user_id: userId,
      endpoint: ENDPOINT_NAME,
    },
  ])

  try {
    // Bygg en human-readable lista av matförrådet för prompten
    const fridgeList = fridgeItems
      .map(item => `- ${item.name} (${item.amount} ${item.unit})`)
      .join("\n")

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: isCreative
            ? `Du är en kreativ kock som föreslår recept baserat på vad användaren har hemma, men du får också föreslå extra ingredienser som behöver köpas.

VIKTIGT: Svara ENDAST med giltig JSON, ingen förklarande text runt omkring.

Användaren har följande ingredienser i sitt matförråd:
${fridgeList}

Föreslå exakt 3 recept som anv\u00e4ndaren kan laga. Du får inkludera UPP TILL ${maxExtraIngredients} extra ingredienser per recept som inte finns i förrådet — dessa markeras tydligt så användaren kan handla dem.

Format:
{
  "suggestions": [
    {
      "name": "Receptets namn",
      "description": "Kort beskrivning (en mening)",
      "base_servings": 4,
      "ingredients": [
        {"name": "ingrediensens namn", "amount": 200, "unit": "g", "missing": false}
      ],
      "instructions": "Steg 1...\\nSteg 2...\\nSteg 3..."
    }
  ]
}

Regler:
- Använd så MÅNGA av matförrådets ingredienser som möjligt — det är poängen!
- Markera "missing": true för ingredienser som INTE finns i matförrådet (max ${maxExtraIngredients} per recept)
- Markera "missing": false för ingredienser som finns i matförrådet
- För ingredienser från förrådet: namn ska EXAKT matcha matförrådslistan ovan
- För missing-ingredienser: använd vanliga ingrediensnamn (t.ex. "köttfärs", "lök", "vitlök")
- Mängderna från förrådet får INTE överstiga vad användaren har
- Salt, peppar och vatten antas finnas (markera som missing: false)
- Enheter: g, kg, dl, l, ml, msk, tsk, krm, st
- Variera typen av rätter om möjligt
- Instruktionerna ska vara tydliga, separerade med radbrytningar (\\n)
- Portionerna ska vara mellan 1 och 6`
            : `Du är en kreativ kock som föreslår recept baserat på vad användaren har hemma.

VIKTIGT: Svara ENDAST med giltig JSON, ingen förklarande text runt omkring.

Användaren har följande ingredienser i sitt matförråd:
${fridgeList}

Föreslå exakt 3 recept som användaren kan laga MED ENBART dessa ingredienser. Använd inga andra ingredienser. Salt, peppar och vatten antas finnas.

Format:
{
  "suggestions": [
    {
      "name": "Receptets namn",
      "description": "Kort beskrivning (en mening)",
      "base_servings": 4,
      "ingredients": [
        {"name": "ingrediensens exakta namn från listan ovan", "amount": 200, "unit": "g", "missing": false}
      ],
      "instructions": "Steg 1...\\nSteg 2...\\nSteg 3..."
    }
  ]
}

Regler:
- Använd ENDAST namn som finns EXAKT i matförrådslistan ovan (case-sensitive matchning på lowercase)
- Mängderna i förslagen får INTE överstiga vad användaren har i förrådet
- Sätt "missing": false på alla ingredienser (inga ska saknas i strikt läge)
- Enheter: använd samma enheter som i förrådet om möjligt, annars: g, kg, dl, l, ml, msk, tsk, krm, st
- Föreslå riktiga recept som faktiskt går att laga, inte påhittade kombinationer
- Variera typen av rätter (förrätter, huvudrätter, efterrätter) om möjligt
- Instruktionerna ska vara tydliga och separerade med radbrytningar (\\n)
- Portionerna ska vara mellan 1 och 6`,
        },
      ],
    })

    const responseText = message.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("")

    let suggestions
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("Ingen JSON hittad i svaret")
      const parsed = JSON.parse(jsonMatch[0])
      suggestions = parsed.suggestions
    } catch (parseError) {
      return res.status(500).json({
        error: "Kunde inte parsa förslagen",
        rawResponse: responseText,
      })
    }

    res.status(200).json({
      suggestions,
      usage: message.usage,
    })
  } catch (error) {
    console.error("Suggest-fel:", error)
    res.status(500).json({ error: error.message })
  }
}