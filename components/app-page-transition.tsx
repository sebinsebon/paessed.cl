"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";

/**
 * Navigation between top-level PAESSED modes animates ONLY the title.
 *
 * Cloning the h1 adds no layout wrapper, so its position and the rest of the
 * page remain stable. This deliberately does not create a browser-wide shared
 * element transition; those remain within modes via Motion layoutId.
 */
export function PageHeadingTransition({ children }: { children: ReactNode }) {
  if (!isValidElement<{ className?: string }>(children)) return <>{children}</>;
  const previousClass = children.props.className ?? "";
  return cloneElement(children, {
    className: [previousClass, "paessed-section-title-entry"].filter(Boolean).join(" "),
  });
}
