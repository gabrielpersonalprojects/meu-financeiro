import type { ReactNode } from "react";
import { Fragment } from "react";
import type { Transaction } from "../types";

export function TransactionsList({
  items,
  renderItem,
}: {
  items: Transaction[];
  renderItem: (t: Transaction) => ReactNode;
}) {
  return (
<div className="space-y-3 sm:space-y-3">
  {items.map((t) => (
    <div key={String(t.id)} className="mb-0">
      {renderItem(t)}
    </div>
  ))}
</div>
  );
}