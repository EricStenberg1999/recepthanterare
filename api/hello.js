// Enkel serverless function som testar att Vercel-pipelinen fungerar
export default function handler(req, res) {
  res.status(200).json({
    message: "Hello från Vercel Serverless!",
    timestamp: new Date().toISOString(),
  })
}