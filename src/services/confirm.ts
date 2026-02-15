export type ConfirmOpts = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
};

type ConfirmHandler = (opts: ConfirmOpts) => Promise<boolean>;

let handler: ConfirmHandler | null = null;

export function setConfirmHandler(h: ConfirmHandler) {
  handler = h;
}

export function confirm(opts: ConfirmOpts): Promise<boolean> {
  if (!handler) {
    // se ninguém registrar handler, não abre nada (pra não cair no navegador)
    console.warn("[confirm] handler não registrado");
    return Promise.resolve(false);
  }
  return handler(opts);
}
