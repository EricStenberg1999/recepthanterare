import { useState } from "react"
import { supabase } from "../../supabase"

// Formulär för att lägga till fristående varor (toapapper, tvättmedel etc.)
// som inte finns i ingredients-tabellen.
function AddCustomItemForm({ session, onDone, onCancel }) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState("st")

  async function handleAdd() {
    if (!name.trim()) {
      alert("Ange ett namn på varan")
      return
    }

    const { error } = await supabase.from("shopping_list").insert([
      {
        user_id: session.user.id,
        custom_name: name.toLowerCase().trim(),
        amount: amount ? parseFloat(amount) : null,
        unit: unit,
      },
    ])

    if (error) {
      alert("Fel vid tillägg: " + error.message)
      return
    }

    onDone()
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: "15px" }}>Lägg till egen vara</h3>

      <input
        type="text"
        placeholder="Vara (t.ex. toapapper)"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="number"
          placeholder="Mängd (valfritt)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ flex: 1, marginBottom: 0 }}
        />
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
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
        <button onClick={onCancel} style={{ flex: 1 }}>
          Avbryt
        </button>
        <button className="primary" onClick={handleAdd} style={{ flex: 1 }}>
          Lägg till
        </button>
      </div>
    </div>
  )
}

export default AddCustomItemForm