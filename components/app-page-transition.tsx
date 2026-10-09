"use client";

import { ViewTransition, type ReactNode } from "react";

/**
 * Stable identities across the five primary PAESSED routes.
 * Page headings morph between layouts while page content settles into place.
 * This does not change existing in-page Motion layout animations.
 */
export function PageHeadingTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="paessed-page-heading" share="paessed-shared-heading" default="none">
      {children}
    </ViewTransition>
  );
}

export function PageContentTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="paessed-page-content" share="paessed-shared-content" default="none">
      {children}
    </ViewTransition>
  );
}
