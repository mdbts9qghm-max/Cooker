"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("./App"), { ssr: false, loading: () => <div className="fixed inset-0 bg-bg" /> });

export default function ClientApp() {
  return <App />;
}
