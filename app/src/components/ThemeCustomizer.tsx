"use client";

import { useState, useEffect, useCallback } from "react";

interface ColorConfig {
  key: string;
  label: string;
  defaultValue: string;
}

const colorConfigs: ColorConfig[] = [
  { key: "--bg-primary", label: "Background 1", defaultValue: "#04201c" },
  { key: "--bg-secondary", label: "Background 2", defaultValue: "#09c3a7" },
  { key: "--card-bg", label: "Card Background", defaultValue: "#115c52" },
  { key: "--qualifying-bg", label: "Qualifying Row", defaultValue: "#166534" },
  { key: "--qualifying-text", label: "Qualifying Text", defaultValue: "#4ade80" },
  { key: "--accent", label: "Accent/Buttons", defaultValue: "#7b2d2d" },
  { key: "--date-color", label: "Date Text", defaultValue: "#deb03b" },
  { key: "--venue-color", label: "Venue Text", defaultValue: "#6fd2e2" },
];

export default function ThemeCustomizer() {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>({});

  const applyColors = useCallback((colorMap: Record<string, string>) => {
    const root = document.documentElement;
    
    // Apply CSS variables
    Object.entries(colorMap).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Update body gradient
    if (colorMap["--bg-primary"] || colorMap["--bg-secondary"]) {
      document.body.style.background = `linear-gradient(135deg, ${colorMap["--bg-primary"] || "#04201c"} 0%, ${colorMap["--bg-secondary"] || "#09c3a7"} 100%)`;
    }
    
    // Apply glass-card background
    if (colorMap["--card-bg"]) {
      document.querySelectorAll(".glass-card").forEach((el) => {
        (el as HTMLElement).style.background = colorMap["--card-bg"];
      });
    }

    // Apply qualifying row colors
    document.querySelectorAll("tbody tr").forEach((tr) => {
      const row = tr as HTMLElement;
      if (row.className.includes("bg-green") || row.className.includes("bg-emerald")) {
        if (colorMap["--qualifying-bg"]) {
          row.style.backgroundColor = colorMap["--qualifying-bg"];
        }
      }
    });

    // Apply date colors
    if (colorMap["--date-color"]) {
      document.querySelectorAll("[class*='text-amber']").forEach((el) => {
        (el as HTMLElement).style.color = colorMap["--date-color"];
      });
    }

    // Apply venue colors  
    if (colorMap["--venue-color"]) {
      document.querySelectorAll("[class*='text-cyan']").forEach((el) => {
        (el as HTMLElement).style.color = colorMap["--venue-color"];
      });
    }

    // Apply qualifying text color
    if (colorMap["--qualifying-text"]) {
      document.querySelectorAll("[class*='text-green-4'], [class*='text-emerald-4']").forEach((el) => {
        (el as HTMLElement).style.color = colorMap["--qualifying-text"];
      });
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme-colors");
    if (saved) {
      const parsed = JSON.parse(saved);
      setColors(parsed);
      applyColors(parsed);
    } else {
      const defaults: Record<string, string> = {};
      colorConfigs.forEach((c) => {
        defaults[c.key] = c.defaultValue;
      });
      setColors(defaults);
    }
  }, [applyColors]);

  useEffect(() => {
    if (Object.keys(colors).length > 0) {
      const timer = setTimeout(() => applyColors(colors), 100);
      return () => clearTimeout(timer);
    }
  }, [colors, applyColors]);

  const handleColorChange = (key: string, value: string) => {
    const newColors = { ...colors, [key]: value };
    setColors(newColors);
    applyColors(newColors);
    localStorage.setItem("theme-colors", JSON.stringify(newColors));
  };

  const resetColors = () => {
    const defaults: Record<string, string> = {};
    colorConfigs.forEach((c) => {
      defaults[c.key] = c.defaultValue;
    });
    setColors(defaults);
    localStorage.removeItem("theme-colors");
    window.location.reload();
  };

  const exportColors = () => {
    const css = colorConfigs
      .map((c) => `  ${c.key}: ${colors[c.key] || c.defaultValue};`)
      .join("\n");
    navigator.clipboard.writeText(`:root {\n${css}\n}`);
    alert("CSS copied!");
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center text-white text-xl hover:scale-110 transition-transform"
        title="Theme Customizer"
      >
        🎨
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-72 bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="bg-slate-700 px-4 py-3 flex justify-between items-center">
            <span className="font-semibold text-white">Theme Colors</span>
            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white">✕</button>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {colorConfigs.map((config) => (
              <div key={config.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={colors[config.key] || config.defaultValue}
                  onChange={(e) => handleColorChange(config.key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <div className="flex-1">
                  <div className="text-white text-sm">{config.label}</div>
                  <div className="text-white/40 text-xs font-mono">{colors[config.key] || config.defaultValue}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-700/50 px-4 py-3 flex gap-2">
            <button onClick={resetColors} className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg">Reset</button>
            <button onClick={exportColors} className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">Export</button>
          </div>
        </div>
      )}
    </>
  );
}
