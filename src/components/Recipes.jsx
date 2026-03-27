import { useState, useEffect } from "react"
import { supabase } from "../supabase"

const UNITS = ["st", "g", "kg", "dl", "l", "msk", "tsk", "krm", "nypa"]

function Recipes() {
  const [recipes, setRecipes] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Formulärdata för nytt recept
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [ingredients, setIngredients] = useState([
    { ingredient_name: "", amount: "", unit: "st" }
  ])

  useEffect(() => {
    fetchRecipes()
  }, [])

  async function fetchRecipes() {
    const { data, error } = await supabase
      .from("recipes")
      .select("*, recipe_ingredients(*)")
      .order("name")

    if (error) {
      console.error("Fel vid hämtning:", error)
    } else {
      setRecipes(data)
    }
    setLoading(false)
  }

  // Lägg till en ingrediensrad i formuläret
  function addIngredientRow() {
    setIngredients([...ingredients, { ingredient_name: "", amount: "", unit: "st" }])
  }

  // Uppdatera en specifik ingrediensrad
  function updateIngredient(index, field, value) {
    const updated = [...ingredients]
    updated[index][field] = value
    setIngredients(updated)
  }

  // Ta bort en ingrediensrad från formuläret
  function removeIngredientRow(index) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  async function saveRecipe() {
    if (!name.trim()) return

    // Spara själva receptet först
    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .insert([{
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        source: "own",
        user_id: "default"
      }])
      .select()

    if (recipeError) {
      console.error("Fel vid sparande av recept:", recipeError)
      return
    }

    // Spara ingredienserna kopplade till receptet
    const recipeId = recipeData[0].id
    const ingredientsToSave = ingredients
      .filter(i => i.ingredient_name.trim() !== "")
      .map(i => ({
        recipe_id: recipeId,
        ingredient_name: i.ingredient_name.toLowerCase().trim(),
        amount: i.amount ? parseFloat(i.amount) : null,
        unit: i.unit
      }))

    if (ingredientsToSave.length > 0) {
      const { error: ingError } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientsToSave)

      if (ingError) {
        console.error("Fel vid sparande av ingredienser:", ingError)
        return
      }
    }

    // Rensa formuläret och uppdatera listan
    setName("")
    setDescription("")
    setInstructions("")
    setIngredients([{ ingredient_name: "", amount: "", unit: "st" }])
    setShowForm(false)
    fetchRecipes()
  }

  async function deleteRecipe(id) {
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Fel vid borttagning:", error)
    } else {
      setSelectedRecipe(null)
      fetchRecipes()
    }
  }

  if (loading) return <p>Laddar...</p>

  // Visa detaljvy för ett valt recept
  if (selectedRecipe) {
    return (
      <div>
        <button
          onClick={() => setSelectedRecipe(null)}
          style={{ marginBottom: "15px", background: "none", border: "none", cursor: "pointer", color: "#4CAF50", fontSize: "16px" }}
        >
          ← Tillbaka
        </button>
        <div className="card">
          <h2>{selectedRecipe.name}</h2>
          {selectedRecipe.description && (
            <p style={{ color: "#666", margin: "10px 0" }}>{selectedRecipe.description}</p>
          )}

          <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>Ingredienser</h3>
          {selectedRecipe.recipe_ingredients.map(ing => (
            <div key={ing.id} style={{ padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
              {ing.ingredient_name}{ing.amount && ` – ${ing.amount} ${ing.unit}`}
            </div>
          ))}

          {selectedRecipe.instructions && (
            <>
              <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>Instruktioner</h3>
              <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{selectedRecipe.instructions}</p>
            </>
          )}

          <button
            className="danger"
            style={{ marginTop: "20px" }}
            onClick={() => deleteRecipe(selectedRecipe.id)}
          >
            Ta bort recept
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>📖 Mina recept</h2>

      {/* Knapp för att visa/dölja formuläret */}
      <button
        className="primary"
        style={{ marginBottom: "20px" }}
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? "Avbryt" : "+ Lägg till recept"}
      </button>

      {/* Formulär för nytt recept */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: "15px" }}>Nytt recept</h3>
          <input
            type="text"
            placeholder="Receptnamn"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Kort beskrivning (valfritt)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <h4 style={{ margin: "15px 0 10px" }}>Ingredienser</h4>
          {ingredients.map((ing, index) => (
            <div key={index} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Ingrediens"
                value={ing.ingredient_name}
                onChange={(e) => updateIngredient(index, "ingredient_name", e.target.value)}
                style={{ flex: 2, marginBottom: 0 }}
              />
              <input
                type="number"
                placeholder="Mängd"
                value={ing.amount}
                onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <select
                value={ing.unit}
                onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                style={{ flex: 1, marginBottom: 0 }}
              >
                {UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <button
                className="danger"
                onClick={() => removeIngredientRow(index)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addIngredientRow}
            style={{ background: "none", border: "1px dashed #ccc", width: "100%", padding: "8px", borderRadius: "8px", cursor: "pointer", marginBottom: "15px" }}
          >
            + Ingrediens
          </button>

          <h4 style={{ marginBottom: "10px" }}>Instruktioner</h4>
          <textarea
            placeholder="Skriv instruktionerna här..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
          />

          <button className="primary" onClick={saveRecipe}>
            Spara recept
          </button>
        </div>
      )}

      {/* Lista över recept */}
      <div className="card">
        {recipes.length === 0 ? (
          <p style={{ color: "#999" }}>Inga recept än – lägg till ditt första!</p>
        ) : (
          recipes.map(recipe => (
            <div
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              style={{
                padding: "15px 0",
                borderBottom: "1px solid #f0f0f0",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <strong>{recipe.name}</strong>
                {recipe.description && (
                  <p style={{ color: "#666", fontSize: "13px", marginTop: "3px" }}>{recipe.description}</p>
                )}
              </div>
              <span style={{ color: "#ccc" }}>→</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Recipes