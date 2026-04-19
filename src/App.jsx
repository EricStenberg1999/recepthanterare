import { useState, useEffect } from "react"
import "./App.css"
import { supabase } from "./supabase"
import Auth from "./components/Auth"
import Fridge from "./components/Fridge/Fridge"
import Recipes from "./components/Recipe/Recipes"
import Suggestions from "./components/Suggestions"
import ShoppingList from "./components/ShoppingList/ShoppingList"

function App() {
  const [activePage, setActivePage] = useState("fridge")
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Kolla om användaren redan är inloggad
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Lyssna på inloggning/utloggning
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) return <p style={{ padding: "20px" }}>Laddar...</p>

  // Visa inloggningssidan om användaren inte är inloggad
  if (!session) return <Auth />

  return (
    <div className="app">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>👨‍🍳 Recepthanterare</h1>
        <button
          onClick={handleSignOut}
          style={{ background: "none", border: "1px solid #ddd", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", color: "#666" }}
        >
          Logga ut
        </button>
      </div>

      {/* Navigation */}
      <nav className="nav">
        <button
          className={activePage === "fridge" ? "active" : ""}
          onClick={() => setActivePage("fridge")}
        >
          🧺 Mitt Matförråd
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
          className={activePage === "shopping" ? "active" : ""}
          onClick={() => setActivePage("shopping")}
        >
          🛒 Inköpslista
        </button>
      </nav>

      {activePage === "fridge" && <Fridge session={session} />}
      {activePage === "recipes" && <Recipes session={session} />}
      {activePage === "suggestions" && <Suggestions />}
      {activePage === "shopping" && <ShoppingList session={session}/>} 
    </div>
  )
}

export default App