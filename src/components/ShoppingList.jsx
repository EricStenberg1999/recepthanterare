import { useState, useEffect } from "react"
import { supabase } from "../supabase"

function ShoppingList({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Recept-lägg-till-flödet
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [recipes, setRecipes] = useState([])
  const [selectedRecipeId, setSelectedRecipeId] = useState("")
  const [servings, setServings] = useState(4)

  // Custom vara-flödet
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customAmount, setCustomAmount] = useState("")
  const [customUnit, setCustomUnit] = useState("st")

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from("shopping_list")
      .select(`
        id,
        ingredient_id,
        custom_name,
        amount,
        unit,
        checked,
        created_at,
        ingredients (
          id,
          name,
          canonical_unit
        )
      `)
      .order("checked")
      .order("created_at")

    if (error) {
      console.error("Fel vid hämtning:", error)
    } else {
      setItems(data)
    }
    setLoading(false)
  }

  // Hämta recept först när användaren öppnar receptväljaren (lazy)
  async function openRecipePicker() {
    if (recipes.length === 0) {
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
        return
      }

      setRecipes(data)
    }
    setShowRecipePicker(true)
  }

  // När användaren väljer ett recept från dropdownen, sätt default-portioner
  function handleRecipeSelect(recipeId) {
    setSelectedRecipeId(recipeId)
    const recipe = recipes.find(r => r.id === recipeId)
    if (recipe) {
      setServings(recipe.base_servings || 4)
    }
  }

  // Bekräfta tillägg: beräkna vad som saknas (recept vs matförråd) och lägg till
  async function confirmAddRecipe() {
    if (!selectedRecipeId) return

    const recipe = recipes.find(r => r.id === selectedRecipeId)
    if (!recipe) return

    // 1. Hämta nuvarande matförråd (RLS filtrerar per användare)
    const { data: fridgeItems, error: fridgeError } = await supabase
      .from("fridge")
      .select("ingredient_id, amount")

    if (fridgeError) {
      alert("Kunde inte hämta matförrådet: " + fridgeError.message)
      return
    }

    // 2. Hämta befintlig inköpslista för att kunna kombinera
    const { data: existingListItems, error: listError } = await supabase
      .from("shopping_list")
      .select("id, ingredient_id, amount")
      .not("ingredient_id", "is", null)

    if (listError) {
      alert("Kunde inte hämta inköpslistan: " + listError.message)
      return
    }

    // 3. Beräkna skalning
    const scaleFactor = servings / (recipe.base_servings || 4)

    // 4. För varje ingrediens: räkna ut vad som saknas
    // Vi använder upsert för att undvika unique constraint-fel om ingrediensen
    // redan finns på listan (då adderas mängden till befintlig rad).
    //
    // KÄND BEGRÄNSNING: Flera recept med samma ingrediens räknas oberoende
    // mot förrådet, vilket kan ge lägre total än behövs. Planerad fix i v1.2.
    //
    // Vi använder en Map för att slå ihop duplicerade ingredienser i samma
    // recept — annars kraschar upsert eftersom den inte kan uppdatera samma
    // (user_id, ingredient_id) två gånger i samma batch.
    const upsertMap = new Map()

    for (const ing of recipe.recipe_ingredients) {
      const neededAmount = parseFloat(ing.amount) * scaleFactor
      const ingredientId = ing.ingredients.id

      // Vad finns i matförrådet?
      const inFridge = fridgeItems.find(f => f.ingredient_id === ingredientId)
      const fridgeAmount = inFridge ? parseFloat(inFridge.amount) : 0

      // Vad finns redan på inköpslistan?
      const onList = existingListItems.find(
        e => e.ingredient_id === ingredientId
      )
      const listAmount = onList ? parseFloat(onList.amount) : 0

      // Vad ska köpas = behov - förråd (min 0)
      const toBuy = Math.max(0, neededAmount - fridgeAmount)

      if (toBuy <= 0) continue

      // Om ingrediensen redan finns i vår map (dubblett i samma recept),
      // addera mängden istället för att skriva över
      const existing = upsertMap.get(ingredientId)
      if (existing) {
        existing.amount = Math.round((existing.amount + toBuy) * 10) / 10
      } else {
        // Ny rad = befintlig mängd på listan + det vi lägger till
        const finalAmount = Math.round((listAmount + toBuy) * 10) / 10
        upsertMap.set(ingredientId, {
          user_id: session.user.id,
          ingredient_id: ingredientId,
          amount: finalAmount,
        })
      }
    }

    const upsertRows = Array.from(upsertMap.values())

    // 5. Upsert — uppdaterar om unique (user_id, ingredient_id) finns, annars insert
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

    // 6. Sammanfattning till användaren
    if (addedCount === 0) {
      alert(
        `Allt som behövs för ${recipe.name} (${servings} port.) finns redan i matförrådet!`
      )
    } else {
      alert(
        `${addedCount} ${addedCount === 1 ? "vara" : "varor"} tillagda från ${recipe.name} (${servings} port.)`
      )
    }

    // Återställ och uppdatera listan
    setShowRecipePicker(false)
    setSelectedRecipeId("")
    fetchItems()
  }

  async function toggleChecked(item) {
    const { error } = await supabase
      .from("shopping_list")
      .update({ checked: !item.checked })
      .eq("id", item.id)

    if (error) {
      console.error("Fel vid uppdatering:", error)
    } else {
      fetchItems()
    }
  }

  async function deleteItem(id) {
    const { error } = await supabase
      .from("shopping_list")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Fel vid borttagning:", error)
    } else {
      fetchItems()
    }
  }

  // Lägg till en fristående (custom) vara på inköpslistan
  async function addCustomItem() {
    if (!customName.trim()) {
      alert("Ange ett namn på varan")
      return
    }

    const { error } = await supabase.from("shopping_list").insert([
      {
        user_id: session.user.id,
        custom_name: customName.toLowerCase().trim(),
        amount: customAmount ? parseFloat(customAmount) : null,
        unit: customUnit,
      },
    ])

    if (error) {
      alert("Fel vid tillägg: " + error.message)
      return
    }

    // Återställ formulär
    setCustomName("")
    setCustomAmount("")
    setCustomUnit("st")
    setShowCustomForm(false)
    fetchItems()
  }

  // "Handlat klart" — ger användaren val hur avbockade varor ska hanteras
  async function handleCheckoutDone() {
    const checked = items.filter(i => i.checked)
    if (checked.length === 0) return

    // Dela upp avbockade i matchade (med ingredient_id) och custom
    const matched = checked.filter(i => i.ingredient_id)
    const custom = checked.filter(i => !i.ingredient_id)

    // Om inga matchade finns kan vi inte lägga något i förrådet — bara rensa
    let shouldMoveToFridge = false
    if (matched.length > 0) {
      shouldMoveToFridge = window.confirm(
        `Du har ${checked.length} avbockad${
          checked.length === 1 ? " vara" : "e varor"
        }. ` +
          `Av dessa kan ${matched.length} läggas i matförrådet automatiskt.\n\n` +
          `OK = Lägg i matförrådet och rensa från listan\n` +
          `Avbryt = Bara rensa listan (du registrerar varorna själv senare)`
      )
    } else {
      shouldMoveToFridge = window.confirm(
        `Rensa ${checked.length} avbockad${
          checked.length === 1 ? " vara" : "e varor"
        } från listan?`
      )
      if (!shouldMoveToFridge) return
      // Vid "bara rensa"-fallet för custom-only, gör inget speciellt
      shouldMoveToFridge = false
    }

    // Om användaren valt att lägga i förrådet: addera till fridge
    if (shouldMoveToFridge && matched.length > 0) {
      // Hämta befintligt förråd för att kunna addera till existerande rader
      const { data: fridgeItems, error: fridgeError } = await supabase
        .from("fridge")
        .select("id, ingredient_id, amount")

      if (fridgeError) {
        alert("Kunde inte hämta matförrådet: " + fridgeError.message)
        return
      }

      for (const item of matched) {
        const existing = fridgeItems.find(
          f => f.ingredient_id === item.ingredient_id
        )

        if (existing) {
          // Addera till existerande rad
          const newAmount =
            parseFloat(existing.amount) + parseFloat(item.amount || 0)
          await supabase
            .from("fridge")
            .update({ amount: Math.round(newAmount * 10) / 10 })
            .eq("id", existing.id)
        } else {
          // Ny rad i förrådet
          await supabase.from("fridge").insert([
            {
              user_id: session.user.id,
              ingredient_id: item.ingredient_id,
              amount: parseFloat(item.amount || 0),
            },
          ])
        }
      }
    }

    // Ta bort alla avbockade rader från listan
    const idsToDelete = checked.map(i => i.id)
    await supabase.from("shopping_list").delete().in("id", idsToDelete)

    fetchItems()
  }

  function getDisplayName(item) {
    return item.ingredients ? item.ingredients.name : item.custom_name
  }

  function getDisplayUnit(item) {
    return item.unit || (item.ingredients ? item.ingredients.canonical_unit : "")
  }

  if (loading) return <p>Laddar...</p>

  const uncheckedItems = items.filter(i => !i.checked)
  const checkedItems = items.filter(i => i.checked)

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>🛒 Inköpslista</h2>

      {/* Receptväljare — visas när showRecipePicker är true */}
      {showRecipePicker && (
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
            <button
              onClick={() => {
                setShowRecipePicker(false)
                setSelectedRecipeId("")
              }}
              style={{ flex: 1 }}
            >
              Avbryt
            </button>
            <button
              className="primary"
              onClick={confirmAddRecipe}
              disabled={!selectedRecipeId}
              style={{ flex: 1 }}
            >
              Lägg till
            </button>
          </div>
        </div>
      )}

      {/* Custom vara-formulär */}
      {showCustomForm && (
        <div className="card">
          <h3 style={{ marginBottom: "15px" }}>Lägg till egen vara</h3>

          <input
            type="text"
            placeholder="Vara (t.ex. toapapper)"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            autoFocus
          />

          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <input
              type="number"
              placeholder="Mängd (valfritt)"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <select
              value={customUnit}
              onChange={e => setCustomUnit(e.target.value)}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <option value="st">st</option>
              <option value="pkt">pkt</option>
              <option value="burk">burk</option>
              <option value="flaska">flaska</option>
              <option value="påse">påse</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="dl">dl</option>
              <option value="l">l</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                setShowCustomForm(false)
                setCustomName("")
                setCustomAmount("")
                setCustomUnit("st")
              }}
              style={{ flex: 1 }}
            >
              Avbryt
            </button>
            <button
              className="primary"
              onClick={addCustomItem}
              style={{ flex: 1 }}
            >
              Lägg till
            </button>
          </div>
        </div>
      )}

      {/* Lägg-till-knappar — visas när inget formulär är öppet */}
      {!showRecipePicker && !showCustomForm && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            className="primary"
            onClick={openRecipePicker}
            style={{ flex: 1 }}
          >
            + Från recept
          </button>
          <button
            className="primary"
            onClick={() => setShowCustomForm(true)}
            style={{ flex: 1 }}
          >
            + Egen vara
          </button>
        </div>
      )}

      <div className="card">
        {items.length === 0 ? (
          <p style={{ color: "#999" }}>
            Listan är tom. Lägg till från ett recept eller skriv in fristående
            varor.
          </p>
        ) : (
          <>
            {uncheckedItems.length > 0 && (
              <>
                <h3 style={{ marginBottom: "10px" }}>
                  Kvar att köpa ({uncheckedItems.length})
                </h3>
                {uncheckedItems.map(item => (
                  <ShoppingListRow
                    key={item.id}
                    item={item}
                    displayName={getDisplayName(item)}
                    displayUnit={getDisplayUnit(item)}
                    onToggle={() => toggleChecked(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </>
            )}

            {checkedItems.length > 0 && (
              <>
                <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
                  Köpta ({checkedItems.length})
                </h3>
                {checkedItems.map(item => (
                  <ShoppingListRow
                    key={item.id}
                    item={item}
                    displayName={getDisplayName(item)}
                    displayUnit={getDisplayUnit(item)}
                    onToggle={() => toggleChecked(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}

                <button
                  className="primary"
                  onClick={handleCheckoutDone}
                  style={{ width: "100%", marginTop: "20px", padding: "12px" }}
                >
                  ✅ Handlat klart
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ShoppingListRow({ item, displayName, displayUnit, onToggle, onDelete }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          border: `2px solid ${item.checked ? "#4CAF50" : "#ddd"}`,
          background: item.checked ? "#4CAF50" : "white",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        {item.checked && "✓"}
      </div>

      <span
        onClick={onToggle}
        style={{
          flex: 1,
          cursor: "pointer",
          textDecoration: item.checked ? "line-through" : "none",
          color: item.checked ? "#999" : "#333",
        }}
      >
        <span style={{ textTransform: "capitalize" }}>{displayName}</span>
        {item.amount && ` – ${item.amount} ${displayUnit}`}
      </span>

      <button
        className="danger"
        onClick={onDelete}
        style={{ padding: "4px 10px" }}
      >
        ✕
      </button>
    </div>
  )
}

export default ShoppingList