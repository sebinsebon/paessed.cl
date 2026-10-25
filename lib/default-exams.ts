/**
 * Public, verified PAESSED Gold exams.
 *
 * Keep this catalog separate from user imports in IndexedDB. Add an entry only
 * after its .paessed 0.2.0 package has passed Gold review and the linked viewer
 * route can open it. Listing a file here does not import it into a browser.
 *
 * Example entry once the Gold viewer is implemented:
 * {
 *   id: "demre-m1-invierno-2025",
 *   title: "PAES M1 Invierno 2025",
 *   questionCount: 65,
 *   publishedAt: "2026-10-25T00:00:00Z",
 *   href: "/app/ensayos/default/demre-m1-invierno-2025",
 * }
 */
export type DefaultExamEntry = {
  id: string;
  title: string;
  questionCount: number;
  href: string;
  publishedAt?: string;
};

export const DEFAULT_EXAMS: DefaultExamEntry[] = [];
