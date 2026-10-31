"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title?: string;
  description: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback(
    ({ duration = 4000, ...rest }: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, duration, ...rest }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5 bg-white text-slate-900 border-slate-200",
              toast.type === "success" && "border-emerald-200 bg-emerald-50/70",
              toast.type === "error" && "border-red-200 bg-red-50/70",
              toast.type === "warning" && "border-amber-200 bg-amber-50/70"
            )}
          >
            {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
            {toast.type === "error" && <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
            {toast.type === "warning" && <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
            {(!toast.type || toast.type === "info") && <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}

            <div className="flex-1 space-y-0.5 text-xs">
              {toast.title && <p className="font-semibold text-slate-900 text-sm">{toast.title}</p>}
              <p className="text-slate-600 leading-relaxed">{toast.description}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="rounded-md p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return {
    toast: (opts: Omit<ToastItem, "id">) => context.addToast(opts),
    success: (description: string, title?: string) =>
      context.addToast({ type: "success", description, title }),
    error: (description: string, title?: string) =>
      context.addToast({ type: "error", description, title }),
    info: (description: string, title?: string) =>
      context.addToast({ type: "info", description, title }),
    warning: (description: string, title?: string) =>
      context.addToast({ type: "warning", description, title }),
  };
}
