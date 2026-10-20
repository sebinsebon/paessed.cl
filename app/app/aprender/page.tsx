import { redirect } from "next/navigation";

/** The interactive Aventura is the actual Aprender prototype.
 * Keep one source of progress instead of showing a disconnected mock route.
 */
export default function LearnPage() {
  redirect("/aventura");
}
