// En klickbar rad i receptlistan.
// Håller sig enkel — bara presentation, ingen data-logik.
function RecipeListItem({ recipe, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "15px 0",
        borderBottom: "1px solid #f0f0f0",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <strong>{recipe.name}</strong>
        {recipe.is_shared && (
          <span
            style={{
              fontSize: "12px",
              color: "#4CAF50",
              marginLeft: "8px",
            }}
          >
            ● Delat
          </span>
        )}
        {recipe.description && (
          <p
            style={{
              color: "#666",
              fontSize: "13px",
              marginTop: "3px",
            }}
          >
            {recipe.description}
          </p>
        )}
      </div>
      <span style={{ color: "#ccc" }}>→</span>
    </div>
  )
}

export default RecipeListItem