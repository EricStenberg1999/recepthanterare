import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import RecipeForm from "./RecipeForm"
import RecipeDetail from "./RecipeDetail"
import RecipeListItem from "./RecipeListItem"

function Recipes({ session }) {
  const [myRecipes, setMyRecipes] = useState([])
  const [sharedRecipes, setSharedRecipes] = useState([])
  const [activeTab, setActiveTab] = useState("mine")
  const [loading, setLoading] = useState(true)

  // Tre lägen: "list" (default), "detail", "form"
  const [view, setView] = useState("list")
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [editingRecipe, setEditingRecipe] = useState(null)

  useEffect(() => {
    fetchRecipes()
  }, [])

  // Hämta recept med JOIN mot ingredients så vi får namn och enhet direkt
  async function fetchRecipes() {
    const { data, error } = await supabase
      .from("recipes")
      .select(`
        *,
        recipe_ingredients (
          id,
          amount,
          input_unit,
          ingredients (
            id,
            name,
            canonical_unit,
            category
          )
        )
      `)
      .order("name")

    if (error) {
      console.error("Fel vid hämtning:", error)
    } else {
      setMyRecipes(data.filter(r => r.user_id === session.user.id))
      setSharedRecipes(
        data.filter(r => r.is_shared && r.user_id !== session.user.id)
      )
    }
    setLoading(false)
  }

  function openRecipe(recipe) {
    setSelectedRecipe(recipe)
    setView("detail")
  }

  function backToList() {
    setSelectedRecipe(null)
    setEditingRecipe(null)
    setView("list")
  }

  function startNewRecipe() {
    setEditingRecipe(null)
    setView("form")
  }

  function startEditing(recipe) {
    setEditingRecipe(recipe)
    setSelectedRecipe(null)
    setView("form")
  }

  // Efter sparning: stäng formuläret och ladda om listan
  async function handleSaved() {
    await fetchRecipes()
    backToList()
  }

  async function deleteRecipe(id) {
    const { error } = await supabase.from("recipes").delete().eq("id", id)
    if (error) {
      console.error("Fel vid borttagning:", error)
    } else {
      backToList()
      fetchRecipes()
    }
  }

  async function toggleShare(recipe) {
    const { error } = await supabase
      .from("recipes")
      .update({ is_shared: !recipe.is_shared })
      .eq("id", recipe.id)

    if (error) {
      console.error("Fel vid delning:", error)
    } else {
      // Uppdatera selectedRecipe lokalt så UI:t reagerar direkt
      setSelectedRecipe({ ...recipe, is_shared: !recipe.is_shared })
      fetchRecipes()
    }
  }

  if (loading) return <p>Laddar...</p>

  // --- VY: Detaljvy ---
  if (view === "detail" && selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        isOwner={selectedRecipe.user_id === session.user.id}
        onBack={backToList}
        onEdit={() => startEditing(selectedRecipe)}
        onDelete={() => deleteRecipe(selectedRecipe.id)}
        onToggleShare={() => toggleShare(selectedRecipe)}
      />
    )
  }

  // --- VY: Formulär (nytt eller redigering) ---
  if (view === "form") {
    return (
      <RecipeForm
        session={session}
        editingRecipe={editingRecipe}
        onSaved={handleSaved}
        onCancel={backToList}
      />
    )
  }

  // --- VY: Lista ---
  const displayedRecipes = activeTab === "mine" ? myRecipes : sharedRecipes

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>📖 Recept</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("mine")}
          className={activeTab === "mine" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          Mina recept ({myRecipes.length})
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={activeTab === "shared" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          Delade recept ({sharedRecipes.length})
        </button>
      </div>

      {/* Nytt recept-knapp (bara på Mina) */}
      {activeTab === "mine" && (
        <button
          className="primary"
          style={{ marginBottom: "20px", width: "100%" }}
          onClick={startNewRecipe}
        >
          + Lägg till recept
        </button>
      )}

      {/* Receptlista */}
      <div className="card">
        {displayedRecipes.length === 0 ? (
          <p style={{ color: "#999" }}>
            {activeTab === "mine"
              ? "Inga recept än – lägg till ditt första!"
              : "Inga delade recept än!"}
          </p>
        ) : (
          displayedRecipes.map(recipe => (
            <RecipeListItem
              key={recipe.id}
              recipe={recipe}
              onClick={() => openRecipe(recipe)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Recipes