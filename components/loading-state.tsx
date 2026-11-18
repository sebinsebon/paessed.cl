import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import styles from "./loading-state.module.css";

export function Skeleton({ className }: { className: string }) {
  return <span className={`${styles.block} block rounded-lg ${className}`} />;
}

export function LoadingRegion({ label, children, className = "" }: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${styles.region} ${className}`}>
    <span className="sr-only" role="status">{label}</span>
    <div className={styles.placeholder} data-loading-placeholder="" aria-hidden="true">{children}</div>
  </div>;
}

export function PendingLabel({ pending, label, children }: {
  pending: boolean;
  label: string;
  children: ReactNode;
}) {
  return <>
    <span className={styles.action}>
      <span aria-hidden={pending || undefined} className={pending ? styles.hidden : undefined}>{children}</span>
      <span aria-hidden={!pending || undefined} className={pending ? undefined : styles.hidden}>
        <LoaderCircle size={16} aria-hidden="true" data-loading-indicator="" className={pending ? styles.spinner : undefined} />
        {label}
      </span>
    </span>
    <span className="sr-only" role="status" aria-live="polite">{pending ? label : null}</span>
  </>;
}

export function QuestionLoading({ error, retry }: { error?: string; retry?: () => void }) {
  if (error) return <section className={`${styles.paper} max-w-[1060px] pt-3`}>
    <p role="alert" className="text-sm font-semibold text-[var(--pg-fg,var(--text))]">{error}</p>
    {retry && <button type="button" className="soft-button mt-3 min-h-11 rounded-xl px-4 text-sm font-bold" aria-label="Reintentar carga" onClick={retry}>Reintentar</button>}
  </section>;
  return <LoadingRegion label="Cargando la pregunta original…" className={`${styles.paper} max-w-[1060px]`}>
    <div className="grid max-w-2xl gap-3 pt-1">
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-4 w-[68%]" />
      <Skeleton className="mt-1 h-20 w-40 rounded-xl sm:w-48" />
    </div>
    <div className="mt-5 grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
      {[1, 2, 3, 4].map(value => <Skeleton key={value} className="h-10 w-full rounded-md" />)}
    </div>
  </LoadingRegion>;
}
