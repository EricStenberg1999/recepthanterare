import { useState, useEffect } from "react"
import { supabase } from "../supabase"

// Akinator-stil dialog där AI ställer frågor och slutligen ger 3 receptförslag.
// Props:
//   session — användarens session
//   onClose — kallas när användaren stänger Akinator-vyn
//   onSaved — kallas när ett förslag sparats som recept (så parent kan refresha)
function Akinator({ session, onClose, onSaved }) {
  const [allIngredients, setAllIngredients] = useState([])
  const [history, setHistory] = useState([]) // [{question, answer, options}]
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [currentOptions, setCurrentOptions] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [savedIds, setSavedIds] = useState(new Set())

  useEffect(() => {
    fetchIngredientsAndStart()
  }, [])

  // Hämta master-listan + skicka första anropet (tom historik) för att få fråga 1
  async function fetchIngredientsAndStart() {
    const { data, error: ingError } = await supabase
      .from("ingredients")
      .select("id, name, canonical_unit")

    if (!ingError) setAllIngredients(data)

    await fetchNext([])
  }

  // Kallar backend med nuvarande historik, hanterar svar (fråga eller förslag)
  async function fetchNext(historyForRequest) {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/akinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyForRequest,
          userId: session.user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Något gick fel")
        setLoading(false)
        return
      }

      if (data.type === "question") {
        setCurrentQuestion(data.question)
        setCurrentOptions(data.options || [])
        setSuggestions([])
      } else if (data.type === "ready") {
        setCurrentQuestion(null)
        setCurrentOptions([])
        setSuggestions(data.suggestions || [])
      } else {
        setError("Oväntat svar från AI")
      }
    } catch (err) {
      setError("Oväntat fel: " + err.message)
    }

    setLoading(false)
  }

  // Användaren har valt ett alternativ — lägg till i historiken och fråga vidare
  function handleAnswer(answer) {
    const newHistory = [
      ...history,
      { question: currentQuestion, answer },
    ]
    setHistory(newHistory)
    fetchNext(newHistory)
  }

  // Spara ett förslag som riktigt recept
  async function saveSuggestionAsRecipe(suggestion, index) {
    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .insert([
          {
            name: suggestion.name,
            description: suggestion.description || "",
            instructions: suggestion.instructions || "",
            source: "ai-akinator",
            user_id: session.user.id,
            is_shared: false,
            base_servings: suggestion.base_servings || 4,
          },
        ])
        .select()

      if (recipeError) {
        alert("Kunde inte spara recept: " + recipeError.message)
        return
      }

      const recipeId = recipeData[0].id

      const rows = []
      for (const ing of suggestion.ingredients) {
        const matched = allIngredients.find(
          i => i.name.toLowerCase() === ing.name.toLowerCase()
        )
        if (matched && ing.amount) {
          rows.push({
            recipe_id: recipeId,
            ingredient_id: matched.id,
            amount: ing.amount,
            input_unit: ing.unit || matched.canonical_unit,
          })
        }
      }

      if (rows.length > 0) {
        const { error: ingError } = await supabase
          .from("recipe_ingredients")
          .insert(rows)

        if (ingError) {
          alert("Recept sparat men ingredienser fel: " + ingError.message)
          return
        }
      }

      setSavedIds(new Set([...savedIds, index]))
      if (onSaved) onSaved()
    } catch (err) {
      alert("Oväntat fel vid sparning: " + err.message)
    }
  }

  // Restart Akinator
  function restart() {
    setHistory([])
    setSuggestions([])
    setSavedIds(new Set())
    fetchNext([])
  }

  return (
    <div>
      <button
        onClick={onClose}
        style={{
          marginBottom: "15px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#4CAF50",
          fontSize: "16px",
        }}
      >
        ← Tillbaka
      </button>

      <h2 style={{ marginBottom: "20px" }}>🧞 Vägled mig</h2>

      {/* Historik (tidigare frågor + svar) */}
      {history.length > 0 && !loading && (
        <div className="card" style={{ background: "#f9f9f9" }}>
          <h4 style={{ marginBottom: "10px", fontSize: "13px", color: "#666" }}>
            Dina svar hittills:
          </h4>
          {history.map((h, i) => (
            <div
              key={i}
              style={{ fontSize: "13px", padding: "4px 0", color: "#444" }}
            >
              <strong>{h.question}</strong> → {h.answer}
            </div>
          ))}
        </div>
      )}

      {/* Fel */}
      {error && (
        <div
          className="card"
          style={{ background: "#fee", border: "1px solid #f88" }}
        >
          <p style={{ color: "#d32f2f", margin: 0 }}>{error}</p>
          <button onClick={restart} style={{ marginTop: "10px" }}>
            Börja om
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card">
          <p style={{ color: "#666" }}>
            {history.length === 0
              ? "Tänker..."
              : suggestions.length === 0
              ? "Funderar på nästa fråga..."
              : "Laddar..."}
          </p>
        </div>
      )}

      {/* Aktuell fråga */}
      {!loading && currentQuestion && (
        <div className="card">
          <h3 style={{ marginBottom: "15px" }}>
            Fråga {history.length + 1}: {currentQuestion}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {currentOptions.map((option, i) => (
              <button
                key={i}
                className="primary"
                onClick={() => handleAnswer(option)}
                style={{
                  padding: "12px",
                  textAlign: "left",
                  fontSize: "15px",
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Förslag */}
      {!loading && suggestions.length > 0 && (
        <>
          <div className="card" style={{ background: "#e8f5e9" }}>
            <h3 style={{ marginBottom: "5px" }}>
              ✨ Ditt perfekta recept:
            </h3>
            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
              Baserat på dina {history.length} svar
            </p>
          </div>

          {suggestions.map((suggestion, index) => (
            <div key={index} className="card">
              <h3 style={{ marginBottom: "8px" }}>{suggestion.name}</h3>
              {suggestion.description && (
                <p style={{ color: "#666", marginBottom: "12px" }}>
                  {suggestion.description}
                </p>
              )}

              <h4 style={{ marginBottom: "8px", fontSize: "14px" }}>
                Ingredienser ({suggestion.base_servings || 4} portioner):
              </h4>
              {suggestion.ingredients?.map((ing, i) => (
                <div key={i} style={{ fontSize: "14px", padding: "3px 0" }}>
                  <span style={{ textTransform: "capitalize" }}>{ing.name}</span>
                  {ing.amount && ` – ${ing.amount} ${ing.unit}`}
                </div>
              ))}

              {suggestion.instructions && (
                <>
                  <h4 style={{ margin: "15px 0 8px", fontSize: "14px" }}>
                    Instruktioner:
                  </h4>
                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: "1.6",
                      whiteSpace: "pre-wrap",
                      color: "#444",
                    }}
                  >
                    {suggestion.instructions}
                  </p>
                </>
              )}

              <button
                className="primary"
                onClick={() => saveSuggestionAsRecipe(suggestion, index)}
                disabled={savedIds.has(index)}
                style={{ width: "100%", marginTop: "15px" }}
              >
                {savedIds.has(index)
                  ? "✓ Sparat som recept"
                  : "💾 Spara som recept"}
              </button>
            </div>
          ))}

          <button onClick={restart} style={{ width: "100%", marginTop: "10px" }}>
            🔄 Börja om
          </button>
        </>
      )}
    </div>
  )
}

export default Akinator