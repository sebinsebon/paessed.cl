'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { readAccount, readDiagnostic } from '@/lib/demo';
/** UI-only gate; not authentication or access control. The backend must enforce real access later. */
export function PrototypeGate({children}:{children:React.ReactNode}) {
  const router=useRouter(); const [allowed,setAllowed]=useState(false);
  useEffect(()=>{
    const account=readAccount();const diagnostic=readDiagnostic();
    if(account&&diagnostic?.completedAt){setAllowed(true);return;}
    router.replace(diagnostic?.completedAt?'/registro':'/diagnostico');
  },[router]);
  if(!allowed)return <div role="status" className="grid min-h-screen place-items-center bg-[var(--canvas)] text-sm font-bold text-[var(--muted)]">Cargando tu espacio de demostración…</div>;
  return <>{children}</>;
}
