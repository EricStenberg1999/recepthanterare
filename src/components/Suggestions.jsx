import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import Akinator from "./Akinator"

function Suggestions({ session }) {
  const [fridgeItems, setFridgeItems] = useState([])
  const [allIngredients, setAllIngredients] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [fridgeLoading, setFridgeLoading] = useState(true)
  const [error, setError] = useState("")
  const [savedIds, setSavedIds] = useState(new Set())
  const [addedToList, setAddedToList] = useState(new Set())
  const [showAkinator, setShowAkinator] = useState(false)

  // Mode: "strict" eller "creative"
  const [mode, setMode] = useState("strict")
  const [maxExtra, setMaxExtra] = useState(3)

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    const [fridgeRes, ingredientsRes] = await Promise.all([
      supabase
        .from("fridge")
        .select(`
          id,
          amount,
          ingredients (
            id,
            name,
            canonical_unit
          )
        `)
        .order("id"),
      supabase
        .from("ingredients")
        .select("id, name, canonical_unit"),
    ])

    if (fridgeRes.error) {
      console.error("Fel vid hämtning av förråd:", fridgeRes.error)
    } else {
      setFridgeItems(fridgeRes.data)
    }

    if (ingredientsRes.error) {
      console.error("Fel vid hämtning av ingredienser:", ingredientsRes.error)
    } else {
      setAllIngredients(ingredientsRes.data)
    }

    setFridgeLoading(false)
  }

  async function getSuggestions() {
    if (fridgeItems.length === 0) return
    setLoading(true)
    setError("")
    setSuggestions([])
    setSavedIds(new Set())
    setAddedToList(new Set())

    const fridgePayload = fridgeItems.map(item => ({
      name: item.ingredients.name,
      amount: item.amount,
      unit: item.ingredients.canonical_unit,
    }))

    try {
      const response = await fetch("/api/suggest-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fridgeItems: fridgePayload,
          userId: session.user.id,
          mode,
          maxExtra,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Något gick fel")
        setLoading(false)
        return
      }

      setSuggestions(data.suggestions || [])
    } catch (err) {
      setError("Oväntat fel: " + err.message)
    }

    setLoading(false)
  }

  async function saveSuggestionAsRecipe(suggestion, index) {
    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .insert([
          {
            name: suggestion.name,
            description: suggestion.description || "",
            instructions: suggestion.instructions || "",
            source: "ai-suggestion",
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
    } catch (err) {
      alert("Oväntat fel vid sparning: " + err.message)
    }
  }

  // Lägg saknade ingredienser från ett förslag på inköpslistan
  async function addMissingToShoppingList(suggestion, index) {
    const missing = suggestion.ingredients.filter(i => i.missing)
    if (missing.length === 0) {
      alert("Inga saknade ingredienser i det här receptet!")
      return
    }

    const matchedRows = []
    const customRows = []

    for (const ing of missing) {
      const matched = allIngredients.find(
        i => i.name.toLowerCase() === ing.name.toLowerCase()
      )

      if (matched) {
        matchedRows.push({
          user_id: session.user.id,
          ingredient_id: matched.id,
          amount: ing.amount || null,
        })
      } else {
        customRows.push({
          user_id: session.user.id,
          custom_name: ing.name.toLowerCase(),
          amount: ing.amount || null,
          unit: ing.unit || "st",
        })
      }
    }

    if (matchedRows.length > 0) {
      const { error } = await supabase
        .from("shopping_list")
        .upsert(matchedRows, { onConflict: "user_id,ingredient_id" })

      if (error) {
        alert("Fel vid tillägg till listan: " + error.message)
        return
      }
    }

    if (customRows.length > 0) {
      const { error } = await supabase.from("shopping_list").insert(customRows)
      if (error) {
        alert("Fel vid tillägg av custom-varor: " + error.message)
        return
      }
    }

    setAddedToList(new Set([...addedToList, index]))
  }

  if (fridgeLoading) return <p>Laddar...</p>

  // Akinator-vyn — visas istället för normal Suggestions när aktiv
  if (showAkinator) {
    return (
      <Akinator
        session={session}
        onClose={() => setShowAkinator(false)}
        onSaved={() => {}}
      />
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>✨ Receptförslag</h2>

      <div className="card">
        <h3 style={{ marginBottom: "10px" }}>Baserat på ditt matförråd</h3>

        {fridgeItems.length === 0 ? (
          <p style={{ color: "#999" }}>
            Lägg till ingredienser i Mitt Matförråd först!
          </p>
        ) : (
          <>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "15px" }}>
              {fridgeItems.length} {fridgeItems.length === 1 ? "vara" : "varor"}{" "}
              i förrådet
            </p>

            {/* Toggle */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "15px",
                background: "#f0f0f0",
                padding: "4px",
                borderRadius: "8px",
              }}
            >
              <button
                onClick={() => setMode("strict")}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: mode === "strict" ? "#4CAF50" : "transparent",
                  color: mode === "strict" ? "white" : "#666",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: mode === "strict" ? "bold" : "normal",
                }}
              >
                🔒 Strikt
              </button>
              <button
                onClick={() => setMode("creative")}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: mode === "creative" ? "#4CAF50" : "transparent",
                  color: mode === "creative" ? "white" : "#666",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: mode === "creative" ? "bold" : "normal",
                }}
              >
                ✨ Kreativt
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#666", marginBottom: "15px" }}>
              {mode === "strict"
                ? "Endast recept du kan laga med det du redan har."
                : "Recept som kan inkludera extra ingredienser att handla."}
            </p>

            {mode === "creative" && (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    fontSize: "14px",
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Max extra ingredienser per recept: <strong>{maxExtra}</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxExtra}
                  onChange={e => setMaxExtra(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            <button
              className="primary"
              onClick={getSuggestions}
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "Hämtar förslag..." : "✨ Ge mig förslag!"}
            </button>
          </>
        )}
      </div>

      {/* Akinator-knapp */}
      <button
        className="primary"
        onClick={() => setShowAkinator(true)}
        style={{ width: "100%", marginBottom: "15px" }}
      >
        🧞 Vägled mig (AI ställer frågor)
      </button>

      {error && (
        <div
          className="card"
          style={{ background: "#fee", border: "1px solid #f88" }}
        >
          <p style={{ color: "#d32f2f", margin: 0 }}>{error}</p>
        </div>
      )}

      {suggestions.map((suggestion, index) => {
        const missingIngredients = (suggestion.ingredients || []).filter(
          i => i.missing
        )
        const hasMissing = missingIngredients.length > 0

        return (
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
              <div
                key={i}
                style={{
                  fontSize: "14px",
                  padding: "3px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {ing.missing && (
                  <span
                    style={{
                      fontSize: "11px",
                      background: "#ffebee",
                      color: "#c62828",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    BEHÖVS
                  </span>
                )}
                <span style={{ textTransform: "capitalize" }}>{ing.name}</span>
                {ing.amount && (
                  <span style={{ color: "#666" }}>
                    – {ing.amount} {ing.unit}
                  </span>
                )}
              </div>
            ))}

            {hasMissing && (
              <button
                onClick={() => addMissingToShoppingList(suggestion, index)}
                disabled={addedToList.has(index)}
                style={{ width: "100%", marginTop: "12px" }}
              >
                {addedToList.has(index)
                  ? "✓ Tillagda på inköpslistan"
                  : `🛒 Lägg ${missingIngredients.length} ${
                      missingIngredients.length === 1 ? "vara" : "varor"
                    } på inköpslistan`}
              </button>
            )}

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
              {savedIds.has(index) ? "✓ Sparat som recept" : "💾 Spara som recept"}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default Suggestions