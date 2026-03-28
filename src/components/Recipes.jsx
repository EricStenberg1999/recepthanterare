import { useState, useEffect } from "react"
import { supabase } from "../supabase"

const UNITS = ["st", "g", "kg", "dl", "l", "msk", "tsk", "krm", "nypa"]

function Recipes({ session }) {
  const [myRecipes, setMyRecipes] = useState([])
  const [sharedRecipes, setSharedRecipes] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState("mine")
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
      console.log("All data:", data)
      console.log("Session user id:", session.user.id)
      // Dela upp i mina recept och delade recept
      setMyRecipes(data.filter(r => r.user_id === session.user.id))
      setSharedRecipes(data.filter(r => r.is_shared && r.user_id !== session.user.id))
    }
    setLoading(false)
  }

  function addIngredientRow() {
    setIngredients([...ingredients, { ingredient_name: "", amount: "", unit: "st" }])
  }

  function updateIngredient(index, field, value) {
    const updated = [...ingredients]
    updated[index][field] = value
    setIngredients(updated)
  }

  function removeIngredientRow(index) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  async function saveRecipe() {
    if (!name.trim()) return

    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .insert([{
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        source: "own",
        user_id: session.user.id,
        is_shared: false
      }])
      .select()

    if (recipeError) {
      console.error("Fel vid sparande av recept:", recipeError)
      return
    }

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

  // Dela eller avdela ett recept
  async function toggleShare(recipe) {
    const { error } = await supabase
      .from("recipes")
      .update({ is_shared: !recipe.is_shared })
      .eq("id", recipe.id)

    if (error) {
      console.error("Fel vid delning:", error)
    } else {
      fetchRecipes()
      // Uppdatera detaljvyn om det är det valda receptet
      setSelectedRecipe({ ...recipe, is_shared: !recipe.is_shared })
    }
  }

  if (loading) return <p>Laddar...</p>

  // Detaljvy för ett valt recept
  if (selectedRecipe) {
    const isOwner = selectedRecipe.user_id === session.user.id
    return (
      <div>
        <button
          onClick={() => setSelectedRecipe(null)}
          style={{ marginBottom: "15px", background: "none", border: "none", cursor: "pointer", color: "#4CAF50", fontSize: "16px" }}
        >
          ← Tillbaka
        </button>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2>{selectedRecipe.name}</h2>
            {isOwner && (
              <button
                onClick={() => toggleShare(selectedRecipe)}
                style={{
                  background: selectedRecipe.is_shared ? "#4CAF50" : "none",
                  border: "1px solid #4CAF50",
                  color: selectedRecipe.is_shared ? "white" : "#4CAF50",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                {selectedRecipe.is_shared ? "✓ Delat" : "Dela recept"}
              </button>
            )}
          </div>

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

          {isOwner && (
            <button
              className="danger"
              style={{ marginTop: "20px" }}
              onClick={() => deleteRecipe(selectedRecipe.id)}
            >
              Ta bort recept
            </button>
          )}
        </div>
      </div>
    )
  }

  const displayedRecipes = activeTab === "mine" ? myRecipes : sharedRecipes

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>📖 Recept</h2>

      {/* Flikar för mina recept och delade recept */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("mine")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            background: activeTab === "mine" ? "#4CAF50" : "#e0e0e0",
            color: activeTab === "mine" ? "white" : "#666",
            fontWeight: activeTab === "mine" ? "bold" : "normal"
          }}
        >
          Mina recept ({myRecipes.length})
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            background: activeTab === "shared" ? "#4CAF50" : "#e0e0e0",
            color: activeTab === "shared" ? "white" : "#666",
            fontWeight: activeTab === "shared" ? "normal" : "normal"
          }}
        >
          Delade recept ({sharedRecipes.length})
        </button>
      </div>

      {/* Knapp för att lägga till recept – bara på mina recept */}
      {activeTab === "mine" && (
        <button
          className="primary"
          style={{ marginBottom: "20px" }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Avbryt" : "+ Lägg till recept"}
        </button>
      )}

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

      {/* Receptlista */}
      <div className="card">
        {displayedRecipes.length === 0 ? (
          <p style={{ color: "#999" }}>
            {activeTab === "mine" ? "Inga recept än – lägg till ditt första!" : "Inga delade recept än!"}
          </p>
        ) : (
          displayedRecipes.map(recipe => (
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
                {recipe.is_shared && (
                  <span style={{ fontSize: "12px", color: "#4CAF50", marginLeft: "8px" }}>● Delat</span>
                )}
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