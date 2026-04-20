import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { ALLOWED_INPUT_UNITS, toCanonical } from "../../utils/units"

const CATEGORIES = ["alla", "kyl", "frys", "skafferi"]
const INITIAL_VISIBLE = 12

function IngredientPicker({ onSelect, onCancel, cancelLabel = "Avbryt" }) {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("alla")
  const [showAll, setShowAll] = useState(false)

  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState("")
  const [inputUnit, setInputUnit] = useState("")

  // Skapa-ny-ingrediens state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("kyl")
  const [newUnit, setNewUnit] = useState("g")
  const [newUnitType, setNewUnitType] = useState("weight")

  useEffect(() => {
    async function fetchIngredients() {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .order("name")

      if (error) {
        console.error("Fel vid hämtning av ingredienser:", error)
      } else {
        setIngredients(data)
      }
      setLoading(false)
    }
    fetchIngredients()
  }, [])

  function handleSelect(ingredient) {
    setSelected(ingredient)
    setInputUnit(ingredient.canonical_unit)
    setAmount("")
  }

  // Starta skapa-ny-formuläret med söktexten som default-namn
  function openCreateForm() {
    setNewName(search.trim())
    setShowCreateForm(true)
  }

  // Skapa ny ingrediens i master-listan, lägg till i local state,
  // och välj den direkt så användaren kan ange mängd
  async function handleCreateNew() {
    const trimmedName = newName.toLowerCase().trim()
    if (!trimmedName) {
      alert("Ange ett namn")
      return
    }

    // Kolla om den redan finns (case-insensitive)
    const existing = ingredients.find(
      i => i.name.toLowerCase() === trimmedName
    )
    if (existing) {
      alert(`"${trimmedName}" finns redan i listan — välj den istället.`)
      setShowCreateForm(false)
      return
    }

    const { data, error } = await supabase
      .from("ingredients")
      .insert([
        {
          name: trimmedName,
          canonical_unit: newUnit,
          unit_type: newUnitType,
          category: newCategory,
        },
      ])
      .select()

    if (error) {
      alert("Fel vid skapande: " + error.message)
      return
    }

    const newIngredient = data[0]

    // Lägg till i local state så den visas direkt
    setIngredients([...ingredients, newIngredient].sort((a, b) =>
      a.name.localeCompare(b.name)
    ))

    // Stäng formuläret, välj direkt så användaren kan ange mängd
    setShowCreateForm(false)
    setNewName("")
    setSearch("")
    handleSelect(newIngredient)
  }

  // När unit_type ändras, sätt default-unit till den första giltiga
  function handleUnitTypeChange(type) {
    setNewUnitType(type)
    if (type === "weight") setNewUnit("g")
    else if (type === "volume") setNewUnit("dl")
    else setNewUnit("st")
  }

  function handleConfirm() {
    if (!amount || parseFloat(amount) <= 0) return

    const canonicalAmount = toCanonical(
      parseFloat(amount),
      inputUnit,
      selected.canonical_unit
    )

    onSelect({
      ingredient: selected,
      amount: canonicalAmount,
      input_unit: inputUnit,
    })

    setSelected(null)
    setAmount("")
    setInputUnit("")
    setSearch("") // Rensa sökfältet så man kan söka nästa ingrediens direkt
  }

  function handleCancelSelection() {
    setSelected(null)
    setAmount("")
    setInputUnit("")
  }

  function updateSearch(value) {
    setSearch(value)
    setShowAll(false)
  }

  function updateCategory(cat) {
    setCategory(cat)
    setShowAll(false)
  }

  function clearSearch() {
    setSearch("")
    setShowAll(false)
  }

  const filtered = ingredients.filter(ing => {
    const matchesSearch = ing.name
      .toLowerCase()
      .includes(search.toLowerCase().trim())
    const matchesCategory = category === "alla" || ing.category === category
    return matchesSearch && matchesCategory
  })

  const isSearching = search.trim().length > 0
  const visible = isSearching || showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE)
  const hasMore = !isSearching && !showAll && filtered.length > INITIAL_VISIBLE
  const canCollapse = !isSearching && showAll && filtered.length > INITIAL_VISIBLE

  if (loading) return <p>Laddar ingredienser...</p>

  // --- VY 3: Skapa ny ingrediens ---
  if (showCreateForm) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: "15px" }}>Skapa ny ingrediens</h3>

        <label style={{ fontSize: "14px", color: "#666" }}>Namn</label>
        <input
          type="text"
          placeholder="Ingrediens (lowercase)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          autoFocus
        />

        <label style={{ fontSize: "14px", color: "#666" }}>
          Förvaras i
        </label>
        <select
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
        >
          <option value="kyl">Kyl</option>
          <option value="frys">Frys</option>
          <option value="skafferi">Skafferi</option>
        </select>

        <label style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
          Mäts i
        </label>
        <select
          value={newUnitType}
          onChange={e => handleUnitTypeChange(e.target.value)}
        >
          <option value="weight">Vikt (g, kg)</option>
          <option value="volume">Volym (dl, l, msk)</option>
          <option value="count">Antal (st)</option>
        </select>

        <label style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
          Standardenhet
        </label>
        <select
          value={newUnit}
          onChange={e => setNewUnit(e.target.value)}
        >
          {newUnitType === "weight" && (
            <>
              <option value="g">gram (g)</option>
              <option value="kg">kilogram (kg)</option>
            </>
          )}
          {newUnitType === "volume" && (
            <>
              <option value="dl">deciliter (dl)</option>
              <option value="l">liter (l)</option>
              <option value="ml">milliliter (ml)</option>
            </>
          )}
          {newUnitType === "count" && <option value="st">styck (st)</option>}
        </select>

        <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
          <button
            onClick={() => {
              setShowCreateForm(false)
              setNewName("")
            }}
            style={{ flex: 1 }}
          >
            Avbryt
          </button>
          <button
            className="primary"
            onClick={handleCreateNew}
            style={{ flex: 1 }}
          >
            Skapa
          </button>
        </div>
      </div>
    )
  }

  // --- VY 2: Mängd- och enhetsformulär ---
  if (selected) {
    const allowedUnits = ALLOWED_INPUT_UNITS[selected.canonical_unit] || [
      selected.canonical_unit,
    ]

    return (
      <div className="card">
        <h3 style={{ marginBottom: "15px", textTransform: "capitalize" }}>
          {selected.name}
        </h3>
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            type="number"
            placeholder="Mängd"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ flex: 1 }}
            autoFocus
          />
          <select
            value={inputUnit}
            onChange={e => setInputUnit(e.target.value)}
            style={{ flex: 1 }}
          >
            {allowedUnits.map(u => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleCancelSelection} style={{ flex: 1 }}>
            ← Tillbaka
          </button>
          <button
            className="primary"
            onClick={handleConfirm}
            style={{ flex: 1 }}
          >
            Lägg till
          </button>
        </div>
      </div>
    )
  }

  // --- VY 1: Sök och välj ingrediens ---
  return (
    <div className="card">
      {/* Sökrad med rensa-kryss och stängningsknapp bredvid */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            placeholder="🔍 Sök ingrediens..."
            value={search}
            onChange={e => updateSearch(e.target.value)}
            style={{
              width: "100%",
              marginBottom: 0,
              paddingRight: search ? "35px" : undefined,
            }}
          />
          {search && (
            <button
              onClick={clearSearch}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#999",
                fontSize: "18px",
                padding: "0 4px",
                lineHeight: 1,
              }}
              aria-label="Rensa sökning"
            >
              ✕
            </button>
          )}
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: "#4CAF50",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              padding: "0 8px",
              whiteSpace: "nowrap",
            }}
          >
            {cancelLabel}
          </button>
        )}
      </div>

      {/* Kategori-tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "15px", flexWrap: "wrap" }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => updateCategory(cat)}
            className={category === cat ? "primary" : ""}
            style={{ flex: 1, textTransform: "capitalize" }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <p style={{ color: "#999", marginBottom: "10px" }}>
            Inga ingredienser matchar.
          </p>
          {isSearching && (
            <button
              className="primary"
              onClick={openCreateForm}
              style={{ width: "100%" }}
            >
              + Skapa "{search.trim()}" som ny ingrediens
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "10px",
          }}
        >
          {visible.map(ing => (
            <button
              key={ing.id}
              onClick={() => handleSelect(ing)}
              style={{
                padding: "15px 10px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                background: "#fff",
                cursor: "pointer",
                textAlign: "center",
                textTransform: "capitalize",
              }}
            >
              {ing.name}
            </button>
          ))}
        </div>
      )}

      {/* Visa fler / Visa mindre */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            background: "none",
            border: "1px dashed #ccc",
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            cursor: "pointer",
            marginTop: "15px",
          }}
        >
          Visa fler ({filtered.length - INITIAL_VISIBLE}+)
        </button>
      )}
      {canCollapse && (
        <button
          onClick={() => setShowAll(false)}
          style={{
            background: "none",
            border: "1px dashed #ccc",
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            cursor: "pointer",
            marginTop: "15px",
          }}
        >
          Visa mindre
        </button>
      )}
    </div>
  )
}

export default IngredientPicker