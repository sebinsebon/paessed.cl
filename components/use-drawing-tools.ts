"use client";

import { useCallback, useState } from "react";

/** Hiding tools never disables the canvas or interrupts the current stroke. */
export function useDrawingTools() {
  const [state, setState] = useState({ enabled: false, menuOpen: false });
  const toggleDrawing = () => setState((previous) => previous.enabled && previous.menuOpen
    ? { enabled: false, menuOpen: false }
    : { enabled: true, menuOpen: true });
  const setDrawingEnabled = useCallback((enabled: boolean) => setState({ enabled, menuOpen: enabled }), []);
  const hideDrawingTools = () => setState((previous) => ({ ...previous, menuOpen: false }));
  return {
    drawingEnabled: state.enabled,
    drawingMenuOpen: state.menuOpen,
    drawingButtonLabel: !state.enabled ? "Activar lápiz" : state.menuOpen ? "Desactivar lápiz" : "Abrir herramientas del lápiz",
    toggleDrawing, setDrawingEnabled, hideDrawingTools,
  };
}
