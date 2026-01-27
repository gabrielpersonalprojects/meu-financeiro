import toast from "react-hot-toast";

export type ToastKind = "success" | "error" | "info";

export function toastCompact(message: string, kind: ToastKind = "info") {
  if (kind === "success") return toast.success(message);
  if (kind === "error") return toast.error(message);
  return toast(message); // info/neutro
}
