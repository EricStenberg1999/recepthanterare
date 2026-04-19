import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import RecipeForm from "./RecipeForm"
import RecipeDetail from "./RecipeDetail"
import RecipeListItem from "./RecipeListItem"

function Recipes({ session }) {
  const [myRecipes, setMyRecipes] = useState([])
  const [sharedRecipes, setSharedRecipes] = useState([])
  // Set av recipe_id:s som användaren favoritmarkerat — använder Set för snabba lookups
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [activeTab, setActiveTab] = useState("mine")
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState("list")
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [editingRecipe, setEditingRecipe] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Hämta recept och favoriter parallellt
  async function fetchData() {
    const [recipesRes, favoritesRes] = await Promise.all([
      supabase
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
        .order("name"),
      supabase.from("favorites").select("recipe_id"),
    ])

    if (recipesRes.error) {
      console.error("Fel vid hämtning av recept:", recipesRes.error)
    } else {
      setMyRecipes(recipesRes.data.filter(r => r.user_id === session.user.id))
      setSharedRecipes(
        recipesRes.data.filter(
          r => r.is_shared && r.user_id !== session.user.id
        )
      )
    }

    if (favoritesRes.error) {
      console.error("Fel vid hämtning av favoriter:", favoritesRes.error)
    } else {
      setFavoriteIds(new Set(favoritesRes.data.map(f => f.recipe_id)))
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

  async function handleSaved() {
    await fetchData()
    backToList()
  }

  async function deleteRecipe(id) {
    const { error } = await supabase.from("recipes").delete().eq("id", id)
    if (error) {
      console.error("Fel vid borttagning:", error)
    } else {
      backToList()
      fetchData()
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
      setSelectedRecipe({ ...recipe, is_shared: !recipe.is_shared })
      fetchData()
    }
  }

  // Växla favorit-status för ett recept
  async function toggleFavorite(recipeId) {
    const isFavorite = favoriteIds.has(recipeId)

    if (isFavorite) {
      // Ta bort favorit
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("recipe_id", recipeId)
        .eq("user_id", session.user.id)

      if (error) {
        console.error("Fel vid borttagning av favorit:", error)
        return
      }

      // Uppdatera lokalt state — ta bort från Set
      const newSet = new Set(favoriteIds)
      newSet.delete(recipeId)
      setFavoriteIds(newSet)
    } else {
      // Lägg till favorit
      const { error } = await supabase
        .from("favorites")
        .insert([{ recipe_id: recipeId, user_id: session.user.id }])

      if (error) {
        console.error("Fel vid sparande av favorit:", error)
        return
      }

      // Uppdatera lokalt state — lägg till i Set
      setFavoriteIds(new Set([...favoriteIds, recipeId]))
    }
  }

  if (loading) return <p>Laddar...</p>

  // --- VY: Detaljvy ---
  if (view === "detail" && selectedRecipe) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        isOwner={selectedRecipe.user_id === session.user.id}
        isFavorite={favoriteIds.has(selectedRecipe.id)}
        onBack={backToList}
        onEdit={() => startEditing(selectedRecipe)}
        onDelete={() => deleteRecipe(selectedRecipe.id)}
        onToggleShare={() => toggleShare(selectedRecipe)}
        onToggleFavorite={() => toggleFavorite(selectedRecipe.id)}
      />
    )
  }

  // --- VY: Formulär ---
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
  // Favoriter-tabben visar BÅDE egna och delade favoritmarkerade recept
  let displayedRecipes
  if (activeTab === "mine") {
    displayedRecipes = myRecipes
  } else if (activeTab === "shared") {
    displayedRecipes = sharedRecipes
  } else {
    // favorites
    displayedRecipes = [...myRecipes, ...sharedRecipes].filter(r =>
      favoriteIds.has(r.id)
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>📖 Recept</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("mine")}
          className={activeTab === "mine" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          Mina ({myRecipes.length})
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={activeTab === "shared" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          Delade ({sharedRecipes.length})
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={activeTab === "favorites" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          ❤️ ({favoriteIds.size})
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
              : activeTab === "shared"
              ? "Inga delade recept än!"
              : "Inga favoriter än – tryck på hjärtat på ett recept!"}
          </p>
        ) : (
          displayedRecipes.map(recipe => (
            <RecipeListItem
              key={recipe.id}
              recipe={recipe}
              isFavorite={favoriteIds.has(recipe.id)}
              onClick={() => openRecipe(recipe)}
              onToggleFavorite={() => toggleFavorite(recipe.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Recipes