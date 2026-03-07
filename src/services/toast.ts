import toast from "react-hot-toast";

export type ToastKind = "success" | "error" | "info";

const baseStyle = {
  maxWidth: "320px",
  minWidth: "260px",
  padding: "8px 12px",
  borderRadius: "14px",
  fontSize: "13px",
  lineHeight: "18px",
  background: "#eef2f7",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
};

export function toastCompact(message: string, kind: ToastKind = "info") {
  if (kind === "success") {
    return toast.success(message, {
      style: baseStyle,
    });
  }

  if (kind === "error") {
    return toast.error(message, {
      style: baseStyle,
    });
  }

  return toast(message, {
    style: baseStyle,
  });
}