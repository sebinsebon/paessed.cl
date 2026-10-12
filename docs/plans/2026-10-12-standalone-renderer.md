# Standalone renderer integration plan

Goal: improve question content fidelity while preserving the current application UI and PAES contracts.

Base: `3e837f3` (reader 0.2.0), descendant of `origin/main` `ef90df4`. Local setup is preserved in a named stash and an external backup. No main merge, reset or force push.

1. Audit standalone `renderBlocks`, current DOM renderer, scoped styles and viewer boundaries. Read installed Next.js browser/client/testing guidance. Extract the standalone and TESLA outside Git; use existing importer packaging tools and verify semantic JSON equality.
2. Capture the existing renderer on TESLA P1/P15/P19/P20/P25/P41/P50, desktop/mobile, light/dark. Fix the discovered optional warnings adapter crash to enable actual import without changing validation.
3. Add regression tests for paragraph grouping, inline/display math, tall fractions/radicals, nested tables, images and safe failures. Verify failures against the old renderer.
4. Modify only `lib/paessed-runtime/block-renderer.js`, `public/paessed/block-renderer.css`, and its React host. Reuse standalone paragraph boundaries and centered proportional images. Preserve KaTeX HTML + accessible MathML, trusted rendering restrictions and display flags. Keep inline math out of scroll containers; scroll genuinely oversized formulas separately. Do not infer changes to package content.
5. Run renderer/browser tests, existing contract/curriculum/progress tests, TypeScript, targeted lint and production build. Capture the same TESLA matrix and standalone using identical package bytes. Exercise import, selection, navigation, progress reload, tools, export/reimport; report asset defects and browser limits separately.
6. Review complete diff and branch ancestry, commit only scoped changes, push the dedicated branch, inspect Vercel preview and report integration readiness with evidence.

Runtime CSS selectors must begin with `.paessed-blocks`. Sidebar, page layouts, paper/header/options controls, theme definitions and transitions are outside implementation scope. No package reader, validator, export integrity or importer contract changes are planned.
