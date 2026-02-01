import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function TransactionsSection({ children }: Props) {
  return <>{children}</>;
}
