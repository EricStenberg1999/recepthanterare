import { useState, useEffect } from "react"
import { supabase } from "../../supabase"
import { fromCanonical } from "../../utils/units"
import IngredientPicker from "../Fridge/IngredientPicker"
import { compressImage } from "../../utils/images"

// Skapa eller redigera ett recept.
// Props:
//   editingRecipe — recept-objekt om vi redigerar, null om nytt
//   onSaved — callback när sparning lyckats
//   onCancel — callback när användaren avbryter
function RecipeForm({ session, editingRecipe, onSaved, onCancel }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [baseServings, setBaseServings] = useState(4)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageUrl, setImageUrl] = useState(editingRecipe?.image_url || null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)

  // Lokal lista av valda ingredienser innan sparning
  // Varje post: { ingredient: {id, name, canonical_unit}, amount, input_unit }
  const [ingredients, setIngredients] = useState([])

  // Styr om IngredientPicker visas
  const [showPicker, setShowPicker] = useState(false)

  // Förifyll formuläret om vi redigerar ett befintligt recept
  useEffect(() => {
    if (editingRecipe) {
      setName(editingRecipe.name)
      setDescription(editingRecipe.description || "")
      setInstructions(editingRecipe.instructions || "")
      setBaseServings(editingRecipe.base_servings || 4)
      setImageUrl(editingRecipe.image_url || null)

      // Mappa om database-formatet till samma struktur som IngredientPicker ger oss
      const existingIngredients = editingRecipe.recipe_ingredients.map(ri => ({
        ingredient: ri.ingredients,
        amount: parseFloat(ri.amount),
        input_unit: ri.input_unit || ri.ingredients.canonical_unit,
      }))
      setIngredients(existingIngredients)
    }
  }, [editingRecipe])

  // Callback från IngredientPicker när användaren valt en ingrediens
  function handlePickerSelect({ ingredient, amount, input_unit }) {
    setIngredients(prev => {
      const existingIndex = prev.findIndex(
        i => i.ingredient.id === ingredient.id
      )

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          amount: updated[existingIndex].amount + amount,
        }
        return updated
      } else {
        return [...prev, { ingredient, amount, input_unit }]
      }
    })
  }

  async function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return

    try {
      const compressed = await compressImage(file)
      setImageFile(compressed)
      setImagePreview(URL.createObjectURL(compressed))
    } catch (err) {
      alert("Fel vid bildhantering: " + err.message)
    }
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    setImageUrl(null)
  }

  function removeIngredient(index) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  // Ladda upp bilden om det finns en ny vald, returnera publik URL
  async function uploadImageIfNeeded() {
    if (!imageFile) return imageUrl // Behåll existerande URL eller null

    setUploadingImage(true)
    const fileName = `${session.user.id}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(fileName, imageFile, {
        contentType: "image/jpeg",
      })

    if (uploadError) {
      setUploadingImage(false)
      throw new Error("Bilden kunde inte laddas upp: " + uploadError.message)
    }

    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(fileName)

    setUploadingImage(false)
    return urlData.publicUrl
  }

  async function saveRecipe() {
    if (!name.trim()) {
      alert("Receptet måste ha ett namn")
      return
    }

    setSaving(true)

    try {
      // Ladda upp bild först (om en ny valts), så vi har URL till receptet
      const finalImageUrl = await uploadImageIfNeeded()

      if (editingRecipe) {
        // --- Uppdatera befintligt recept ---
        const { error: recipeError } = await supabase
          .from("recipes")
          .update({
            name: name.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
            base_servings: baseServings,
            image_url: finalImageUrl,
          })
          .eq("id", editingRecipe.id)

        if (recipeError) {
          console.error("Fel vid uppdatering av recept:", recipeError)
          setSaving(false)
          return
        }

        // Enklast: ta bort alla gamla ingredienser och skriv om dem
        const { error: deleteError } = await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", editingRecipe.id)

        if (deleteError) {
          console.error("Fel vid borttagning av gamla ingredienser:", deleteError)
          setSaving(false)
          return
        }

        await saveIngredients(editingRecipe.id)
      } else {
        // --- Skapa nytt recept ---
        const { data: recipeData, error: recipeError } = await supabase
          .from("recipes")
          .insert([
            {
              name: name.trim(),
              description: description.trim(),
              instructions: instructions.trim(),
              source: "own",
              user_id: session.user.id,
              is_shared: false,
              base_servings: baseServings,
              image_url: finalImageUrl,
            },
          ])
          .select()

        if (recipeError) {
          console.error("Fel vid sparande av recept:", recipeError)
          setSaving(false)
          return
        }

        await saveIngredients(recipeData[0].id)
      }

      onSaved()
    } catch (err) {
      alert(err.message)
      setSaving(false)
    }
  }

  // Hjälpfunktion: spara ingredienser till ett given recipe_id
  async function saveIngredients(recipeId) {
    if (ingredients.length === 0) return

    const rows = ingredients.map(i => ({
      recipe_id: recipeId,
      ingredient_id: i.ingredient.id,
      amount: i.amount,
      input_unit: i.input_unit,
    }))

    const { error } = await supabase.from("recipe_ingredients").insert(rows)
    if (error) {
      console.error("Fel vid sparande av ingredienser:", error)
    }
  }

  return (
    <div>
      <button
        onClick={onCancel}
        style={{
          marginBottom: "15px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#4CAF50",
          fontSize: "16px",
        }}
      >
        ← Tillbaka
      </button>

      <div className="card">
        <h3 style={{ marginBottom: "15px" }}>
          {editingRecipe ? "Redigera recept" : "Nytt recept"}
        </h3>

        <input
          type="text"
          placeholder="Receptnamn"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Kort beskrivning (valfritt)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Bilduppladdning */}
        <label style={{ fontSize: "14px", color: "#666", display: "block", marginBottom: "5px" }}>
          Bild (valfritt)
        </label>
        {imagePreview || imageUrl ? (
          <div style={{ marginBottom: "15px" }}>
            <img
              src={imagePreview || imageUrl}
              alt="Förhandsvisning"
              style={{
                maxWidth: "100%",
                maxHeight: "200px",
                borderRadius: "8px",
                marginBottom: "5px",
                display: "block",
              }}
            />
            <button
              onClick={removeImage}
              style={{ width: "100%" }}
            >
              Ta bort bild
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ marginBottom: "15px" }}
          />
        )}

        {/* Antal portioner */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "15px 0 10px" }}>
          <label style={{ fontWeight: "bold" }}>Antal portioner:</label>
          <button
            onClick={() => setBaseServings(Math.max(1, baseServings - 1))}
            style={{ padding: "4px 12px" }}
            disabled={baseServings <= 1}
          >
            −
          </button>
          <span style={{ minWidth: "30px", textAlign: "center", fontWeight: "bold" }}>
            {baseServings}
          </span>
          <button
            onClick={() => setBaseServings(Math.min(12, baseServings + 1))}
            style={{ padding: "4px 12px" }}
            disabled={baseServings >= 12}
          >
            +
          </button>
        </div>

        <h4 style={{ margin: "15px 0 10px" }}>
          Ingredienser ({ingredients.length})
        </h4>

        {ingredients.length > 0 && (
          <div style={{ marginBottom: "15px" }}>
            {ingredients.map((ing, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <span>
                  <span style={{ textTransform: "capitalize" }}>
                    {ing.ingredient.name}
                  </span>
                  {" – "}
                  {fromCanonical(ing.amount, ing.input_unit, ing.ingredient.canonical_unit)} {ing.input_unit}
                </span>
                <button
                  className="danger"
                  onClick={() => removeIngredient(index)}
                  style={{ padding: "4px 10px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showPicker ? (
          <IngredientPicker
            onSelect={handlePickerSelect}
            onCancel={() => setShowPicker(false)}
            cancelLabel="Klar"
          />
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            style={{
              background: "none",
              border: "1px dashed #ccc",
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              cursor: "pointer",
              marginBottom: "15px",
            }}
          >
            + Lägg till ingrediens
          </button>
        )}

        <h4 style={{ marginBottom: "10px" }}>Instruktioner</h4>
        <textarea
          placeholder="Skriv instruktionerna här..."
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={6}
        />

        <button
          className="primary"
          onClick={saveRecipe}
          disabled={saving || uploadingImage}
          style={{ width: "100%" }}
        >
          {uploadingImage
            ? "Laddar upp bild..."
            : saving
            ? "Sparar..."
            : editingRecipe
            ? "Spara ändringar"
            : "Spara recept"}
        </button>
      </div>
    </div>
  )
}

export default RecipeForm