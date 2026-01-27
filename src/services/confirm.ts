export type ConfirmOpts = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

// compatível com confirm(...).then(...)
export const confirm = (opts: ConfirmOpts) => {
  return Promise.resolve(window.confirm(opts.message));
};
