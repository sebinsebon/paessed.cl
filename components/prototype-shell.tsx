'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ChartNoAxesCombined, ClipboardList, FlaskConical, Home, Menu, Moon, ScanLine, Settings, Sun, Trophy, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readAccount, readDiagnostic } from '@/lib/demo';
import { useRouter } from 'next/navigation';
const NAV = [
  { label: 'Inicio', href: '/inicio', icon: Home },
  { label: 'Aprender', href: '/aprender', icon: BookOpen },
  { label: 'Ensayos', href: '/ensayos', icon: ClipboardList },
  { label: 'Scanner', href: '/scanner', icon: ScanLine },
  { label: 'Verificador', href: '/verificador', icon: FlaskConical },
  { label: 'Playground', href: '/playground', icon: Trophy },
  { label: 'Estadísticas', href: '/estadisticas', icon: ChartNoAxesCombined },
  { label: 'Perfil', href: '/perfil', icon: UserRound },
] as const;
export function usePrototypeTheme() {
  const [dark,setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('paessed-theme');
    const next = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(next); document.documentElement.classList.toggle('dark',next);
  }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark',next); localStorage.setItem('paessed-theme',next?'dark':'light'); };
  return {dark,toggle};
}
export function PrototypeShell({children, title, subtitle}:{children:React.ReactNode;title:string;subtitle?:string}) {
  const pathname=usePathname(); const router=useRouter(); const [allowed,setAllowed]=useState(false); const {dark,toggle}=usePrototypeTheme(); const [menu,setMenu]=useState(false);
  const [account,setAccount]=useState<ReturnType<typeof readAccount>>(null);
  useEffect(()=>{const account=readAccount();const diagnosis=readDiagnostic();if(account&&diagnosis?.completedAt){setAccount(account);setAllowed(true);}else router.replace(diagnosis?.completedAt?'/registro':'/diagnostico');},[router]);
  useEffect(()=>{setMenu(false);},[pathname]);
  const nav=(mobile=false)=>NAV.map(({href,label,icon:Icon})=>{
    const active=pathname===href || pathname.startsWith(href+'/');
    return <Link key={href} href={href} onClick={()=>setMenu(false)} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-extrabold transition-colors ${active?'bg-[var(--primary)] text-white shadow-[0_3px_0_var(--primary-pressed)]':'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'} ${mobile?'min-h-12':''}`}><Icon size={18}/><span>{label}</span>{(label==='Playground')&&<span className={`ml-auto rounded-md px-1.5 py-0.5 text-[9px] ${active?'bg-white/20':'bg-[var(--surface-3)]'}`}>DEMO</span>}</Link>;
  });
  if(!allowed) return <div role="status" className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Cargando tu espacio de demostración…</div>;
  return <div className="min-h-screen bg-[var(--canvas)]">
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[264px] flex-col border-r border-[var(--border)] bg-[var(--surface)] px-5 py-5 lg:flex">
      <Link href="/inicio" className="mx-auto mb-8 w-[178px]"><img src={dark?'/paessed-logo-dark.svg':'/paessed-logo.svg'} alt="PAESSED" className="w-full"/><span className="mt-1 block text-[10px] font-extrabold tracking-[.16em] text-[var(--muted)]">MATEMÁTICA M1</span></Link>
      <nav aria-label="Navegación principal" className="space-y-1">{nav()}</nav>
      <div className="mt-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs font-bold text-[var(--muted)]"><span className="mb-1 inline-flex items-center gap-2 text-[var(--primary)]"><Settings size={15}/> PROTOTIPO UI/UX</span><p className="leading-5">Datos ilustrativos · sin conexión a backend</p></div>
    </aside>
    <header className="fixed inset-x-0 top-0 z-40 flex h-[68px] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:left-[264px] lg:px-8">
      <Link href="/inicio" className="lg:hidden"><img src={dark?'/paessed-logo-dark.svg':'/paessed-logo.svg'} className="h-8 w-auto max-w-[138px]" alt="PAESSED"/></Link>
      <div className="hidden min-w-0 flex-1 lg:block"><span className="text-[13px] font-extrabold">{title}</span>{subtitle&&<span className="ml-3 text-xs text-[var(--muted)]">{subtitle}</span>}</div>
      <span className="ml-auto hidden rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-extrabold text-[var(--primary)] sm:inline-flex">VISTA DEMO</span>
      <button type="button" onClick={toggle} aria-label={dark?'Cambiar a modo claro':'Cambiar a modo oscuro'} className="soft-button grid h-10 w-10 place-items-center rounded-xl">{dark?<Sun size={19} color="#eab308"/>:<Moon size={19}/>}</button>
      <Link href="/perfil" aria-label="Abrir perfil" className="soft-button hidden h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold sm:flex"><UserRound size={17}/>{account?.name?.split(' ')[0]??'Invitado'}</Link>
      <button type="button" aria-expanded={menu} aria-controls="mobile-menu" aria-label={menu?'Cerrar menú':'Abrir menú'} onClick={()=>setMenu(!menu)} className="soft-button grid h-10 w-10 place-items-center rounded-xl lg:hidden">{menu?<X size={20}/>:<Menu size={20}/>}</button>
    </header>
    {menu&&<><button aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={()=>setMenu(false)}/><nav id="mobile-menu" aria-label="Menú móvil" className="fixed right-3 top-[78px] z-50 max-h-[calc(100vh-100px)] w-[min(290px,calc(100%-24px))] space-y-1 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl lg:hidden">{nav(true)}</nav></>}
    <main className="min-h-screen px-4 pb-32 pt-[92px] sm:px-7 lg:ml-[264px] lg:pb-12 lg:pt-[96px]"><div className="mx-auto w-full max-w-[1240px]">{children}</div></main>
    <nav aria-label="Navegación móvil rápida" className="paessed-mobile-nav fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl lg:hidden">
      {NAV.filter(x=>['Inicio','Aprender','Ensayos','Scanner'].includes(x.label)).map(({href,label,icon:Icon})=><Link key={href} href={href} className={`flex min-w-[66px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-extrabold ${pathname===href?'bg-[var(--primary)] text-white':'text-[var(--muted)]'}`}><Icon size={18}/>{label}</Link>)}
    </nav>
  </div>;
}
export function Eyebrow({children}:{children:React.ReactNode}) {return <span className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--primary)]">{children}</span>}
export function PageHeading({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="max-w-[750px]"><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-[-.03em] sm:text-[39px]">{title}</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p></div>{action}</div>;
}
