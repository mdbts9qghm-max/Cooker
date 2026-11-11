import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UA = "Rezeptbuch-App/1.0 (private recipe app)";
const FIELDS = "code,product_name,product_name_de,brands,nutriments,serving_quantity,quantity";

type OFFProduct = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

function n(v: unknown): number {
  const x = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : 0;
}

function normalize(p: OFFProduct) {
  const nu = p.nutriments ?? {};
  const kcal = n(nu["energy-kcal_100g"]) || Math.round(n(nu["energy_100g"]) / 4.184);
  const name = (p.product_name_de || p.product_name || "").trim();
  if (!name || (!kcal && !n(nu.proteins_100g))) return null;
  return {
    id: p.code ?? name,
    name,
    brand: (p.brands ?? "").split(",")[0]?.trim() || undefined,
    barcode: p.code,
    per100: {
      kcal,
      protein: n(nu.proteins_100g),
      carbs: n(nu.carbohydrates_100g),
      fat: n(nu.fat_100g),
      fiber: n(nu.fiber_100g),
    },
    pieceG: n(p.serving_quantity) || undefined,
  };
}

/** Proxy zu Open Food Facts: ?q=Suchbegriff oder ?barcode=4001234567890 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const barcode = sp.get("barcode")?.replace(/\D/g, "");
  const q = sp.get("q")?.trim();
  try {
    if (barcode) {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 86400 },
      });
      const data = await res.json();
      const item = data?.product ? normalize({ ...data.product, code: barcode }) : null;
      return NextResponse.json({ items: item ? [item] : [] });
    }
    if (!q || q.length < 2) return NextResponse.json({ items: [] });
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}&lc=de&cc=de`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ items: [], error: "Open Food Facts nicht erreichbar" }, { status: 502 });
    const data = await res.json();
    const items = (data.products ?? []).map(normalize).filter(Boolean);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: "Open Food Facts nicht erreichbar" }, { status: 502 });
  }
}
