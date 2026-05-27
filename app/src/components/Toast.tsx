"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "warning";
  duration?: number;
  onClose: () => void;
}

/**
 * Styled toast notification replacing native alert().
 * Auto-dismisses after `duration` ms.
 */
export function Toast({
  message,
  type = "success",
  duration = 3000,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: "bg-emerald-500/90 border-emerald-400/30",
    error: "bg-red-500/90 border-red-400/30",
    warning: "bg-amber-500/90 border-amber-400/30",
  };

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
  };

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-white text-sm font-medium ${colors[type]}`}
      >
        <span className="text-lg">{icons[type]}</span>
        {message}
      </div>
    </div>
  );
}
