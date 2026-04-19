import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import IngredientPicker from "./IngredientPicker"

// Skapa eller redigera ett recept.
// Props:
//   editingRecipe — recept-objekt om vi redigerar, null om nytt
//   onSaved — callback när sparning lyckats
//   onCancel — callback när användaren avbryter
function RecipeForm({ session, editingRecipe, onSaved, onCancel }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [baseServings, setBaseServings] = useState(4)

  // Lokal lista av valda ingredienser innan sparning
  // Varje post: { ingredient: {id, name, canonical_unit}, amount, input_unit }
  const [ingredients, setIngredients] = useState([])

  // Styr om IngredientPicker visas
  const [showPicker, setShowPicker] = useState(false)

  // Förifyll formuläret om vi redigerar ett befintligt recept
  useEffect(() => {
    if (editingRecipe) {
      setName(editingRecipe.name)
      setDescription(editingRecipe.description || "")
      setInstructions(editingRecipe.instructions || "")
      setBaseServings(editingRecipe.base_servings || 4)

      // Mappa om database-formatet till samma struktur som IngredientPicker ger oss
      const existingIngredients = editingRecipe.recipe_ingredients.map(ri => ({
        ingredient: ri.ingredients,
        amount: parseFloat(ri.amount),
        input_unit: ri.input_unit || ri.ingredients.canonical_unit,
      }))
      setIngredients(existingIngredients)
    }
  }, [editingRecipe])

  // Callback från IngredientPicker när användaren valt en ingrediens
  function handlePickerSelect({ ingredient, amount, input_unit }) {
    // Kolla om ingrediensen redan finns — om ja, addera mängden
    const existingIndex = ingredients.findIndex(
      i => i.ingredient.id === ingredient.id
    )

    if (existingIndex >= 0) {
      const updated = [...ingredients]
      updated[existingIndex].amount += amount
      setIngredients(updated)
    } else {
      setIngredients([...ingredients, { ingredient, amount, input_unit }])
    }

    // Lämnar pickern öppen så användaren kan lägga till flera i rad
  }

  function removeIngredient(index) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  async function saveRecipe() {
    if (!name.trim()) {
      alert("Receptet måste ha ett namn")
      return
    }

    if (editingRecipe) {
      // --- Uppdatera befintligt recept ---
      const { error: recipeError } = await supabase
        .from("recipes")
        .update({
          name: name.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          base_servings: baseServings,
        })
        .eq("id", editingRecipe.id)

      if (recipeError) {
        console.error("Fel vid uppdatering av recept:", recipeError)
        return
      }

      // Enklast: ta bort alla gamla ingredienser och skriv om dem
      const { error: deleteError } = await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("recipe_id", editingRecipe.id)

      if (deleteError) {
        console.error("Fel vid borttagning av gamla ingredienser:", deleteError)
        return
      }

      await saveIngredients(editingRecipe.id)
    } else {
      // --- Skapa nytt recept ---
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .insert([
          {
            name: name.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
            source: "own",
            user_id: session.user.id,
            is_shared: false,
            base_servings: baseServings,
          },
        ])
        .select()

      if (recipeError) {
        console.error("Fel vid sparande av recept:", recipeError)
        return
      }

      await saveIngredients(recipeData[0].id)
    }

    onSaved()
  }

  // Hjälpfunktion: spara ingredienser till ett given recipe_id
  async function saveIngredients(recipeId) {
    if (ingredients.length === 0) return

    const rows = ingredients.map(i => ({
      recipe_id: recipeId,
      ingredient_id: i.ingredient.id,
      amount: i.amount,
      input_unit: i.input_unit,
    }))

    const { error } = await supabase.from("recipe_ingredients").insert(rows)
    if (error) {
      console.error("Fel vid sparande av ingredienser:", error)
    }
  }

  return (
    <div>
      <button
        onClick={onCancel}
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
        <h3 style={{ marginBottom: "15px" }}>
          {editingRecipe ? "Redigera recept" : "Nytt recept"}
        </h3>

        <input
          type="text"
          placeholder="Receptnamn"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Kort beskrivning (valfritt)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Antal portioner — används senare för skalning och "laga recept"-knapp */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "15px 0 10px" }}>
          <label style={{ fontWeight: "bold" }}>Antal portioner:</label>
          <button
            onClick={() => setBaseServings(Math.max(1, baseServings - 1))}
            style={{ padding: "4px 12px" }}
            disabled={baseServings <= 1}
          >
            −
          </button>
          <span style={{ minWidth: "30px", textAlign: "center", fontWeight: "bold" }}>
            {baseServings}
          </span>
          <button
            onClick={() => setBaseServings(Math.min(12, baseServings + 1))}
            style={{ padding: "4px 12px" }}
            disabled={baseServings >= 12}
          >
            +
          </button>
        </div>

        <h4 style={{ margin: "15px 0 10px" }}>
          Ingredienser ({ingredients.length})
        </h4>

        {/* Lista över valda ingredienser */}
        {ingredients.length > 0 && (
          <div style={{ marginBottom: "15px" }}>
            {ingredients.map((ing, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <span>
                  <span style={{ textTransform: "capitalize" }}>
                    {ing.ingredient.name}
                  </span>
                  {" – "}
                  {ing.amount} {ing.ingredient.canonical_unit}
                </span>
                <button
                  className="danger"
                  onClick={() => removeIngredient(index)}
                  style={{ padding: "4px 10px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Picker eller "lägg till"-knapp */}
        {showPicker ? (
          <IngredientPicker
            onSelect={handlePickerSelect}
            onCancel={() => setShowPicker(false)}
            cancelLabel="Klar"
          />
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            style={{
              background: "none",
              border: "1px dashed #ccc",
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              cursor: "pointer",
              marginBottom: "15px",
            }}
          >
            + Lägg till ingrediens
          </button>
        )}

        <h4 style={{ marginBottom: "10px" }}>Instruktioner</h4>
        <textarea
          placeholder="Skriv instruktionerna här..."
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={6}
        />

        <button
          className="primary"
          onClick={saveRecipe}
          style={{ width: "100%" }}
        >
          {editingRecipe ? "Spara ändringar" : "Spara recept"}
        </button>
      </div>
    </div>
  )
}

export default RecipeForm