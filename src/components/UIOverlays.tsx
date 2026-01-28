import { useEffect, useState } from "react";

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
          <h3 id="ui-modal-title" className="ui-modal-title">
            {confirmOpts.title}
          </h3>

          <p id="ui-modal-message" className="ui-modal-message">
            {confirmOpts.message}
          </p>

          <div className="ui-modal-actions">
            <button className="ui-btn ui-btn-ghost" onClick={() => onCloseConfirm(false)}>
              {confirmOpts.cancelText}
            </button>

            <button className="ui-btn ui-btn-primary" onClick={() => onCloseConfirm(true)}>
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
    </>
  );
}
