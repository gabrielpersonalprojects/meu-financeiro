import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function AppShell({ children }: Props) {
  return <>{children}</>;
}
