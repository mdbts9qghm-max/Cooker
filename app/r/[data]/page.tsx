import type { Metadata } from "next";
import { decodePayload, jsonLd } from "@/lib/macrofactor";

type Props = { params: Promise<{ data: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await params;
  const p = decodePayload(data);
  return {
    title: p ? p.t : "Rezept",
    robots: { index: false, follow: false },
  };
}

/** Schlichte, maschinenlesbare Rezeptseite für den MacroFactor-Import (schema.org/Recipe). */
export default async function RecipeExportPage({ params }: Props) {
  const { data } = await params;
  const p = decodePayload(data);
  if (!p) {
    return (
      <main style={S.main}>
        <h1>Link ungültig</h1>
        <p>Dieser Rezept-Link konnte nicht gelesen werden.</p>
      </main>
    );
  }
  const [kcal, protein, fat, carbs, fiber] = p.n;
  return (
    <main style={S.main}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(p)).replace(/</g, "\\u003c") }} />
      <article itemScope itemType="https://schema.org/Recipe">
        <h1 itemProp="name" style={S.h1}>{p.t}</h1>
        <p style={S.muted}>
          <span itemProp="recipeYield">{p.s} {p.s === 1 ? "Portion" : "Portionen"}</span>
        </p>
        <section style={S.card}>
          <h2 style={S.h2}>Pro Portion</h2>
          <p style={S.macros}>
            {kcal} kcal · {protein} g Protein · {carbs} g KH · {fat} g Fett · {fiber} g Ballaststoffe
          </p>
        </section>
        <h2 style={S.h2}>Zutaten</h2>
        <ul style={S.list}>
          {p.i.map(([g, name], i) => (
            <li key={i} itemProp="recipeIngredient">{g} g {name}</li>
          ))}
        </ul>
        {p.p.length > 0 && (
          <>
            <h2 style={S.h2}>Zubereitung</h2>
            <ol style={S.list}>
              {p.p.map((s, i) => (
                <li key={i} itemProp="recipeInstructions">{s}</li>
              ))}
            </ol>
          </>
        )}
      </article>
    </main>
  );
}

const S = {
  main: { maxWidth: 640, margin: "0 auto", padding: "32px 20px 64px", fontFamily: "-apple-system, system-ui, sans-serif", lineHeight: 1.5 },
  h1: { fontSize: 28, margin: "0 0 4px" },
  h2: { fontSize: 15, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6, margin: "28px 0 8px" },
  muted: { opacity: 0.6, margin: 0 },
  card: { background: "rgba(255,107,26,0.1)", borderRadius: 16, padding: "4px 16px 12px", marginTop: 20 },
  macros: { fontVariantNumeric: "tabular-nums", fontWeight: 600, margin: 0 },
  list: { paddingLeft: 20 },
} as const;
