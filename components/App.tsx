"use client";

import { useEffect, useState } from "react";
import { NavProvider, StackLayer, TabBar, useNav, type Route } from "./nav";
import { TodayScreen } from "./screens/Today";
import { WeekScreen } from "./screens/Week";
import { RecipesScreen } from "./screens/Recipes";
import { ShoppingScreen } from "./screens/Shopping";
import { RecipeDetail } from "./screens/RecipeDetail";
import { ReviewScreen } from "./screens/Review";
import { SettingsScreen, GoalsScreen, PantryScreen, ShortcutScreen, FoodsScreen } from "./screens/Settings";
import { TemplatesScreen } from "./screens/Templates";
import { ImportSheet, runImport } from "./screens/ImportSheet";
import { getSettings, updateSettings } from "@/lib/db";
import { freezePastWeeks } from "@/lib/plan";

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case "recipe":
      return <RecipeDetail id={route.id} />;
    case "review":
      return <ReviewScreen draftId={route.draftId} />;
    case "settings":
      return <SettingsScreen />;
    case "goals":
      return <GoalsScreen />;
    case "pantry":
      return <PantryScreen />;
    case "shortcut":
      return <ShortcutScreen />;
    case "foods":
      return <FoodsScreen />;
    case "templates":
      return <TemplatesScreen monday={route.monday} />;
  }
}

function Shell() {
  const nav = useNav();
  const { tab, stack, pop } = nav;
  const top = stack[stack.length - 1];
  const hideTabs = top && !top.closing && top.route.name === "review";

  // Import über URL-Parameter (/import?url=…&text=…), z. B. vom iOS-Kurzbefehl
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const url = sp.get("url");
    const text = sp.get("text");
    if (url || text) {
      window.history.replaceState(null, "", "/");
      runImport(nav, [text, url].filter(Boolean).join("\n"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        {tab === "today" && <TodayScreen />}
        {tab === "week" && <WeekScreen />}
        {tab === "recipes" && <RecipesScreen />}
        {tab === "shop" && <ShoppingScreen />}
      </div>
      {stack.map((item, i) => (
        <StackLayer key={item.key} closing={item.closing} onBack={pop} z={10 + i}>
          <RouteView route={item.route} />
        </StackLayer>
      ))}
      {!hideTabs && <TabBar onPlus={() => nav.openSheet((close) => <ImportSheet close={close} />)} />}
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add("app");
    (async () => {
      await getSettings();
      try {
        if (navigator.storage?.persist) {
          const persisted = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
          await updateSettings({ persisted });
        }
      } catch {}
      freezePastWeeks().catch(() => {});
      setReady(true);
    })();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (!ready) return <div className="fixed inset-0 bg-bg" />;
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}
