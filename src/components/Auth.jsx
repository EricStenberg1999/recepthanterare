import { useState } from "react"
import { supabase } from "../supabase"

function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit() {
    setLoading(true)
    setMessage("")

    if (isSignUp) {
      // Registrera nytt konto
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage("Error: " + error.message)
      } else {
        setMessage("Konto skapat! Kolla din email för att bekräfta kontot.")
      }
    } else {
      // Logga in
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage("Error: " + error.message)
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f5"
    }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
        <h2 style={{ marginBottom: "20px" }}>
          🍳 {isSignUp ? "Skapa konto" : "Logga in"}
        </h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Lösenord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {message && (
          <p style={{ color: message.includes("Error") ? "red" : "green", marginBottom: "10px" }}>
            {message}
          </p>
        )}

        <button className="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Laddar..." : isSignUp ? "Skapa konto" : "Logga in"}
        </button>

        <p
          style={{ textAlign: "center", marginTop: "15px", cursor: "pointer", color: "#4CAF50" }}
          onClick={() => { setIsSignUp(!isSignUp); setMessage("") }}
        >
          {isSignUp ? "Har du redan ett konto? Logga in" : "Inget konto? Skapa ett"}
        </p>
      </div>
    </div>
  )
}

export default Auth