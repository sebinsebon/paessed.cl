import { AppShell } from "./app-shell";
import { LoadingRegion, Skeleton } from "./loading-state";
import route from "./learning/route/route.module.css";
import diagnostic from "./learning/diagnostic-flow.module.css";

type Screen = "inicio" | "aprender" | "ensayos" | "playground" | "perfil";

const titles: Record<Screen, string> = {
  inicio: "Inicio",
  aprender: "Aprender",
  ensayos: "Ensayos",
  playground: "Playground",
  perfil: "Perfil",
};

export function AppLoading({ screen }: { screen: Screen }) {
  return <AppShell title={titles[screen]} wide={screen === "ensayos" || screen === "playground"}>
    {screen === "inicio" ? <HomeSkeleton /> :
      screen === "aprender" ? <LearnSkeleton /> :
      screen === "perfil" ? <ProfileSkeleton /> :
      <div className="mx-auto max-w-[1460px]">
        <LoadingRegion label={`Abriendo ${titles[screen]}…`} className="mb-7">
          <div className="grid gap-2 sm:min-h-26">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-52" />
            <Skeleton className="h-3.5 w-4/5 max-w-sm" />
          </div>
        </LoadingRegion>
        {screen === "ensayos" ? <ExamsListSkeleton /> : <PlaygroundSkeleton />}
      </div>}
  </AppShell>;
}

export function AppProgressLoading({ pathname }: { pathname: string }) {
  const screen = pathname.split("/")[2];
  if (Object.hasOwn(titles, screen)) return <AppLoading screen={screen as Screen} />;
  return <AppShell title="Progreso"><LoadingRegion label="Cargando tu progreso…" className="min-h-64">
    <CardLines className="h-52" />
  </LoadingRegion></AppShell>;
}

function CardLines({ className = "" }: { className?: string }) {
  return <div className={`surface grid content-start gap-3 rounded-2xl p-5 sm:p-6 ${className}`}>
    <Skeleton className="h-5 w-2/5" />
    <Skeleton className="h-3 w-4/5" />
    <Skeleton className="h-3 w-3/5" />
  </div>;
}

export function HomeSkeleton() {
  return <LoadingRegion label="Cargando tu progreso de Inicio…">
    <div className="mb-6 grid gap-2 px-1 sm:px-[30px]">
      <Skeleton className="h-18 w-4/5 max-w-xl sm:h-11" />
      <Skeleton className="h-6 w-full max-w-lg" />
    </div>
    <div className="flex gap-3 overflow-hidden border-b border-[var(--border)] bg-[var(--surface)] px-4 py-[10px] lg:px-5 lg:py-5">
      {[1, 2, 3, 4].map(value => <div key={value} className="surface flex min-h-28 min-w-[84vw] items-center gap-3 rounded-2xl p-3 sm:min-w-[370px] lg:min-w-[292px]">
        <Skeleton className="size-9 shrink-0 rounded-xl sm:size-11" />
        <div className="grid min-w-0 flex-1 gap-2"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-2 w-full rounded-full" /></div>
      </div>)}
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(290px,.75fr)]">
      <CardLines className="min-h-56" />
      <CardLines className="min-h-56" />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(320px,.85fr)_minmax(0,1.4fr)]">
      <CardLines className="min-h-40" />
      <CardLines className="min-h-40" />
    </div>
    <CardLines className="mt-7 min-h-44" />
  </LoadingRegion>;
}

export function LearnSkeleton() {
  return <LoadingRegion label="Preparando tu ruta de aprendizaje…">
    <div className={route.root}>
      <div className={route.headerClean}>
        <div className="grid flex-1 gap-2"><Skeleton className="h-9 w-36 max-w-full" /><Skeleton className="h-4 w-60 max-w-full" /></div>
        <Skeleton className="h-[46px] w-24 rounded-xl sm:w-32" />
      </div>
      <div className={route.routeLayout}>
        <div className={route.routeColumn}>
          <div className={route.blockHeading}>
            <div className="grid w-2/5 gap-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-3 w-3/5" /></div>
            <Skeleton className="h-[7px] flex-1 rounded-full" />
          </div>
          <div className={route.pathContainer}>
            {[route.pos0, route.pos1, route.pos2, route.pos3, route.pos4].map(position =>
              <div key={position} className={`${route.pathStepRow} ${position}`}>
                <div className={route.tactileNodeWrapper}>
                  <Skeleton className="size-[54px] shrink-0 rounded-[19px] min-[761px]:size-16 min-[761px]:rounded-[23px]" />
                  <div className="grid w-full max-w-52 gap-2"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-3/5" /></div>
                </div>
              </div>)}
          </div>
        </div>
        <div className={route.routeAside}>
          <div className={route.nextCard}><Skeleton className="mb-6 size-12 rounded-2xl" /><Skeleton className="h-5 w-3/4" /><Skeleton className="mt-6 h-11 w-full rounded-xl" /></div>
          <div className={`${route.goalCard} grid min-h-24 gap-3`}><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-3/5" /></div>
        </div>
      </div>
    </div>
  </LoadingRegion>;
}

