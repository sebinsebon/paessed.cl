import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { authOrigin, requireAccount, requireRecent } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/http";

export default async function PasswordPage() {
  try {
    const account = await requireAccount(new Request(authOrigin()), true);
    await requireRecent(account, true);
    return <AuthForm mode="password" accountId={account.user.id} />;
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403 || error.status === 503)) redirect("/login?authError=1");
    throw error;
  }
}
