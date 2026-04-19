import { useState } from "react"
import { supabase } from "../supabase"

// Detaljvy för ett enskilt recept med portionsskalning och "laga recept"-funktion
function RecipeDetail({
  recipe,
  isOwner,
  isFavorite,
  onBack,
  onEdit,
  onDelete,
  onToggleShare,
  onToggleFavorite,
  onCooked,
}) {
  // Default: visa receptet i dess bas-portionering
  // Användaren kan justera med +/– knappar
  const baseServings = recipe.base_servings || 4
  const [servings, setServings] = useState(baseServings)

  // Hjälpfunktion: skala en mängd baserat på valda vs. bas-portioner
  // Ex: bas 4, vald 6, ingrediens 200 g → 200 * 6/4 = 300 g
  function scaleAmount(amount) {
    const scaled = (parseFloat(amount) * servings) / baseServings
    // Avrunda till 1 decimal
    return Math.round(scaled * 10) / 10
  }

  // Hanterar "Laga recept"-knappen
  // 1. Hämtar förrådet
  // 2. Kollar att alla ingredienser finns i tillräcklig mängd (skalade efter portioner)
  // 3. Om nåt saknas: varna och avbryt
  // 4. Annars: bekräfta och dra ingredienserna
  async function handleCookRecipe() {
    // Hämta förrådet (RLS filtrerar per användare)
    const { data: fridgeItems, error: fetchError } = await supabase
      .from("fridge")
      .select("id, amount, ingredients ( id, name, canonical_unit )")

    if (fetchError) {
      alert("Kunde inte hämta matförrådet: " + fetchError.message)
      return
    }

    // Kolla varje receptingrediens mot förrådet
    const missing = []
    const toUpdate = [] // { fridgeId, newAmount } för varje rad vi ska uppdatera

    for (const ing of recipe.recipe_ingredients) {
      const needed = scaleAmount(ing.amount)
      const inFridge = fridgeItems.find(
        f => f.ingredients.id === ing.ingredients.id
      )
      const available = inFridge ? parseFloat(inFridge.amount) : 0

      if (available < needed) {
        missing.push({
          name: ing.ingredients.name,
          missing: Math.round((needed - available) * 10) / 10,
          unit: ing.ingredients.canonical_unit,
        })
      } else {
        toUpdate.push({
          fridgeId: inFridge.id,
          newAmount: available - needed,
        })
      }
    }

    // Om något saknas, varna och avbryt
    if (missing.length > 0) {
      const lines = missing
        .map(m => `• ${m.name}: saknar ${m.missing} ${m.unit}`)
        .join("\n")
      alert(
        `Du kan inte laga receptet just nu.\n\nFöljande saknas i matförrådet:\n\n${lines}\n\nLägg det som saknas på inköpslistan först.`
      )
      return
    }

    // Bekräftelse
    const confirmed = window.confirm(
      `Laga ${recipe.name} för ${servings} portioner?\n\nIngredienserna kommer dras från matförrådet.`
    )
    if (!confirmed) return

    // Uppdatera förrådet — dra mängderna
    // Rader som går till 0 tas bort helt, annars uppdateras amount
    for (const update of toUpdate) {
      if (update.newAmount <= 0.01) {
        // Mindre än 0.01 = praktiskt taget 0, ta bort raden
        await supabase.from("fridge").delete().eq("id", update.fridgeId)
      } else {
        await supabase
          .from("fridge")
          .update({ amount: Math.round(update.newAmount * 10) / 10 })
          .eq("id", update.fridgeId)
      }
    }

    alert(`Klart! ${recipe.name} är tillagat och matförrådet är uppdaterat.`)
    if (onCooked) onCooked()
  }

  return (
    <div>
      <button
        onClick={onBack}
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

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <h2 style={{ flex: 1 }}>{recipe.name}</h2>

          {/* Favoritknapp — synlig för alla (även delade recept) */}
          <button
            onClick={onToggleFavorite}
            aria-label={
              isFavorite ? "Ta bort från favoriter" : "Lägg till i favoriter"
            }
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "26px",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>

          {isOwner && (
            <button
              onClick={onToggleShare}
              style={{
                background: recipe.is_shared ? "#4CAF50" : "none",
                border: "1px solid #4CAF50",
                color: recipe.is_shared ? "white" : "#4CAF50",
                padding: "6px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              {recipe.is_shared ? "✓ Delat" : "Dela recept"}
            </button>
          )}
        </div>

        {recipe.description && (
          <p style={{ color: "#666", margin: "10px 0" }}>
            {recipe.description}
          </p>
        )}

        {/* Portionsväljare */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "20px",
            padding: "12px",
            background: "#f9f9f9",
            borderRadius: "8px",
          }}
        >
          <span style={{ fontWeight: "bold" }}>Portioner:</span>
          <button
            onClick={() => setServings(Math.max(1, servings - 1))}
            style={{ padding: "4px 12px" }}
            disabled={servings <= 1}
          >
            −
          </button>
          <span
            style={{
              minWidth: "30px",
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "18px",
            }}
          >
            {servings}
          </span>
          <button
            onClick={() => setServings(Math.min(12, servings + 1))}
            style={{ padding: "4px 12px" }}
            disabled={servings >= 12}
          >
            +
          </button>
          {servings !== baseServings && (
            <button
              onClick={() => setServings(baseServings)}
              style={{
                background: "none",
                border: "none",
                color: "#4CAF50",
                cursor: "pointer",
                fontSize: "13px",
                marginLeft: "auto",
              }}
            >
              Återställ ({baseServings})
            </button>
          )}
        </div>

        <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
          Ingredienser
        </h3>
        {recipe.recipe_ingredients.map(ing => (
          <div
            key={ing.id}
            style={{
              padding: "5px 0",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <span style={{ textTransform: "capitalize" }}>
              {ing.ingredients.name}
            </span>
            {ing.amount &&
              ` – ${scaleAmount(ing.amount)} ${ing.ingredients.canonical_unit}`}
          </div>
        ))}

        {recipe.instructions && (
          <>
            <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
              Instruktioner
            </h3>
            <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
              {recipe.instructions}
            </p>
          </>
        )}

        {/* Laga recept-knapp — synlig för alla (även delade recept) */}
        <button
          className="primary"
          onClick={handleCookRecipe}
          style={{ width: "100%", marginTop: "20px", padding: "12px" }}
        >
          🍳 Laga recept ({servings} port.)
        </button>

        {isOwner && (
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button className="primary" onClick={onEdit}>
              Redigera recept
            </button>
            <button className="danger" onClick={onDelete}>
              Ta bort recept
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecipeDetail