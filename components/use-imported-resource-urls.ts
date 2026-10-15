"use client";

import { useEffect, useState } from "react";
import { resolveImportedResources } from "@/lib/imported-resources";
import type { ImportedExamRecord } from "@/lib/local-imports";

const emptyUrls = () => ({ byId: new Map<string, string>(), byPath: new Map<string, string>() });

/** Shared strict/generic resource loading, with URL ownership tied to a source. */
export function useImportedResourceUrls(record: ImportedExamRecord | null) {
  const [state, setState] = useState(() => ({ record, owner: { active: true }, urls: emptyUrls(), issues: new Map<string, string>(), error: "", loading: !!record }));
  useEffect(() => {
    let cancelled = false;
    const owner = { active: true };
    const owned = new Set<string>();
    if (!record) return;
    void resolveImportedResources(record, { cancelled: () => cancelled }).then((resolved) => {
      if (cancelled) return;
      const urls = new Map<Blob, string>();
      const urlFor = (blob: Blob) => {
        let url = urls.get(blob);
        if (!url) { url = URL.createObjectURL(blob); urls.set(blob, url); owned.add(url); }
        return url;
      };
      const byId = new Map(Array.from(resolved.byId, ([key, blob]) => [key, urlFor(blob)]));
      const byPath = new Map(Array.from(resolved.byPath, ([key, blob]) => [key, urlFor(blob)]));
      const issues = new Map<string, string>();
      for (const item of resolved.coverage) if (item.error) { issues.set(item.id, item.error); issues.set(item.path, item.error); }
      setState({ record, owner, urls: { byId, byPath }, issues, error: "", loading: false });
    }).catch((error) => {
      if (!cancelled) setState({ record, owner, urls: emptyUrls(), issues: new Map(), error: error instanceof Error ? error.message : "No se pudieron verificar los recursos del paquete.", loading: false });
    });
    return () => { cancelled = true; owner.active = false; owned.forEach((url) => URL.revokeObjectURL(url)); };
  }, [record]);
  // Never expose the previous source's assets while the next one loads.
  const current = state.record === record && state.owner.active ? state : { urls: emptyUrls(), issues: new Map<string, string>(), error: "", loading: !!record };
  return { resourceUrls: current.urls, resourceIssues: current.issues, resourceError: current.error, resourcesLoading: current.loading };
}
