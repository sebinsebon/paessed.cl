import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paessed - Recuperar contraseña",
  description: "Paessed - Recuperar contraseña",
};

import { AuthForm } from "@/components/auth-form";
export default function RecoverPage() { return <AuthForm mode="recover" />; }
