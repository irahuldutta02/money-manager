import { Suspense } from "react";
import { TransactionsScreen } from "@/components/TransactionsScreen";

export const instant = false;

export default function HomePage() {
  return (
    <Suspense>
      <TransactionsScreen />
    </Suspense>
  );
}
