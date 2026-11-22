import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paessed - Registro",
  description: "Paessed - Registro",
};

import { AuthForm } from "@/components/auth-form";
import { redirectSignedIn } from "@/lib/server/entry";
import { authConfigured } from "@/lib/server/auth";

export default async function RegisterPage() {
  await redirectSignedIn();
  return <AuthForm mode="register" accountsAvailable={authConfigured()} />;
}
