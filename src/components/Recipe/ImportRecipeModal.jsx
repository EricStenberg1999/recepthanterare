import { useState } from "react"
import { supabase } from "../../supabase"

// Importera recept från URL via AI
// Props:
//   session — användarens session
//   onDone — callback när importen är klar (stäng + refresh)
//   onCancel — avbryt
function ImportRecipeModal({ session, onDone, onCancel }) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleImport() {
    if (!url.trim()) {
      setError("Ange en URL")
      return
    }

    setLoading(true)
    setError("")

    try {
      // 1. Hämta alla ingredienser så vi kan skicka dem till AI:n för matchning
      const { data: ingredients, error: ingError } = await supabase
        .from("ingredients")
        .select("id, name, canonical_unit")

      if (ingError) {
        setError("Kunde inte hämta ingredienser: " + ingError.message)
        setLoading(false)
        return
      }

      // 2. Anropa backend för att importera recept
      const response = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          ingredientsList: ingredients,
          userId: session.user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Något gick fel")
        setLoading(false)
        return
      }

      const { recipe } = data

      // 3. Skapa receptet i databasen
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .insert([
          {
            name: recipe.name,
            description: recipe.description || "",
            instructions: recipe.instructions || "",
            source: "url",
            user_id: session.user.id,
            is_shared: false,
            base_servings: recipe.base_servings || 4,
          },
        ])
        .select()

      if (recipeError) {
        setError("Kunde inte spara recept: " + recipeError.message)
        setLoading(false)
        return
      }

      const recipeId = recipeData[0].id

      // 4. Matcha AI:ns ingrediensnamn mot master-listan och spara
      const rows = []
      for (const ing of recipe.ingredients) {
        const matched = ingredients.find(
          i => i.name.toLowerCase() === ing.name.toLowerCase()
        )
        if (matched) {
          rows.push({
            recipe_id: recipeId,
            ingredient_id: matched.id,
            // Tillåt null-amount för "smör till formen" etc.
            amount: ing.amount !== null && ing.amount !== undefined ? ing.amount : null,
            input_unit: ing.unit || matched.canonical_unit,
          })
        }
      }

      if (rows.length > 0) {
        const { error: ingSaveError } = await supabase
          .from("recipe_ingredients")
          .insert(rows)

        if (ingSaveError) {
          setError("Recept sparat men ingredienser fel: " + ingSaveError.message)
          setLoading(false)
          return
        }
      }

      alert(
        `Recept importerat: "${recipe.name}" med ${rows.length} ingredienser!`
      )
      onDone()
    } catch (err) {
      setError("Oväntat fel: " + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: "15px" }}>🔗 Importera recept från URL</h3>

      <input
        type="text"
        placeholder="https://www.ica.se/recept/..."
        value={url}
        onChange={e => setUrl(e.target.value)}
        disabled={loading}
        autoFocus
      />

      {error && (
        <p style={{ color: "#d32f2f", marginBottom: "10px" }}>{error}</p>
      )}

      {loading && (
        <p style={{ color: "#666", marginBottom: "10px" }}>
          Hämtar och analyserar receptet... Detta kan ta 10-20 sekunder.
        </p>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onCancel} disabled={loading} style={{ flex: 1 }}>
          Avbryt
        </button>
        <button
          className="primary"
          onClick={handleImport}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? "Importerar..." : "Importera"}
        </button>
      </div>
    </div>
  )
}

export default ImportRecipeModal