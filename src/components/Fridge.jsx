import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import IngredientPicker from "./IngredientPicker"

function Fridge({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("innehåll")

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from("fridge")
      .select(`
        id,
        amount,
        expiry_date,
        ingredients (
          id,
          name,
          canonical_unit,
          category
        )
      `)
      .order("id")

    if (error) {
      console.error("Fel vid hämtning:", error)
    } else {
      setItems(data)
    }
    setLoading(false)
  }

  async function handleAdd({ ingredient, amount }) {
    const existing = items.find(
      item => item.ingredients.id === ingredient.id
    )

    if (existing) {
      const newAmount = parseFloat(existing.amount) + amount

      const { error } = await supabase
        .from("fridge")
        .update({ amount: newAmount })
        .eq("id", existing.id)

      if (error) {
        console.error("Fel vid uppdatering:", error)
        return
      }
    } else {
      const { error } = await supabase.from("fridge").insert([
        {
          ingredient_id: ingredient.id,
          amount: amount,
          user_id: session.user.id,
        },
      ])

      if (error) {
        console.error("Fel vid tillägg:", error)
        return
      }
    }

    fetchItems()
  }

  async function deleteItem(id) {
    const { error } = await supabase.from("fridge").delete().eq("id", id)
    if (error) {
      console.error("Fel vid borttagning:", error)
    } else {
      fetchItems()
    }
  }

  if (loading) return <p>Laddar...</p>

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>🧊 Mitt kylskåp</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("innehåll")}
          className={activeTab === "innehåll" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          I kylen ({items.length})
        </button>
        <button
          onClick={() => setActiveTab("lägg-till")}
          className={activeTab === "lägg-till" ? "primary" : ""}
          style={{ flex: 1 }}
        >
          + Lägg till
        </button>
      </div>

      {/* Vyn beror på aktiv tab */}
      {activeTab === "lägg-till" ? (
        <IngredientPicker onSelect={handleAdd} />
      ) : (
        <div className="card">
          {items.length === 0 ? (
            <p style={{ color: "#999" }}>
              Kylen är tom – gå till "Lägg till" för att börja fylla på!
            </p>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <span>
                  <span style={{ textTransform: "capitalize" }}>
                    {item.ingredients.name}
                  </span>
                  {" – "}
                  {item.amount} {item.ingredients.canonical_unit}
                </span>
                <button className="danger" onClick={() => deleteItem(item.id)}>
                  Ta bort
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Fridge