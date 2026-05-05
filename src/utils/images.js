// Komprimera och skala om en bild innan uppladdning.
// Använder Canvas API som finns inbyggt i webbläsaren — inga npm-paket behövs.
//
// Default: max 1200px på längsta sidan, JPEG kvalitet 0.8 (=80%).
// Det ger oftast filer på 100-300 KB även från en 12MP-kamerabild.

export async function compressImage(file, options = {}) {
  const {
    maxDimension = 1200,
    quality = 0.8,
    mimeType = "image/jpeg",
  } = options

  // Validera att det är en bild
  if (!file.type.startsWith("image/")) {
    throw new Error("Filen är inte en bild")
  }

  // Ladda bilden
  const img = await loadImage(file)

  // Räkna ut nya dimensioner som behåller proportionerna
  let { width, height } = img
  if (width > height) {
    if (width > maxDimension) {
      height = (height * maxDimension) / width
      width = maxDimension
    }
  } else {
    if (height > maxDimension) {
      width = (width * maxDimension) / height
      height = maxDimension
    }
  }

  // Rita bilden på en canvas i nya storleken
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0, width, height)

  // Konvertera canvas till komprimerad blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error("Kunde inte skapa bild-blob"))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}

// Hjälpare: läs en File och returnera som Image-element
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Kunde inte ladda bilden"))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error("Kunde inte läsa filen"))
    reader.readAsDataURL(file)
  })
}