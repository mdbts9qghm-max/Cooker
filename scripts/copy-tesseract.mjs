// Kopiert Tesseract (Worker, WASM-Kern, Sprachdaten DE/EN) nach public/tesseract,
// damit die Texterkennung ohne fremdes CDN und nach dem ersten Laden auch offline läuft.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "tesseract");
mkdirSync(join(out, "lang"), { recursive: true });

const tjs = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
cpSync(join(tjs, "dist", "worker.min.js"), join(out, "worker.min.js"));
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]) {
  cpSync(join(core, f), join(out, f));
}
for (const lang of ["deu", "eng"]) {
  const pkg = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  cpSync(join(pkg, "4.0.0_best_int", `${lang}.traineddata.gz`), join(out, "lang", `${lang}.traineddata.gz`));
}
console.log("Tesseract-Dateien nach public/tesseract kopiert");
