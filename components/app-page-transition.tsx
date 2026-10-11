"use client";

import { ViewTransition, type ReactNode } from "react";

/**
 * One consistent title-only entrance when switching between the main sections.
 * Only the visible h1 participates: cards, descriptions and navigation switch
 * immediately. In-mode Motion layoutId transitions (such as Playground
 * setup → practice) remain independent.
 */
export function PageHeadingTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="paessed-page-heading" default="none">
      {children}
    </ViewTransition>
  );
}
