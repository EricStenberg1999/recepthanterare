import { useState, useEffect } from "react"
import { supabase } from "../supabase"

// Tillgängliga enheter i appen
const UNITS = ["st", "g", "kg", "dl", "l", "msk", "tsk", "krm", "nypa"]

function Fridge() {
  const [items, setItems] = useState([])
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState("st")
  const [loading, setLoading] = useState(true)

  // Hämta alla ingredienser från databasen när komponenten laddas
  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from("fridge")
      .select("*")
      .order("ingredient_name")

    if (error) {
      console.error("Fel vid hämtning:", error)
    } else {
      setItems(data)
    }
    setLoading(false)
  }

  // Lägg till eller uppdatera en ingrediens i kylen
async function addItem() {
  if (!name.trim()) return

  // Kolla om ingrediensen redan finns i kylen
  const existing = items.find(
    item => item.ingredient_name.toLowerCase() === name.toLowerCase().trim()
  )

  if (existing) {
    // Uppdatera befintlig ingrediens
    const { error } = await supabase
      .from("fridge")
      .update({
        amount: amount ? parseFloat(amount) : null,
        unit: unit
      })
      .eq("id", existing.id)

    if (error) {
      console.error("Fel vid uppdatering:", error)
    }
  } else {
    // Lägg till ny ingrediens
    const { error } = await supabase
      .from("fridge")
      .insert([{
        ingredient_name: name.toLowerCase().trim(),
        amount: amount ? parseFloat(amount) : null,
        unit: unit,
        user_id: "default"
      }])

    if (error) {
      console.error("Fel vid tillägg:", error)
    }
  }

  // Rensa formuläret och uppdatera listan
  setName("")
  setAmount("")
  setUnit("st")
  fetchItems()
}

  // Ta bort en ingrediens från kylen
  async function deleteItem(id) {
    const { error } = await supabase
      .from("fridge")
      .delete()
      .eq("id", id)

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

      {/* Formulär för att lägga till ingrediens */}
      <div className="card">
        <h3 style={{ marginBottom: "15px" }}>Lägg till ingrediens</h3>
        <input
          type="text"
          placeholder="Ingrediens, t.ex. mjölk"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="number"
            placeholder="Mängd"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ flex: 1 }}
          >
            {UNITS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <button className="primary" onClick={addItem}>
          + Lägg till
        </button>
      </div>

      {/* Lista över vad som finns i kylen */}
      <div className="card">
        <h3 style={{ marginBottom: "15px" }}>I kylen just nu</h3>
        {items.length === 0 ? (
          <p style={{ color: "#999" }}>Kylen är tom – lägg till något!</p>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #f0f0f0"
              }}
            >
              <span>
                {item.ingredient_name}
                {item.amount && ` – ${item.amount} ${item.unit}`}
              </span>
              <button className="danger" onClick={() => deleteItem(item.id)}>
                Ta bort
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Fridge