import { useState, useEffect } from "react"
import { supabase } from "../supabase"

// Konverteringstabell för att jämföra mängder i olika enheter
const CONVERSIONS = {
  // Volym – allt konverteras till ml
  krm: 1,
  tsk: 5,
  msk: 15,
  dl: 100,
  l: 1000,
  // Vikt – allt konverteras till gram
  g: 1,
  kg: 1000,
  // Styck – ingen konvertering
  st: 1,
  nypa: 1
}

// Avgör om två enheter är jämförbara
function sameUnitType(unit1, unit2) {
  const volume = ["krm", "tsk", "msk", "dl", "l"]
  const weight = ["g", "kg"]
  const piece = ["st", "nypa", "klyfta"]

  if (volume.includes(unit1) && volume.includes(unit2)) return "volume"
  if (weight.includes(unit1) && weight.includes(unit2)) return "weight"
  if (piece.includes(unit1) && piece.includes(unit2)) return "piece"
  return null
}

// Räkna ut hur mycket som saknas av en ingrediens
function calculateMissing(needed, available) {
  const unitType = sameUnitType(needed.unit, available.unit)

  if (!unitType) {
    // Enheter går inte att jämföra, visa som saknad
    return needed
  }

  const neededInBase = needed.amount * (CONVERSIONS[needed.unit] || 1)
  const availableInBase = available.amount * (CONVERSIONS[available.unit] || 1)

  if (availableInBase >= neededInBase) {
    // Har tillräckligt
    return null
  }

  // Räkna ut hur mycket som saknas i originalenheten
  const missingInBase = neededInBase - availableInBase
  const missingAmount = missingInBase / (CONVERSIONS[needed.unit] || 1)

  return { ...needed, amount: Math.ceil(missingAmount) }
}

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
    // Hämta recept och kylinnehåll samtidigt
    const [recipesRes, fridgeRes] = await Promise.all([
      supabase.from("recipes").select("*, recipe_ingredients(*)").order("name"),
      supabase.from("fridge").select("*")
    ])

    if (recipesRes.data) setRecipes(recipesRes.data)
    if (fridgeRes.data) setFridgeItems(fridgeRes.data)
    setLoading(false)
  }

  // Generera inköpslista baserat på valt recept
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

    // Gå igenom varje ingrediens i receptet
    recipe.recipe_ingredients.forEach(needed => {
      // Hitta matchande ingrediens i kylen (jämför namn)
      const available = fridgeItems.find(
        f => f.ingredient_name.toLowerCase() === needed.ingredient_name.toLowerCase()
      )

      if (!available) {
        // Ingrediensen finns inte alls i kylen
        missing.push(needed)
      } else if (needed.amount) {
        // Ingrediensen finns men kanske inte tillräckligt
        const missingAmount = calculateMissing(needed, available)
        if (missingAmount) missing.push(missingAmount)
      }
      // Om ingen mängd anges och ingrediensen finns – hoppa över
    })

    setShoppingList(missing)
  }

  // Markera/avmarkera ett köpt föremål
  function toggleItem(id) {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) return <p>Laddar...</p>

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>🛒 Inköpslista</h2>

      {/* Välj recept */}
      <div className="card">
        <h3 style={{ marginBottom: "15px" }}>Välj recept</h3>
        <select
          value={selectedRecipe}
          onChange={(e) => generateShoppingList(e.target.value)}
        >
          <option value="">-- Välj ett recept --</option>
          {recipes.map(recipe => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </select>
      </div>

      {/* Visa inköpslistan */}
      {selectedRecipe && (
        <div className="card">
          <h3 style={{ marginBottom: "15px" }}>
            {shoppingList.length === 0
              ? "✅ Du har allt du behöver!"
              : `Du behöver köpa ${shoppingList.length} sak${shoppingList.length > 1 ? "er" : ""}:`
            }
          </h3>

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
                color: checkedItems[item.id] ? "#999" : "#333"
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: `2px solid ${checkedItems[item.id] ? "#4CAF50" : "#ddd"}`,
                background: checkedItems[item.id] ? "#4CAF50" : "white",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px"
              }}>
                {checkedItems[item.id] && "✓"}
              </div>
              <span>
                {item.ingredient_name}
                {item.amount && ` – ${item.amount} ${item.unit}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ShoppingList