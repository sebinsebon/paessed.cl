export function masteryPresentation(percent: number | null, calibrated: boolean) {
  if (!calibrated || percent === null) return { label:"En calibración", color:"#94a3b8" };
  if (percent < 40) return {label:"Crítico",color:"#ef4444"};
  if (percent < 60) return {label:"Débil",color:"#f97316"};
  if (percent < 75) return {label:"Regular",color:"#eab308"};
  if (percent < 85) return {label:"Fuerte",color:"#6366f1"};
  return {label:"Dominado",color:"#10b981"};
}
