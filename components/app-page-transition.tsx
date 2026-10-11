"use client";

import { ViewTransition, type ReactNode } from "react";

/**
 * One consistent transition when switching between PAESSED's main sections.
 * Only wrap the visible h1: page content, descriptions and navigation stay out
 * of the shared browser snapshot. In-mode Motion layoutId transitions (such as
 * Playground setup → practice) are intentionally independent.
 */
export function PageHeadingTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="paessed-page-heading" share="paessed-shared-heading" default="none">
      {children}
    </ViewTransition>
  );
}
