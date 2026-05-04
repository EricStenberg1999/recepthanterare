# Changelog

Alla större ändringar i recepthanteraren dokumenteras här.

Formatet följer [Keep a Changelog](https://keepachangelog.com/),
och projektet använder [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.0] - 2026-04-21

### Added
- Rate limiting på `/api/import-recipe`: 30 imports/timme globalt, 10/dag per användare
- "Skapa ny ingrediens"-knapp i IngredientPicker när sökning ger 0 träffar — användare kan lägga till nya ingredienser direkt
- `fromCanonical()` i `utils/units.js` för att konvertera canonical-mängder tillbaka till display-enhet
- Nya ingredienser i master-listan: vispgrädde, matlagningsgrädde, ströbröd, florsocker, färska blåbär, färska hallon, färska jordgubbar
- Stöd för ingredienser utan mängd (t.ex. "smör till formen") i recept

### Changed
- URL-import-prompten förbättrad markant:
  - AI behåller nu originalenheter från receptet (1.5 dl, inte 1.5 g)
  - Smartare portionsuppskattning ("8 bitar" tolkas som ~4 portioner)
  - Inkluderar ingredienser utan specifik mängd
  - Bättre intelligent matchning (vispgrädde, färska bär etc.)
- Recept visar nu `input_unit` istället för `canonical_unit` — "0.5 tsk chilipeppar" visas som "0.5 tsk", inte "0.025 dl"

### Fixed
- Unique-constraint på `recipe_ingredients` borttaget — samma ingrediens kan nu legitimt finnas flera gånger i ett recept (t.ex. smör i smet + smör till formen)

### Security
- Anthropic API-nyckel roterad proaktivt efter Vercel-incidenten april 2026 (alla kritiska env vars var redan markerade "sensitive" och oberörda)

## [1.2.0] - 2026-04-20

### Added
- Importera recept från URL via AI (Anthropic Claude Haiku 4.5)
- Vercel Serverless backend (`/api/import-recipe`) för säker API-nyckelhantering

### Changed
- Komponenter omorganiserade i mappar (Fridge/, Recipe/, ShoppingList/)
- ShoppingList uppdelad i fyra separata komponenter ShoppingList, ShoppingListRow

## [1.1.1] - 2026-04-19

### Fixed
- Egna recept läggs till korrekt i inköpslistan 

## [1.1.0] - 2026-04-18

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

### Changed
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