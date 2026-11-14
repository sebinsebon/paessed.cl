import { AuthForm } from "@/components/auth-form";
import { redirectSignedIn } from "@/lib/server/entry";
import { authConfigured } from "@/lib/server/auth";

export default async function LoginPage() {
  await redirectSignedIn();
  return <AuthForm mode="login" accountsAvailable={authConfigured()} />;
}
