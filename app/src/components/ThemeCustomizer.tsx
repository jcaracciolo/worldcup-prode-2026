"use client";

import { useState, useEffect, useCallback } from "react";

const cssVarList = [
  { key: "--bg-primary", label: "Background 1" },
  { key: "--bg-secondary", label: "Background 2" },
  { key: "--card-bg", label: "Card Background" },
  { key: "--qualifying-bg", label: "Qualifying Row" },
  { key: "--qualifying-text", label: "Qualifying Text" },
  { key: "--accent", label: "Accent/Buttons" },
  { key: "--date-color", label: "Date Text" },
  { key: "--venue-color", label: "Venue Text" },
];

export default function ThemeCustomizer() {
  const [isOpen, setIsOpen] = useState(false);
  const [vars, setVars] = useState<Record<string, string>>({});

  const loadVars = useCallback(() => {
    const root = getComputedStyle(document.documentElement);
    const loaded: Record<string, string> = {};
    cssVarList.forEach(({ key }) => {
      const value = root.getPropertyValue(key).trim();
      if (value) loaded[key] = value;
    });
    setVars(loaded);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(loadVars, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, loadVars]);

  const updateVar = (key: string, value: string) => {
    document.documentElement.style.setProperty(key, value);
    setVars((prev) => ({ ...prev, [key]: value }));

    // Update body gradient for bg vars
    if (key === "--bg-primary" || key === "--bg-secondary") {
      const primary = key === "--bg-primary" ? value : vars["--bg-primary"];
      const secondary =
        key === "--bg-secondary" ? value : vars["--bg-secondary"];
      document.body.style.background = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
    }
  };

  const exportCss = () => {
    let css = ":root {\n";
    Object.entries(vars).forEach(([key, value]) => {
      css += `  ${key}: ${value};\n`;
    });
    css += "}";
    navigator.clipboard.writeText(css);
    alert("CSS copied!");
  };

  const toHex = (color: string): string => {
    if (color.startsWith("#")) return color.slice(0, 7);
    if (color.startsWith("rgb")) {
      const m = color.match(/\d+/g);
      if (m && m.length >= 3) {
        return (
          "#" +
          m
            .slice(0, 3)
            .map((n) => parseInt(n).toString(16).padStart(2, "0"))
            .join("")
        );
      }
    }
    return "#000000";
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center text-white text-xl hover:scale-110 transition-transform"
      >
        🎨
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[9999] w-72 bg-slate-900 rounded-xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-slate-800 px-4 py-3 flex justify-between items-center">
            <span className="font-semibold text-white">Theme</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {cssVarList.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={toHex(vars[key] || "#000000")}
                  onChange={(e) => updateVar(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <div className="flex-1">
                  <div className="text-white text-sm">{label}</div>
                  <div className="text-white/40 text-xs font-mono">
                    {vars[key] || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 px-4 py-3 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg"
            >
              Reset
            </button>
            <button
              onClick={exportCss}
              className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
            >
              Export
            </button>
          </div>
        </div>
      )}
    </>
  );
}
