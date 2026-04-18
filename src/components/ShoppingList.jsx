import { useState, useEffect } from "react"
import { supabase } from "../supabase"

// Inköpslista — jämför ingredienser i valt recept mot användarens förråd
// och listar det som saknas eller finns i för liten mängd.
//
// Tack vare att all data nu är normaliserad till canonical_unit (se units.js)
// kan vi jämföra mängder direkt utan konvertering.
function ShoppingList({ session }) {
  const [recipes, setRecipes] = useState([])
  const [fridgeItems, setFridgeItems] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState("")
  const [shoppingList, setShoppingList] = useState([])
  const [checkedItems, setCheckedItems] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // Hämta recept + ingredienser (både egna och delade — RLS sköter filtreringen)
    const [recipesRes, fridgeRes] = await Promise.all([
      supabase
        .from("recipes")
        .select(`
          id,
          name,
          user_id,
          is_shared,
          recipe_ingredients (
            id,
            amount,
            ingredients (
              id,
              name,
              canonical_unit
            )
          )
        `)
        .order("name"),
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
        .eq("user_id", session.user.id),
    ])

    if (recipesRes.data) setRecipes(recipesRes.data)
    if (fridgeRes.data) setFridgeItems(fridgeRes.data)
    setLoading(false)
  }

  function generateShoppingList(recipeId) {
    setSelectedRecipe(recipeId)
    setCheckedItems({})

    if (!recipeId) {
      setShoppingList([])
      return
    }

    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return

    const missing = []

    recipe.recipe_ingredients.forEach(needed => {
      // Matchning via ingredient_id — ingen fritext-matchning behövs längre
      const available = fridgeItems.find(
        f => f.ingredients.id === needed.ingredients.id
      )

      const neededAmount = parseFloat(needed.amount)
      const availableAmount = available ? parseFloat(available.amount) : 0

      if (availableAmount < neededAmount) {
        // Saknas helt eller finns i för liten mängd
        missing.push({
          id: needed.id,
          name: needed.ingredients.name,
          unit: needed.ingredients.canonical_unit,
          amount: neededAmount - availableAmount,
        })
      }
    })

    setShoppingList(missing)
  }

  function toggleItem(id) {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) return <p>Laddar...</p>

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>🛒 Inköpslista</h2>

      <div className="card">
        <h3 style={{ marginBottom: "15px" }}>Välj recept</h3>
        <select
          value={selectedRecipe}
          onChange={e => generateShoppingList(e.target.value)}
        >
          <option value="">-- Välj ett recept --</option>
          {recipes.map(recipe => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}{" "}
              {recipe.user_id !== session.user.id ? "⭐ Delat" : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedRecipe && (() => {
        const recipe = recipes.find(r => r.id === selectedRecipe)
        const hasNoIngredients = recipe && recipe.recipe_ingredients.length === 0

        return (
          <div className="card">
            <h3 style={{ marginBottom: "15px" }}>
              {hasNoIngredients
                ? "⚠️ Det här receptet saknar ingredienser"
                : shoppingList.length === 0
                ? "✅ Du har allt du behöver!"
                : `Du behöver köpa ${shoppingList.length} sak${
                    shoppingList.length > 1 ? "er" : ""
                  }:`}
            </h3>

            {hasNoIngredients && (
              <p style={{ color: "#666" }}>
                Redigera receptet och lägg till ingredienser via
                Recept-sektionen.
              </p>
            )}

            {shoppingList.map(item => (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  textDecoration: checkedItems[item.id] ? "line-through" : "none",
                  color: checkedItems[item.id] ? "#999" : "#333",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: `2px solid ${
                      checkedItems[item.id] ? "#4CAF50" : "#ddd"
                    }`,
                    background: checkedItems[item.id] ? "#4CAF50" : "white",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "12px",
                  }}
                >
                  {checkedItems[item.id] && "✓"}
                </div>
                <span>
                  <span style={{ textTransform: "capitalize" }}>{item.name}</span>
                  {" – "}
                  {item.amount} {item.unit}
                </span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

export default ShoppingList