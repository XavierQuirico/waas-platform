"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />;
  }

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`
        relative inline-flex h-9 w-9 items-center justify-center 
        rounded-full transition-transform active:scale-95
        hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-brand-amber
      `}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <Sun
          className={`absolute inset-0 w-5 h-5 transition-all transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            isDark ? "rotate-90 scale-0 opacity-0 blur-[2px]" : "rotate-0 scale-100 opacity-100 blur-0 text-brand-dark"
          }`}
        />
        <Moon
          className={`absolute inset-0 w-5 h-5 transition-all transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            isDark ? "rotate-0 scale-100 opacity-100 blur-0 text-brand-pearl" : "-rotate-90 scale-0 opacity-0 blur-[2px]"
          }`}
        />
      </div>
    </button>
  );
}
