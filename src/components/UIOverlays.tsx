import { ReactNode, useEffect, useRef, useState } from "react";
import { setConfirmHandler } from "../services/confirm";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

function ToastItem({ message, type }: { message: string; type: ToastType }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, []);

  return <div className={`ui-toast ${type} ${show ? "show" : ""}`}>{message}</div>;
}

export function UIOverlays({
  confirmOpen,
  confirmOpts,
  onCloseConfirm,
  toasts,
}: {
  confirmOpen: boolean;
  confirmOpts: ConfirmOptions;
  onCloseConfirm: (value: boolean) => void;
  toasts: Toast[];
}) {
  return (
    <>
      {/* Confirm Modal */}
      <div id="ui-modal" className={confirmOpen ? "" : "ui-hidden"} aria-hidden={!confirmOpen}>
        <div className="ui-backdrop" onClick={() => onCloseConfirm(false)} />

        <div className="ui-modal-card" role="dialog" aria-modal="true">
          {confirmOpts.title ? (
            <h3 id="ui-modal-title" className="ui-modal-title">
              {confirmOpts.title}
            </h3>
          ) : null}

<div id="ui-modal-message" className="mt-4">
  {(() => {
    const parts = String(confirmOpts.message ?? "")
      .split("\n\n")
      .filter(Boolean);

    const body = parts.slice(0, -1).join(" ");
    const note = parts[parts.length - 1] ?? "";

    return (
      <>
        {body ? <p className="ui-modal-message">{body}</p> : null}
        {note ? <p className="ui-modal-note">{note}</p> : null}
      </>
    );
  })()}
</div>

          <div className="ui-modal-actions">
            <button className="ui-btn ui-btn-ghost" onClick={() => onCloseConfirm(false)}>
              {confirmOpts.cancelText ?? "Cancelar"}
            </button>

            <button className="ui-btn ui-btn-primary" onClick={() => onCloseConfirm(true)}>
              {confirmOpts.confirmText ?? "OK"}
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
    </>
  );
}

export function UIProvider({ children }: { children: ReactNode }) {
  // ===== Confirm =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions>({
    title: "",
    message: "",
    confirmText: "OK",
    cancelText: "Cancelar",
  });

  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    // Registra o handler que substitui o window.confirm
    setConfirmHandler((opts: ConfirmOptions) => {
      setConfirmOpts({
        title: opts.title,
        message: opts.message,
        confirmText: opts.confirmText ?? "OK",
        cancelText: opts.cancelText ?? "Cancelar",
      });

      setConfirmOpen(true);

      return new Promise<boolean>((resolve) => {
        confirmResolverRef.current = resolve;
      });
    });
  }, []);

  function onCloseConfirm(value: boolean) {
    setConfirmOpen(false);
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    resolve?.(value);
  }

  // ===== Toasts (mantém como está; se você já tem outro sistema, não atrapalha) =====
  const [toasts, setToasts] = useState<Toast[]>([]);

  return (
    <>
      {children}
      <UIOverlays
        confirmOpen={confirmOpen}
        confirmOpts={confirmOpts}
        onCloseConfirm={onCloseConfirm}
        toasts={toasts}
      />
    </>
  );
}
