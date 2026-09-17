"use client";
import Link from "next/link";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { checkConnectivity } from "@/lib/offline/connectivity";
import { offlineStore } from "@/lib/offline/offline-store";
import { syncNow } from "@/lib/offline/sync-engine";

export function SyncIndicator({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [online, setOnline] = useState(true), [pending, setPending] = useState(0), [errors, setErrors] = useState(0), [syncing, setSyncing] = useState(false);
  const refresh = useCallback(async () => {
    setOnline(await checkConnectivity());
    const rows = await offlineStore.getPendingOperations(tenantId, userId).catch(() => []);
    setPending(rows.filter(row => ["PENDING", "SYNCING", "FAILED_RETRYABLE"].includes(row.status)).length);
    setErrors(rows.filter(row => ["CONFLICT", "FAILED_PERMANENT"].includes(row.status)).length);
  }, [tenantId, userId]);
  useEffect(() => {
    const run = () => { void refresh(); void syncNow(tenantId, userId).then(refresh).catch(refresh); };
    run();
    window.addEventListener("online", run);
    window.addEventListener("focus", run);
    const timer = window.setInterval(run, 30_000);
    return () => { window.removeEventListener("online", run); window.removeEventListener("focus", run); window.clearInterval(timer); };
  }, [tenantId, userId, refresh]);
  async function manualSync() { setSyncing(true); try { await syncNow(tenantId, userId); } finally { setSyncing(false); await refresh(); } }
  return <div className="flex items-center gap-2 text-xs"><Link href="/sync" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5" aria-label={`Sincronização: ${online ? "online" : "offline"}, ${pending} pendências, ${errors} erros`}>{errors ? <TriangleAlert className="size-4 text-amber-600"/> : online ? <Cloud className="size-4 text-emerald-600"/> : <CloudOff className="size-4"/>}<span>{online ? "Online" : "Offline"}{pending ? ` · ${pending} pendente(s)` : ""}</span></Link>{pending > 0 && online && <button type="button" onClick={manualSync} disabled={syncing} className="rounded-lg border p-1.5" aria-label="Sincronizar agora"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`}/></button>}</div>;
}
