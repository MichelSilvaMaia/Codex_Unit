import { checkConnectivity } from "./connectivity";
import { offlineStore, type OfflineOperation } from "./offline-store";

export type SyncSummary = { synced: number; conflicts: number; failed: number; authRequired: boolean; online: boolean };
const empty = (online: boolean): SyncSummary => ({ synced: 0, conflicts: 0, failed: 0, authRequired: false, online });
let running = false;

async function runQueue(tenantId: string, userId: string): Promise<SyncSummary> {
  const online = await checkConnectivity(), summary = empty(online);
  if (!online) return summary;
  await offlineStore.recoverInterrupted(tenantId, userId);
  const operations = await offlineStore.getPendingOperations(tenantId, userId);
  const available = new Set(operations.filter(o => o.status === "SYNCED").map(o => o.id));
  for (const operation of operations) {
    if (!["PENDING", "FAILED_RETRYABLE", "AUTH_REQUIRED"].includes(operation.status)) continue;
    if (operation.nextAttemptAt && new Date(operation.nextAttemptAt).getTime() > Date.now()) continue;
    if (operation.dependsOnOperationIds.some(id => !available.has(id))) continue;
    await offlineStore.markSyncing(operation.id, tenantId, userId);
    let response: Response;
    try {
      response = await fetch("/api/sync/maintenance", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation), cache: "no-store" });
    } catch {
      await retry(operation, "NETWORK_ERROR"); summary.failed++; break;
    }
    if (response.status === 401) { await offlineStore.markAuthRequired(operation.id, tenantId, userId); summary.authRequired = true; break; }
    if (response.ok) {
      const result = await response.json() as { resultReference?: string };
      await offlineStore.markSynced(operation.id, tenantId, userId, result.resultReference);
      available.add(operation.id);
      await offlineStore.resolveDependency(operation.id, tenantId, userId);
      await offlineStore.deleteSynced(operation.id, tenantId, userId);
      summary.synced++; continue;
    }
    const error = await response.json().catch(() => ({ code: `HTTP_${response.status}` })) as { code?: string };
    if (response.status === 409) { await offlineStore.markFailed(operation.id, tenantId, userId, "CONFLICT", "CONFLICT", operation.attemptCount + 1); summary.conflicts++; continue; }
    if (response.status === 429 || response.status >= 500) await retry(operation, error.code ?? `HTTP_${response.status}`);
    else await offlineStore.markFailed(operation.id, tenantId, userId, "FAILED_PERMANENT", error.code ?? `HTTP_${response.status}`, operation.attemptCount + 1);
    summary.failed++;
  }
  return summary;
}
async function retry(operation: OfflineOperation, code: string) {
  const attempts = operation.attemptCount + 1;
  const delay = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6)) + Math.floor(Math.random() * 1000);
  await offlineStore.markFailed(operation.id, operation.tenantId, operation.userId, "FAILED_RETRYABLE", code, attempts, new Date(Date.now() + delay).toISOString());
}
export async function syncNow(tenantId: string, userId: string): Promise<SyncSummary> {
  if (running) return empty(false);
  running = true;
  try {
    if (!navigator.locks?.request) return empty(await checkConnectivity()); // No cross-tab lock: do not risk duplicate send.
    return await navigator.locks.request(`codex-unit-sync-${tenantId}-${userId}`, { ifAvailable: true }, async lock => lock ? runQueue(tenantId, userId) : empty(await checkConnectivity()));
  } finally { running = false; }
}
