/** A fixed local destination, never an arbitrary redirect from a query string. */
export function takeAuthReturnTo() {
  try {
    const value = sessionStorage.getItem("paessed-auth-return-to");
    sessionStorage.removeItem("paessed-auth-return-to");
    return value === "/diagnostico" ? value : "/app/inicio";
  } catch { return "/app/inicio"; }
}
