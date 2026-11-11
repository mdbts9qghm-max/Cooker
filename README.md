# Rezeptbuch

Persönliche Rezeptbuch- und Wochenplaner-App fürs iPhone, als Web-App (PWA): Rezepte aus Instagram/TikTok erfassen, Makros berechnen, Woche planen, Einkaufsliste erzeugen und Rezepte nach MacroFactor exportieren. Kein Login, keine laufenden Kosten, alle Daten bleiben auf deinem iPhone.

## Was die App kann

- **Erfassen** über das orange Plus: **Text einfügen** (kopierte Beschreibung aus Instagram, TikTok & Co.) oder **Selber anlegen**.
- **Prüf-Bildschirm**: unsichere Erkennungen sind orange markiert, „roh oder gekocht?“ bei Reis, Nudeln, Fleisch usw., Duplikat-Hinweis.
- **Nährwerte**: zuerst die mitgelieferte Basisliste (≈210 Grundzutaten, USDA), dann Open Food Facts (Suche & Barcode-Scan), eigene Lebensmittel. Eigene Zuordnungen merkt sich die App.
- **Rezeptbuch** mit Suche, Tags, Favoriten, Sortierung (z. B. Protein pro 100 kcal), Wischen zum Löschen mit Rückgängig, Portionsrechner und Kochmodus (Bildschirm bleibt an).
- **Wochenplaner** (Frühstück/Mittag/Abend), „Passt noch rein“-Sortierung, Meal Prep, Woche kopieren, Vorlagen, eingefrorene Werte für vergangene Wochen.
- **Ziele** aus MacroFactor (schnell änderbar, optional pro Wochentag).
- **Einkaufsliste** nach Supermarkt-Bereich, Vorratsliste, „Habe ich schon“, als Text teilen.
- **MacroFactor-Export** als Link auf eine Rezeptseite mit schema.org/Recipe (JSON-LD).
- **Backup** als JSON-Datei über das Teilen-Menü, Erinnerung alle 14 Tage.
- **Offline** nutzbar (Service Worker).

## Online stellen (einmalig, kostenlos)

1. Gehe auf **vercel.com** → **Sign Up** → **Continue with GitHub** und melde dich mit deinem GitHub-Konto an.
2. Tippe auf **Add New…** → **Project**.
3. Bei **Import Git Repository** das Repository **Cooker** auswählen → **Import**.
4. Alle Einstellungen so lassen (Vercel erkennt Next.js automatisch) → **Deploy**.
5. Nach ca. 1 Minute bekommst du eine Adresse wie `https://cooker-xyz.vercel.app`. Das ist deine App.

Jede neue Änderung, die auf GitHub landet, veröffentlicht Vercel automatisch.

## Auf dem iPhone installieren

1. Öffne die Vercel-Adresse in **Safari** (nicht in Chrome).
2. Tippe unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Scrolle und tippe auf **Zum Home-Bildschirm**.
4. Name „Rezeptbuch“ lassen → **Hinzufügen**.
5. Öffne die App ab jetzt immer über das neue Symbol auf dem Home-Bildschirm. Nur dort ist sie im Vollbild, und nur dort liegen deine Daten.

Rezepte erfassen: In Instagram/TikTok die Beschreibung gedrückt halten → **Kopieren**, dann im Rezeptbuch **+** → **Text einfügen**. Oder **+** → **Selber anlegen**.

## Backup

Einstellungen → **Backup erstellen** → im Teilen-Menü **In Dateien sichern** → iCloud Drive. Wiederherstellen über **Aus Backup wiederherstellen**. Wichtig, weil es keine Cloud gibt: Wenn du die App vom Home-Bildschirm löschst, sind auch die Daten weg.

## Für Entwickler

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Parser-, Makro- und Export-Tests (Vitest)
npm run build
```

- Next.js (App Router), TypeScript, Tailwind CSS 4, Dexie (IndexedDB)
- `lib/parser.ts`: regelbasierter Caption-Parser (Deutsch + Englisch)
- `lib/foods-base.ts`: Basisliste der Grundzutaten
- `lib/nutrition.ts`: Lebensmittel-Zuordnung und Makroberechnung
- `lib/macrofactor.ts`: Export-Link (lz-string) und JSON-LD
- `app/api/tiktok`: TikTok-oEmbed, `app/api/food`: Open-Food-Facts-Proxy, `app/r/[data]`: Rezeptseite für MacroFactor
- `public/sw.js`: Service Worker für Offline-Nutzung

Nährwertdaten: USDA FoodData Central (gemeinfrei), Open Food Facts (ODbL).
