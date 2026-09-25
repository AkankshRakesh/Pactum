"use client";

import { useEffect, useState } from "react";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(window.localStorage.getItem("pactum-theme") === "dark");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("pactum-theme", dark ? "dark" : "light");
  }, [dark, ready]);

  return (
    <>
      {children}
      <button
        className="mode-toggle"
        type="button"
        onClick={() => setDark((current) => !current)}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {dark ? "☀" : "☾"}
      </button>
    </>
  );
}
