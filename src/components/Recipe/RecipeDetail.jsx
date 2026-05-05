import { useState } from "react"
import { supabase } from "../../supabase"
import { fromCanonical } from "../../utils/units"

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

  const [checkedSteps, setCheckedSteps] = useState(new Set())

  function toggleStep(index) {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Hjälpfunktion: skala en canonical-mängd och konvertera till display-enhet
  function displayAmount(canonicalAmount, inputUnit, canonicalUnit) {
    const scaledCanonical = (parseFloat(canonicalAmount) * servings) / baseServings
    // Konvertera till display-enhet (t.ex. 0.025 dl → 0.5 tsk)
    if (inputUnit && inputUnit !== canonicalUnit) {
      return fromCanonical(scaledCanonical, inputUnit, canonicalUnit)
    }
    // Om ingen input_unit eller samma som canonical — avrunda till 1 decimal
    return Math.round(scaledCanonical * 10) / 10
  }

  // Hjälpfunktion: skala en canonical-mängd för matchningslogik (förråd, inköpslista)
  function scaleAmount(amount) {
    return (parseFloat(amount) * servings) / baseServings
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

  // Lägg till receptets saknade ingredienser på inköpslistan
  async function handleAddToShoppingList() {
    const { data: fridgeItems, error: fetchError } = await supabase
      .from("fridge")
      .select("amount, ingredients ( id )")

    if (fetchError) {
      alert("Kunde inte hämta matförrådet: " + fetchError.message)
      return
    }

    const { data: listItems, error: listError } = await supabase
      .from("shopping_list")
      .select("id, ingredient_id, amount")

    if (listError) {
      alert("Kunde inte hämta inköpslistan: " + listError.message)
      return
    }

    const toAdd = []
    const toUpdate = []

    for (const ing of recipe.recipe_ingredients) {
      const needed = scaleAmount(ing.amount)
      const inFridge = fridgeItems.find(
        f => f.ingredients.id === ing.ingredients.id
      )
      const available = inFridge ? parseFloat(inFridge.amount) : 0
      const missing = needed - available

      if (missing <= 0) continue

      const existing = listItems.find(
        l => l.ingredient_id === ing.ingredients.id
      )

      if (existing) {
        toUpdate.push({
          id: existing.id,
          newAmount: Math.round((parseFloat(existing.amount) + missing) * 10) / 10,
        })
      } else {
        toAdd.push({
          user_id: recipe.user_id,
          ingredient_id: ing.ingredients.id,
          amount: Math.round(missing * 10) / 10,
        })
      }
    }

    if (toAdd.length === 0 && toUpdate.length === 0) {
      alert("Du har redan allt du behöver för det här receptet! 🎉")
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session.user.id

    const rowsToInsert = toAdd.map(row => ({ ...row, user_id: userId }))

    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from("shopping_list").insert(rowsToInsert)
      if (error) {
        alert("Kunde inte lägga till varor: " + error.message)
        return
      }
    }

    for (const update of toUpdate) {
      const { error } = await supabase
        .from("shopping_list")
        .update({ amount: update.newAmount })
        .eq("id", update.id)
      if (error) {
        console.error("Fel vid uppdatering av befintlig rad:", error)
      }
    }

    const totalCount = toAdd.length + toUpdate.length
    alert(
      `${totalCount} ${totalCount === 1 ? "vara" : "varor"} tillagd${
        totalCount === 1 ? "" : "a"
      } på inköpslistan!`
    )
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

        {/* Receptbild om den finns */}
        {recipe.image_url && (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            style={{
              maxWidth: "100%",
              maxHeight: "300px",
              borderRadius: "8px",
              marginTop: "10px",
              display: "block",
              margin: "10px auto 0",
            }}
          />
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
              ` – ${displayAmount(ing.amount, ing.input_unit, ing.ingredients.canonical_unit)} ${ing.input_unit || ing.ingredients.canonical_unit}`}
          </div>
        ))}

        {recipe.instructions && (
  <>
    <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
      Instruktioner
    </h3>
    {recipe.instructions
      .split("\n")
      .filter(step => step.trim().length > 0)
      .map((step, index) => {
        const isChecked = checkedSteps.has(index)
        return (
          <div
            key={index}
            onClick={() => toggleStep(index)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "10px 0",
              borderBottom: "1px solid #f0f0f0",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: `2px solid ${isChecked ? "#4CAF50" : "#ddd"}`,
                background: isChecked ? "#4CAF50" : "white",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px",
                marginTop: "2px",
              }}
            >
              {isChecked && "✓"}
            </div>
            <span
              style={{
                flex: 1,
                lineHeight: "1.6",
                textDecoration: isChecked ? "line-through" : "none",
                color: isChecked ? "#999" : "#333",
              }}
            >
              {step}
            </span>
          </div>
        )
      })}
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