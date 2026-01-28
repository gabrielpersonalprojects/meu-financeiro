import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";



type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type UIContextValue = {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UIContext = createContext<UIContextValue | null>(null);

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ToastItem({ message, type }: { message: string; type: ToastType }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, []);

  return <div className={`ui-toast ${type} ${show ? "show" : ""}`}>{message}</div>;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: ToastType = "info", duration = 2200) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration + 250);
  };

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions>({
    title: "Confirmar ação",
    message: "Tem certeza?",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
  });


  const confirm = (options: ConfirmOptions) => {
    setConfirmOpts({
      title: options.title ?? "Confirmar ação",
      message: options.message,
      confirmText: options.confirmText ?? "Confirmar",
      cancelText: options.cancelText ?? "Cancelar",
    });

    setConfirmOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const closeConfirm = (value: boolean) => {
    setConfirmOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  // ESC fecha
  useEffect(() => {
    if (!confirmOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen]);

  const value = useMemo<UIContextValue>(() => ({ toast, confirm }), []);

  return (
    <UIContext.Provider value={value}>
      {children}

      {/* Confirm Modal */}
      <div id="ui-modal" className={confirmOpen ? "" : "ui-hidden"} aria-hidden={!confirmOpen}>
        <div className="ui-backdrop" onClick={() => closeConfirm(false)} />

        <div className="ui-modal-card" role="dialog" aria-modal="true">
          <h3 id="ui-modal-title" className="ui-modal-title">
            {confirmOpts.title}
          </h3>

          <p id="ui-modal-message" className="ui-modal-message">
            {confirmOpts.message}
          </p>

          <div className="ui-modal-actions">
            <button className="ui-btn ui-btn-ghost" onClick={() => closeConfirm(false)}>
              {confirmOpts.cancelText}
            </button>

            <button className="ui-btn ui-btn-primary" onClick={() => closeConfirm(true)}>
              {confirmOpts.confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div id="ui-toasts" className="ui-toasts">
        {toasts.map((t) => (
          <ToastItem key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}