export function ExamsListSkeleton() {
  return <LoadingRegion label="Cargando tus ensayos…">
    <div className="grid gap-3">
      {[1, 2, 3].map(value => <div key={value} className="surface flex min-h-[108px] items-center gap-4 rounded-2xl px-4 sm:px-5">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="grid flex-1 gap-2"><Skeleton className="h-5 w-3/4 max-w-64" /><Skeleton className="h-3 w-1/2 max-w-40" /></div>
        <Skeleton className="hidden h-10 w-24 rounded-xl sm:block" />
      </div>)}
    </div>
  </LoadingRegion>;
}

export function PlaygroundSkeleton() {
  return <LoadingRegion label="Cargando el banco de preguntas…">
    <div className="surface overflow-hidden rounded-3xl">
      <div className="grid gap-3 border-b border-[var(--border)] p-5 sm:px-7"><Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-3/4 max-w-md" /></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:px-7">
        <div className="grid gap-2"><Skeleton className="h-3 w-10" /><Skeleton className="h-11 w-full rounded-xl" /></div>
        <div className="grid gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-11 w-full rounded-xl" /></div>
      </div>
      <div className="grid gap-3 border-t border-[var(--border)] p-5 sm:px-7"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-full rounded-xl" /></div>
      <div className="border-t border-[var(--border)] p-5 sm:px-7"><Skeleton className="h-5 w-48" /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4 sm:px-7">
        <Skeleton className="h-4 w-48" /><Skeleton className="h-11 w-44 rounded-xl" />
      </div>
    </div>
  </LoadingRegion>;
}

export function ProfileSectionsSkeleton() {
  return <LoadingRegion label="Cargando las secciones de tu perfil…">
    <div className="grid gap-5 lg:grid-cols-2">
      <CardLines className="min-h-54" />
      <CardLines className="min-h-54" />
    </div>
  </LoadingRegion>;
}

function ProfileSkeleton() {
  return <>
    <LoadingRegion label="Cargando tu perfil…">
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="mb-7 mt-3 h-5 w-3/4 max-w-xl" />
      <CardLines className="min-h-36" />
    </LoadingRegion>
    <ProfileSectionsSkeleton />
    <LoadingRegion label="Leyendo el almacenamiento del navegador…" className="mt-6"><CardLines className="min-h-52" /></LoadingRegion>
  </>;
}

export function DiagnosticSkeleton() {
  return <LoadingRegion label="Cargando el resultado del diagnóstico…">
    <div>
      <Skeleton className="mb-4 h-7 w-44 rounded-full" />
      <Skeleton className="h-11 w-72 max-w-full" />
      <Skeleton className="mb-4 mt-3 h-5 w-4/5 max-w-md" />
      <div className={diagnostic.resultSummary}><div className="grid gap-3"><Skeleton className="h-4 w-44" /><Skeleton className="h-10 w-36" /></div></div>
      <div className={diagnostic.learningMap}>
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="mb-4 h-4 w-64 max-w-full" />
        <div className={diagnostic.axes}>
          {[1, 2, 3, 4].map(value => <div key={value} className={`${diagnostic.axisCard} min-h-40`}>
            <div className={diagnostic.axisHeading}><Skeleton className="size-9 rounded-xl" /><Skeleton className="h-5 w-28" /></div>
            <Skeleton className="mt-4 h-4 w-28" />
            <div className="mt-3 flex gap-2">{[1, 2, 3, 4].map(dot => <Skeleton key={dot} className="size-4 rounded-full" />)}</div>
          </div>)}
        </div>
      </div>
    </div>
  </LoadingRegion>;
}
