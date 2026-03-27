import { useState, useEffect } from "react"
import { supabase } from "../supabase"

function Suggestions() {
  const [fridgeItems, setFridgeItems] = useState([])
  const [suggestions, setSuggestions] = useState("")
  const [loading, setLoading] = useState(false)
  const [fridgeLoading, setFridgeLoading] = useState(true)

  // Hämta kylinnehåll när komponenten laddas
  useEffect(() => {
    fetchFridge()
  }, [])

  async function fetchFridge() {
    const { data, error } = await supabase
      .from("fridge")
      .select("*")
      .order("ingredient_name")

    if (error) {
      console.error("Fel vid hämtning:", error)
    } else {
      setFridgeItems(data)
    }
    setFridgeLoading(false)
  }

  // Formatera kylinnehållet till en läsbar textsträng för AI:n
  function formatFridgeForAI() {
    return fridgeItems
      .map(item => `${item.ingredient_name}${item.amount ? ` (${item.amount} ${item.unit})` : ""}`)
      .join(", ")
  }

  async function getSuggestions() {
    if (fridgeItems.length === 0) return
    setLoading(true)
    setSuggestions("")

    // Skicka kylinnehållet till Claude och be om receptförslag
    const prompt = `Jag har följande ingredienser hemma: ${formatFridgeForAI()}.
    
Ge mig 3 receptförslag på vad jag kan laga med dessa ingredienser. 
För varje förslag, ange:
- Receptnamn
- Vilka av mina ingredienser som används
- Eventuella extra ingredienser som behövs (håll det minimalt)
- Kort beskrivning av rätten

Svara på svenska.`

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      })

      const data = await response.json()
      setSuggestions(data.content[0].text)
    } catch (error) {
      setSuggestions("Något gick fel, försök igen.")
      console.error("API-fel:", error)
    }

    setLoading(false)
  }

  if (fridgeLoading) return <p>Laddar...</p>

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>✨ Receptförslag</h2>

      {/* Visa vad som finns i kylen */}
      <div className="card">
        <h3 style={{ marginBottom: "10px" }}>Baserat på din kyl</h3>
        {fridgeItems.length === 0 ? (
          <p style={{ color: "#999" }}>Lägg till ingredienser i kylen först!</p>
        ) : (
          <>
            <p style={{ color: "#666", marginBottom: "15px" }}>
              {formatFridgeForAI()}
            </p>
            <button className="primary" onClick={getSuggestions} disabled={loading}>
              {loading ? "Hämtar förslag..." : "✨ Ge mig förslag!"}
            </button>
          </>
        )}
      </div>

      {/* Visa AI-förslag */}
      {suggestions && (
        <div className="card">
          <h3 style={{ marginBottom: "15px" }}>Förslag från Claude</h3>
          <p style={{ lineHeight: "1.8", whiteSpace: "pre-wrap" }}>{suggestions}</p>
        </div>
      )}

      {/* Info om att API-nyckel saknas */}
      {!import.meta.env.VITE_ANTHROPIC_API_KEY && (
        <div className="card" style={{ background: "#fff3cd", border: "1px solid #ffc107" }}>
          <p>⚠️ Anthropic API-nyckel saknas. Lägg till <strong>VITE_ANTHROPIC_API_KEY</strong> i din .env fil för att aktivera AI-förslag.</p>
        </div>
      )}
    </div>
  )
}

export default Suggestions