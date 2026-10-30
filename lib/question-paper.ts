/** Text on the question sheet; KaTeX keeps its own mathematical fonts. */
export const QUESTION_PAPER_FONT = { fontFamily: 'Arial, Helvetica, sans-serif' };

export type QuestionPaperTheme = 'auto' | 'light' | 'dark';
export const QUESTION_PAPER_THEME_KEY = 'paessed-question-paper-theme';

/** One preference shared by the exam sheets and Playground, separate from the app theme. */
export function readQuestionPaperTheme(): QuestionPaperTheme {
  try {
    const keys = [
      QUESTION_PAPER_THEME_KEY,
      'paessed-essay-paper-theme',
      'paessed-imported-paper-theme',
      'paessed-playground-paper-theme',
    ];
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored === 'auto' || stored === 'light' || stored === 'dark') return stored;
    }
  } catch { /* Privacy or storage restrictions: show a light sheet. */ }
  return 'light';
}

export function saveQuestionPaperTheme(theme: QuestionPaperTheme): void {
  try { localStorage.setItem(QUESTION_PAPER_THEME_KEY, theme); }
  catch { /* Keep the in-memory preference. */ }
}
