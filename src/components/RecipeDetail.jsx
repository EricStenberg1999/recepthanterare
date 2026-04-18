// Detaljvy för ett enskilt recept.
// Får allt den behöver via props — ingen egen data-logik, bara visning.
function RecipeDetail({
  recipe,
  isOwner,
  onBack,
  onEdit,
  onDelete,
  onToggleShare,
}) {
  return (
    <div>
      <button
        onClick={onBack}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <h2>{recipe.name}</h2>
          {isOwner && (
            <button
              onClick={onToggleShare}
              style={{
                background: recipe.is_shared ? "#4CAF50" : "none",
                border: "1px solid #4CAF50",
                color: recipe.is_shared ? "white" : "#4CAF50",
                padding: "6px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              {recipe.is_shared ? "✓ Delat" : "Dela recept"}
            </button>
          )}
        </div>

        {recipe.description && (
          <p style={{ color: "#666", margin: "10px 0" }}>
            {recipe.description}
          </p>
        )}

        <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
          Ingredienser
        </h3>
        {recipe.recipe_ingredients.map(ing => (
          <div
            key={ing.id}
            style={{
              padding: "5px 0",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <span style={{ textTransform: "capitalize" }}>
              {ing.ingredients.name}
            </span>
            {ing.amount && ` – ${ing.amount} ${ing.ingredients.canonical_unit}`}
          </div>
        ))}

        {recipe.instructions && (
          <>
            <h3 style={{ marginTop: "20px", marginBottom: "10px" }}>
              Instruktioner
            </h3>
            <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
              {recipe.instructions}
            </p>
          </>
        )}

        {isOwner && (
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button className="primary" onClick={onEdit}>
              Redigera recept
            </button>
            <button className="danger" onClick={onDelete}>
              Ta bort recept
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecipeDetail