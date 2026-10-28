import { createClient } from "@supabase/supabase-js"

// Keep-alive: körs dagligen av Vercel Cron (se vercel.json).
// Gör en minimal databasfråga så att Supabase registrerar aktivitet
// och inte pauser projektet efter 7 dagars inaktivitet

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
    /* Vercel skickar automatiskt "Authorization: Bearer <CRON_SECRET>"
    när CRON_SECRET finns som miljövariabel. Allt annat avvisas. */
    const secret = process.env.CRON_SECRET
    if (secret && req.headers.authorization !== 'Bearer ${secret}') {
        return res.status(401).json({ error: "Unauthorized"})
    }

    /* head: true = hämta bara antalet rader, ingen data. Billigaste möjliga fråga. */
    const { count, error } = await supabaseAdmin
    .from("ingredients")
    .select("*", { count: "exact", head: true})

    if (error) {
        console.error("Keep-alive misslyckades:", error)
        return res.status(500).json({ ok: false, error: error.message})
    }
    
    res.status(200).json({
        ok: true,
        ingredients: count,
        timestamp: new Date().toISOString(),
    })
}