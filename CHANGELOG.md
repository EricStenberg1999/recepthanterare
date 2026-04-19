# Changelog

Alla större ändringar i recepthanteraren dokumenteras här.

Formatet följer [Keep a Changelog](https://keepachangelog.com/),
och projektet använder [Semantic Versioning](https://semver.org/).

## [v1.1] - 2026-04-18

### Added
- Kategori-filter i matförrådet (Alla / Kyl / Frys / Skafferi) med antalsräknare
- Portionsskalning på recept: ange antal portioner vid skapande, skala upp/ner i detaljvyn med +/– knappar (1-12)
- "Laga recept"-knapp som drar ingredienser från matförrådet baserat på valda portioner
- Varning om ingredienser saknas innan lagning kan ske
- Ändrade emoji i Recepthanterare till 👨‍🍳
- Favoriter på recept med ny `favorites`-tabell och RLS-policy
- Hjärt-ikon på receptlistan och i detaljvyn för att markera favoriter
- Ny "Favoriter"-tab som visar favoritmarkerade recept (både egna och delade)
- Persistent inköpslista som sparas i databasen (`shopping_list`-tabell)
- "Lägg till från recept" — väljer recept och portioner, lägger bara till det som saknas i Matförrådet
- "Lägg till egen vara" — fristående varor som toapapper med flexibla enheter
- Kombinering: samma ingrediens från olika recept adderas till en rad
- "Handlat klart"-knapp som kan flytta avbockade varor direkt till Matförrådet

## Changed
- Bytt namn från "Kylen" till "Mitt Matförråd"
- Bytt emoji från 🧊 till 🧺 för att bättre representera kyl, frys och skafferi
- Flik-namn förkortade till "Mina" / "Delade" för att ge plats åt favoriter-tabben
- "Laga recept"-knappen använder 👨‍🍳 för att skilja sig från 📖 (receptsektionen)
- Inköpslistan är nu persistent istället för dynamiskt genererad per recept

### Known issues
- Om flera recept använder samma ingrediens räknas Matförrådet mot varje recept separat, vilket kan leda till att inköpslistan visar färre varor än totalbehovet. Planerad fix i v1.2.

## [1.0.0] - 2026-04-18

### Added
- Ingredients master-tabell med canonical units för konsekvent matchning
- IngredientPicker-komponent (sök, kategorifilter, mängd- och enhetsval)
- Receptsektion uppdelad i fyra komponenter (Recipes, RecipeForm, RecipeDetail, RecipeListItem)
- Centraliserad enhetskonvertering i `utils/units.js`
- Edge-case för recept utan ingredienser i Inköpslistan

### Changed
- Fridge och recept använder nu `ingredient_id` (FK) istället för fritext
- ShoppingList matchar via `ingredient_id`, ingen manuell enhetskonvertering längre
- RLS-policies uppdaterade till `authenticated` istället för `public`

### Fixed
- Kyl som visade alla användares innehåll

## [0.x] - Innan 1.0

- Shared recipes (is_shared-flagga)
- Personlig inköpslista
- Receptredigering
- Grundläggande struktur: Kyl, Recept, Förslag, Inköpslista
- Supabase Auth med email/lösenord

## [Unreleased]

### Added

## Changed

### Fixed

## Removed

## Security