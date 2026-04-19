import Anthropic from "@anthropic-ai/sdk"

// Tar en URL, hämtar HTML, skickar till Claude för extraktion,
// returnerar strukturerad receptdata.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { url, ingredientsList } = req.body

  if (!url) {
    return res.status(400).json({ error: "Saknar 'url' i request body" })
  }

  if (!ingredientsList || !Array.isArray(ingredientsList)) {
    return res.status(400).json({ error: "Saknar 'ingredientsList'" })
  }

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

Regler för ingredienserna:
- Använd ENDAST namn från denna lista (lowercase): ${ingredientNames}
- Om en ingrediens i receptet inte finns i listan, hoppa över den
- Matcha intelligent: "hackad vitlök" = "vitlök", "ekologiska ägg" = "ägg"
- Enheter: använd g, kg, dl, l, ml, msk, tsk, krm, st

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