import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

// Rate limiting
const GLOBAL_LIMIT_PER_HOUR = 30
const USER_LIMIT_PER_DAY = 10

// Supabase-klient med service role — har obegränsad access (förbi RLS).
// Används ENDAST i backend. Får aldrig hamna i frontend.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Kolla rate limits. Returnerar null om ok, annars felmeddelande-sträng.
async function checkRateLimit(userId) {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Global räkning senaste timmen
  const { count: globalCount, error: globalError } = await supabaseAdmin
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", "import-recipe")
    .gte("created_at", oneHourAgo)

  if (globalError) {
    console.error("Rate limit check error (global):", globalError)
    return null // Fail open om rate limit-tabellen strular — hellre det än att blocka alla
  }

  if (globalCount >= GLOBAL_LIMIT_PER_HOUR) {
    return `Global rate limit nådd (${GLOBAL_LIMIT_PER_HOUR} imports/timme). Försök igen om en stund.`
  }

  // Per-user räkning senaste dagen
  const { count: userCount, error: userError } = await supabaseAdmin
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", "import-recipe")
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo)

  if (userError) {
    console.error("Rate limit check error (user):", userError)
    return null
  }

  if (userCount >= USER_LIMIT_PER_DAY) {
    return `Du har använt din dagliga gräns (${USER_LIMIT_PER_DAY} imports/dag). Försök igen imorgon.`
  }

  return null
}

// Tar en URL, hämtar HTML, skickar till Claude för extraktion,
// returnerar strukturerad receptdata.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { url, ingredientsList, userId } = req.body

  if (!url) {
    return res.status(400).json({ error: "Saknar 'url' i request body" })
  }

  if (!ingredientsList || !Array.isArray(ingredientsList)) {
    return res.status(400).json({ error: "Saknar 'ingredientsList'" })
  }

  if (!userId) {
    return res.status(400).json({ error: "Saknar 'userId'" })
  }

  // Rate limit check
  const rateLimitError = await checkRateLimit(userId)
  if (rateLimitError) {
    return res.status(429).json({ error: rateLimitError })
  }

  // Logga användning innan vi gör anropet (så vi räknar även misslyckade försök)
  await supabaseAdmin.from("api_usage").insert([
    {
      user_id: userId,
      endpoint: "import-recipe",
    },
  ])

  try {
    // 1. Hämta HTML från receptsidan
    const pageResponse = await fetch(url, {
      headers: {
        // Simulera en webbläsare så vi inte blockeras
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!pageResponse.ok) {
      return res
        .status(400)
        .json({ error: `Kunde inte hämta URL: ${pageResponse.status}` })
    }

    const html = await pageResponse.text()

    // 2. Trimma HTML så vi inte skickar onödigt mycket till Claude
    // Vi tar bort script, style och navigationselement
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      // Trunkera för säkerhets skull
      .substring(0, 50000)

    // 3. Lista över tillgängliga ingredienser för Claude att matcha mot
    const ingredientNames = ingredientsList.map(i => i.name).join(", ")

    // 4. Skicka till Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Du är en recepttextextraktör. Analysera följande HTML från en receptsida och returnera ett JSON-objekt.

VIKTIGT: Svara ENDAST med giltig JSON, ingen förklarande text runt omkring.

Format:
{
  "name": "Receptets namn",
  "description": "Kort beskrivning (en mening)",
  "instructions": "Alla steg, separerade med radbrytningar",
  "base_servings": 4,
  "ingredients": [
    {"name": "mjölk", "amount": 3, "unit": "dl"},
    {"name": "ägg", "amount": 2, "unit": "st"}
  ]
}

Regler för PORTIONER (base_servings):
- Om receptet explicit säger "4 portioner" eller "för 4 personer" → använd det numret
- Om receptet bara säger "8 bitar", "12 muffins", "20 bullar" — gissa hur många PORTIONER det motsvarar baserat på rimlig matmängd (t.ex. 8 kladdkakebitar ≈ 4 portioner, 12 muffins ≈ 4 portioner, 20 bullar ≈ 6 portioner)
- Om inget anges, gissa utifrån ingrediensmängder (500 g köttfärs ≈ 4 portioner)
- Alltid ett heltal mellan 1 och 12

Regler för INGREDIENSER:
- Använd ENDAST namn från denna lista (lowercase): ${ingredientNames}
- Matcha intelligent och använd närmaste rimliga match:
  - "hackad vitlök" = "vitlök"
  - "ekologiska ägg" = "ägg"
  - "vispgrädde 40%" = "vispgrädde" (om den finns) annars "grädde"
  - "färska bär" = någon av blåbär/hallon/jordgubbar om det finns separat
  - "matlagningsgrädde" = "matlagningsgrädde" om den finns, annars "grädde"
- Om absolut ingen rimlig matchning finns — hoppa över ingrediensen
- Returnera ALDRIG samma ingrediens två gånger — om samma ingrediens används flera gånger i receptet, summera till EN rad

Regler för ENHETER (mycket viktigt):
- Använd ALLTID samma enhet som receptet anger — konvertera INTE
- Om receptet säger "1.5 dl vetemjöl" → unit: "dl", amount: 1.5 (INTE g!)
- Om receptet säger "1 krm salt" → unit: "krm", amount: 1
- Om receptet säger "2 msk olja" → unit: "msk", amount: 2
- Tillåtna enheter: g, kg, dl, l, ml, msk, tsk, krm, st

Regler för ingredienser UTAN mängd (VIKTIGT — hoppa ALDRIG över dessa):
- Om receptet säger "smör till formen", "olja till stekning", "salt efter smak", "ströbröd till formen" — inkludera dem ALLTID
- Sätt amount: null och unit: null i sådana fall
- Dessa räknas som "garnish/prep-ingredienser" och behövs för att användaren ska veta att de krävs
- Exempel: {"name": "smör", "amount": null, "unit": null}
- Exempel: {"name": "ströbröd", "amount": null, "unit": null}

Receptsidans HTML:
${cleanedHtml}`,
        },
      ],
    })

    // 5. Plocka ut textsvaret
    const responseText = message.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("")

    // 6. Parsa JSON
    let recipe
    try {
      // Plocka ut JSON om Claude har lagt till text runt om
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error("Ingen JSON hittad i svaret")
      recipe = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      return res.status(500).json({
        error: "Kunde inte parsa receptet",
        rawResponse: responseText,
      })
    }

    res.status(200).json({
      recipe,
      usage: message.usage,
    })
  } catch (error) {
    console.error("Import-fel:", error)
    res.status(500).json({ error: error.message })
  }
}