import { useState } from "react"
import "./App.css"
import Fridge from "./components/Fridge"
import Recipes from "./components/Recipes"
import Suggestions from "./components/Suggestions"
import ShoppingList from "./components/ShoppingList"

function App() {
  const [activePage, setActivePage] = useState("fridge")

  return (
    <div className="app">
      <h1 style={{ marginBottom: "20px" }}>🍳 Recepthanterare</h1>
      <nav className="nav">
        <button
        className={activePage === "fridge" ? "active" : ""}
        onClick={() => setActivePage("fridge")}
        >
          🧊 Kylen
        </button>
        <button
          className={activePage === "recipes" ? "active" : ""}
          onClick={() => setActivePage("recipes")}
          >
          📖 Recept
        </button>
        <button
        className={activePage === "suggestions" ? "active" : ""}
        onClick={() => setActivePage("suggestions")}
        >
          ✨ Förslag
        </button>
        <button
        className={activePage === "shopping" ? "active": ""}
        onClick={() => setActivePage("shopping")}
        >
          🛒 Inköpslista
        </button>
      </nav>

      {activePage === "fridge" && <Fridge/>}
      {activePage === "recipes" && <Recipes />}
      {activePage === "suggestions" && <Suggestions />}
      {activePage === "shopping" && <ShoppingList />}
    </div>
  )
}
export default App