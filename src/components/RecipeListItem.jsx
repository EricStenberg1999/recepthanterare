// En klickbar rad i receptlistan med favorit-knapp.
function RecipeListItem({ recipe, isFavorite, onClick, onToggleFavorite }) {
  // Stoppa klick-propagering så favorit-knappen inte öppnar detaljvyn
  function handleFavoriteClick(e) {
    e.stopPropagation()
    onToggleFavorite()
  }

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
        gap: "12px",
      }}
    >
      <div style={{ flex: 1 }}>
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

      {/* Favoritknapp — stoppar propagation så att klick på hjärtat inte öppnar detaljvyn */}
      <button
        onClick={handleFavoriteClick}
        aria-label={isFavorite ? "Ta bort från favoriter" : "Lägg till i favoriter"}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "22px",
          padding: "4px 8px",
          lineHeight: 1,
        }}
      >
        {isFavorite ? "❤️" : "🤍"}
      </button>

      <span style={{ color: "#ccc" }}>→</span>
    </div>
  )
}

export default RecipeListItem