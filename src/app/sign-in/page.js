import { Suspense } from "react";
import { SignInScreen } from "@/components/SignInScreen";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
