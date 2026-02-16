"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Base modal overlay with glass styling.
 * Closes on backdrop click or Escape key.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="glass-card p-6 mx-4 max-w-sm w-full shadow-2xl border border-white/10 animate-scale-in">
        {children}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled confirmation dialog replacing native confirm().
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel}>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-white/70 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors text-sm font-medium"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
            variant === "danger"
              ? "bg-red-500/80 hover:bg-red-500"
              : "bg-emerald-500/80 hover:bg-emerald-500"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
