import { db, updateSettings } from "./db";
import { today } from "./util";

const VERSION = 1;

export async function exportAll() {
  const [recipes, plan, templates, foods, mappings, shopping, settings] = await Promise.all([
    db.recipes.toArray(),
    db.plan.toArray(),
    db.templates.toArray(),
    db.foods.toArray(),
    db.mappings.toArray(),
    db.shopping.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: "rezeptbuch",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: { recipes, plan, templates, foods, mappings, shopping, settings },
  };
}

export async function shareBackup(): Promise<"shared" | "downloaded" | "cancelled"> {
  const json = JSON.stringify(await exportAll());
  const name = `rezeptbuch-backup-${today()}.json`;
  const file = new File([json], name, { type: "application/json" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: "Rezeptbuch-Backup" });
      await updateSettings({ lastBackupAt: Date.now(), backupSnoozeUntil: null });
      return "shared";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  await updateSettings({ lastBackupAt: Date.now(), backupSnoozeUntil: null });
  return "downloaded";
}

export async function restoreBackup(file: File): Promise<{ recipes: number }> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed?.app !== "rezeptbuch" || !parsed.data) throw new Error("Das ist keine Rezeptbuch-Backup-Datei.");
  const d = parsed.data;
  await db.transaction("rw", [db.recipes, db.plan, db.templates, db.foods, db.mappings, db.shopping, db.settings], async () => {
    await Promise.all([
      db.recipes.clear(), db.plan.clear(), db.templates.clear(), db.foods.clear(),
      db.mappings.clear(), db.shopping.clear(), db.settings.clear(),
    ]);
    await db.recipes.bulkPut(d.recipes ?? []);
    await db.plan.bulkPut(d.plan ?? []);
    await db.templates.bulkPut(d.templates ?? []);
    await db.foods.bulkPut(d.foods ?? []);
    await db.mappings.bulkPut(d.mappings ?? []);
    await db.shopping.bulkPut(d.shopping ?? []);
    await db.settings.bulkPut(d.settings ?? []);
  });
  return { recipes: (d.recipes ?? []).length };
}

export const BACKUP_INTERVAL = 14 * 24 * 3600 * 1000;
