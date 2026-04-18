// Konverteringsfaktorer till canonical units.
// Struktur: { canonical_unit: { input_unit: faktor } }
// Faktorn är hur många av canonical_unit som 1 av input_unit motsvarar.
// Ex: 1 l = 10 dl, alltså UNITS.dl.l = 10

export const UNIT_CONVERSIONS = {
  // Volym-baserade ingredienser (canonical = dl)
  dl: {
    dl: 1,
    l: 10,
    ml: 0.01,
    msk: 0.15,    // 1 msk = 15 ml = 0.15 dl
    tsk: 0.05,    // 1 tsk = 5 ml = 0.05 dl
    krm: 0.01,    // 1 krm = 1 ml = 0.01 dl
  },
  // Vikt-baserade ingredienser (canonical = g)
  g: {
    g: 1,
    kg: 1000,
  },
  // Räkne-baserade (canonical = st) — ingen konvertering
  st: {
    st: 1,
  },
}

// Vilka input-enheter ska användaren få välja bland, beroende på canonical_unit?
export const ALLOWED_INPUT_UNITS = {
  dl: ["dl", "l", "ml", "msk", "tsk", "krm"],
  g: ["g", "kg"],
  st: ["st"],
}

// Konvertera ett värde från användarens input-enhet till canonical-enhet
// Ex: toCanonical(1, "l", "dl") → 10
export function toCanonical(amount, inputUnit, canonicalUnit) {
  const factor = UNIT_CONVERSIONS[canonicalUnit]?.[inputUnit]
  if (factor === undefined) {
    console.error(`Ingen konvertering: ${inputUnit} → ${canonicalUnit}`)
    return amount // Fallback: anta att de är samma
  }
  return amount * factor
}