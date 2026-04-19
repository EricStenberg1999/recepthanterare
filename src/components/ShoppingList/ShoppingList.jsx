import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import ShoppingListRow from "./ShoppingListRow.jsx"
import AddFromRecipeForm from "./AddFromRecipeForm.jsx"
import AddCustomItemForm from "./AddCustomItemForm.jsx"

function ShoppingList({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)

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

  // "Handlat klart" — frågar hur avbockade varor ska hanteras
  async function handleCheckoutDone() {
    const checked = items.filter(i => i.checked)
    if (checked.length === 0) return

    const matched = checked.filter(i => i.ingredient_id)
    const custom = checked.filter(i => !i.ingredient_id)

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
      shouldMoveToFridge = false
    }

    if (shouldMoveToFridge && matched.length > 0) {
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
          const newAmount =
            parseFloat(existing.amount) + parseFloat(item.amount || 0)
          await supabase
            .from("fridge")
            .update({ amount: Math.round(newAmount * 10) / 10 })
            .eq("id", existing.id)
        } else {
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

      {showRecipePicker && (
        <AddFromRecipeForm
          session={session}
          onDone={() => {
            setShowRecipePicker(false)
            fetchItems()
          }}
          onCancel={() => setShowRecipePicker(false)}
        />
      )}

      {showCustomForm && (
        <AddCustomItemForm
          session={session}
          onDone={() => {
            setShowCustomForm(false)
            fetchItems()
          }}
          onCancel={() => setShowCustomForm(false)}
        />
      )}

      {!showRecipePicker && !showCustomForm && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            className="primary"
            onClick={() => setShowRecipePicker(true)}
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

export default ShoppingList