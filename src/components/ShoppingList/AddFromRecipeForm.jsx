import { useState, useEffect } from "react"
import { supabase } from "../../supabase"

// Receptväljare för att lägga till recept på inköpslistan.
// Hämtar recept, låter användaren välja + skala portioner, och
// beräknar vad som ska köpas (recept - matförråd).
function AddFromRecipeForm({ session, onDone, onCancel }) {
  const [recipes, setRecipes] = useState([])
  const [selectedRecipeId, setSelectedRecipeId] = useState("")
  const [servings, setServings] = useState(4)
  const [loading, setLoading] = useState(true)

  // Hämta recept en gång när komponenten öppnas
  useEffect(() => {
    async function fetchRecipes() {
      const { data, error } = await supabase
        .from("recipes")
        .select(`
          id,
          name,
          user_id,
          is_shared,
          base_servings,
          recipe_ingredients (
            amount,
            ingredients (
              id,
              name,
              canonical_unit
            )
          )
        `)
        .order("name")

      if (error) {
        console.error("Fel vid hämtning av recept:", error)
      } else {
        setRecipes(data)
      }
      setLoading(false)
    }
    fetchRecipes()
  }, [])

  function handleRecipeSelect(recipeId) {
    setSelectedRecipeId(recipeId)
    const recipe = recipes.find(r => r.id === recipeId)
    if (recipe) {
      setServings(recipe.base_servings || 4)
    }
  }

  async function handleConfirm() {
    if (!selectedRecipeId) return

    const recipe = recipes.find(r => r.id === selectedRecipeId)
    if (!recipe) return

    // Hämta matförrådet
    const { data: fridgeItems, error: fridgeError } = await supabase
      .from("fridge")
      .select("ingredient_id, amount")

    if (fridgeError) {
      alert("Kunde inte hämta matförrådet: " + fridgeError.message)
      return
    }

    // Hämta befintlig inköpslista för kombinering
    const { data: existingListItems, error: listError } = await supabase
      .from("shopping_list")
      .select("id, ingredient_id, amount")
      .not("ingredient_id", "is", null)

    if (listError) {
      alert("Kunde inte hämta inköpslistan: " + listError.message)
      return
    }

    const scaleFactor = servings / (recipe.base_servings || 4)

    // Map istället för array för att slå ihop duplicerade ingredienser i samma recept
    const upsertMap = new Map()

    for (const ing of recipe.recipe_ingredients) {
      const neededAmount = parseFloat(ing.amount) * scaleFactor
      const ingredientId = ing.ingredients.id

      const inFridge = fridgeItems.find(f => f.ingredient_id === ingredientId)
      const fridgeAmount = inFridge ? parseFloat(inFridge.amount) : 0

      const onList = existingListItems.find(
        e => e.ingredient_id === ingredientId
      )
      const listAmount = onList ? parseFloat(onList.amount) : 0

      const toBuy = Math.max(0, neededAmount - fridgeAmount)

      if (toBuy <= 0) continue

      const existing = upsertMap.get(ingredientId)
      if (existing) {
        existing.amount = Math.round((existing.amount + toBuy) * 10) / 10
      } else {
        const finalAmount = Math.round((listAmount + toBuy) * 10) / 10
        upsertMap.set(ingredientId, {
          user_id: session.user.id,
          ingredient_id: ingredientId,
          amount: finalAmount,
        })
      }
    }

    const upsertRows = Array.from(upsertMap.values())

    let addedCount = 0
    if (upsertRows.length > 0) {
      const { error } = await supabase
        .from("shopping_list")
        .upsert(upsertRows, { onConflict: "user_id,ingredient_id" })

      if (error) {
        alert("Fel vid tillägg: " + error.message)
        return
      }
      addedCount = upsertRows.length
    }

    if (addedCount === 0) {
      alert(
        `Allt som behövs för ${recipe.name} (${servings} port.) finns redan i matförrådet!`
      )
    } else {
      alert(
        `${addedCount} ${addedCount === 1 ? "vara" : "varor"} tillagda från ${recipe.name} (${servings} port.)`
      )
    }

    onDone()
  }

  if (loading) return <p>Laddar recept...</p>

  return (
    <div className="card">
      <h3 style={{ marginBottom: "15px" }}>Lägg till från recept</h3>

      <select
        value={selectedRecipeId}
        onChange={e => handleRecipeSelect(e.target.value)}
      >
        <option value="">-- Välj ett recept --</option>
        {recipes.map(r => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.user_id !== session.user.id ? " ⭐" : ""}
          </option>
        ))}
      </select>

      {selectedRecipeId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "15px 0",
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
        </div>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onCancel} style={{ flex: 1 }}>
          Avbryt
        </button>
        <button
          className="primary"
          onClick={handleConfirm}
          disabled={!selectedRecipeId}
          style={{ flex: 1 }}
        >
          Lägg till
        </button>
      </div>
    </div>
  )
}

export default AddFromRecipeForm