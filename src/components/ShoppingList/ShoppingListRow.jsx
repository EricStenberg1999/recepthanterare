// En rad i inköpslistan — cirkel för avbockning, namn + mängd, radera-knapp
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

export default ShoppingListRow