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
    <>
      {items.map((t) => (
        <Fragment key={String(t.id)}>
          {renderItem(t)}
        </Fragment>
      ))}
    </>
  );
}