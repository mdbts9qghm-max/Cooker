/**
 * Minimaler XLSX-Leser (nur Text und Zahlen, erstes passendes Blatt).
 * Reicht für den MacroFactor-Export und läuft im Browser wie in Node.
 */
import { strFromU8, unzipSync } from "fflate";

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** text of all <t> nodes inside a fragment (handles rich text runs) */
function textOf(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decode(m[1]);
  return out;
}

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export type Sheet = { name: string; rows: (string | number | null)[][] };

export function readXlsx(data: Uint8Array): Sheet[] {
  const files = unzipSync(data);
  const get = (p: string) => (files[p] ? strFromU8(files[p]) : null);

  const shared: string[] = [];
  const ss = get("xl/sharedStrings.xml");
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));

  // sheet names -> file paths
  const wb = get("xl/workbook.xml") ?? "";
  const rels = get("xl/_rels/workbook.xml.rels") ?? "";
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/Id="([^"]+)"/)?.[1];
    const target = m[0].match(/Target="([^"]+)"/)?.[1];
    if (id && target) relMap.set(id, target.replace(/^\/?(xl\/)?/, "xl/"));
  }
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode(m[0].match(/name="([^"]+)"/)?.[1] ?? "Sheet");
    const rid = m[0].match(/r:id="([^"]+)"/)?.[1] ?? "";
    const xml = get(relMap.get(rid) ?? "");
    if (!xml) continue;
    const rows: (string | number | null)[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: (string | number | null)[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? "";
        const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
        const t = attrs.match(/t="([^"]+)"/)?.[1];
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let val: string | number | null = null;
        if (t === "s" && v != null) val = shared[+v] ?? "";
        else if (t === "inlineStr") val = textOf(inner);
        else if (t === "str" || t === "e") val = v != null ? decode(v) : null;
        else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
        else if (v != null) val = Number.isFinite(+v) ? +v : decode(v);
        const idx = ref ? colIndex(ref) : row.length;
        while (row.length < idx) row.push(null);
        row[idx] = val;
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}
