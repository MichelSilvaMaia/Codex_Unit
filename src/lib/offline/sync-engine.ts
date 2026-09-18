import { checkConnectivity } from "./connectivity";
import { offlineStore, type OfflineAttachment, type AttachmentStatus, type OfflineOperation } from "./offline-store";

export type SyncSummary = { synced: number; conflicts: number; failed: number; authRequired: boolean; online: boolean };
const empty = (online: boolean): SyncSummary => ({ synced: 0, conflicts: 0, failed: 0, authRequired: false, online });
let running = false;

async function runQueue(tenantId: string, userId: string): Promise<SyncSummary> {
  const online = await checkConnectivity(), summary = empty(online);
  if (!online) return summary;
  await offlineStore.recoverInterrupted(tenantId, userId);
  const operations = await offlineStore.getPendingOperations(tenantId, userId);
  await offlineStore.recoverUploads(tenantId, userId, operations.map(o => o.id));
  const available = new Set(operations.filter(o => o.status === "SYNCED").map(o => o.id));
  for (const operation of operations) {
    if (operation.operationType === "PICKUP_ATTACHMENTS" && operation.status === "SYNCED") continue; // retain Blobs until future full pickup ACK
    if (!["PENDING", "FAILED_RETRYABLE", "AUTH_REQUIRED", "SYNCED"].includes(operation.status)) continue;
    if (operation.nextAttemptAt && new Date(operation.nextAttemptAt).getTime() > Date.now()) continue;
    if (operation.dependsOnOperationIds.some(id => !available.has(id))) continue;
    await offlineStore.markSyncing(operation.id, tenantId, userId);
    let response: Response;
    if (!operation.domainConfirmed) {
      try {
        response = await fetch(operation.operationType === "PICKUP_ATTACHMENTS" ? "/api/sync/pickup" : "/api/sync/maintenance", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation), cache: "no-store" });
      } catch { await retry(operation, "NETWORK_ERROR"); summary.failed++; break; }
      if (response.status === 401) { await offlineStore.markAuthRequired(operation.id, tenantId, userId); summary.authRequired = true; break; }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ code: `HTTP_${response.status}` })) as { code?: string };
        if (response.status === 409) { await offlineStore.markFailed(operation.id, tenantId, userId, "CONFLICT", "CONFLICT", operation.attemptCount + 1); summary.conflicts++; continue; }
        if (response.status === 429 || response.status >= 500) await retry(operation, error.code ?? `HTTP_${response.status}`);
        else await offlineStore.markFailed(operation.id, tenantId, userId, "FAILED_PERMANENT", error.code ?? `HTTP_${response.status}`, operation.attemptCount + 1);
        summary.failed++; continue;
      }
      const result = await response.json() as { resultReference?: string };
      await offlineStore.update(operation.id, tenantId, userId, { domainConfirmed: true, serverResultId: result.resultReference });
    }
    const attachments = (await offlineStore.getAttachments(operation.id, tenantId, userId)).sort((a, b) => Number(a.purpose === "PICKUP_SIGNATURE") - Number(b.purpose === "PICKUP_SIGNATURE"));
    let failed = false;
    for (const attachment of attachments) {
      if (attachment.status === "SERVER_CONFIRMED") continue;
      if (attachment.status === "FAILED_PERMANENT" || attachment.status === "CONFLICT") {
        await offlineStore.markFailed(operation.id, tenantId, userId, attachment.status, attachment.lastErrorCode ?? "ATTACHMENT_REJECTED", operation.attemptCount + 1);
        failed = true; break;
      }
      if (attachment.nextAttemptAt && Date.parse(attachment.nextAttemptAt) > Date.now()) { await retry(operation, "ATTACHMENT_BACKOFF"); failed = true; break; }
      const outcome = await uploadAttachment(operation, attachment);
      if (outcome !== "confirmed") {
        failed = true;
        if (outcome === "auth") { await offlineStore.markAuthRequired(operation.id, tenantId, userId); summary.authRequired = true; }
        else if (outcome === "conflict") { await offlineStore.markFailed(operation.id, tenantId, userId, "CONFLICT", "ATTACHMENT_CONFLICT", operation.attemptCount + 1); summary.conflicts++; }
        else if (outcome === "permanent") { await offlineStore.markFailed(operation.id, tenantId, userId, "FAILED_PERMANENT", "ATTACHMENT_REJECTED", operation.attemptCount + 1); summary.failed++; }
        else { await retry(operation, "ATTACHMENT_RETRY"); summary.failed++; }
        break;
      }
    }
    if (failed) { if (summary.authRequired) break; continue; }
    await offlineStore.markSynced(operation.id, tenantId, userId, operation.serverResultId);
    available.add(operation.id);
    await offlineStore.resolveDependency(operation.id, tenantId, userId);
    if (operation.operationType !== "PICKUP_ATTACHMENTS") await offlineStore.deleteSynced(operation.id, tenantId, userId);
    summary.synced++;
  }
  return summary;
}
async function uploadAttachment(operation: OfflineOperation, attachment: OfflineAttachment): Promise<"confirmed" | "retry" | "auth" | "permanent" | "conflict"> {
  const owner = [operation.tenantId, operation.userId] as const;
  if (attachment.status === "LOCAL") await offlineStore.updateAttachment(attachment.id, ...owner, "PENDING_UPLOAD");
  await offlineStore.updateAttachment(attachment.id, ...owner, "UPLOADING", { lastAttemptAt: new Date().toISOString(), attemptCount: attachment.attemptCount + 1 });
  try {
    const form = new FormData();
    form.set("metadata", JSON.stringify({ purpose: attachment.purpose, attachmentId: attachment.id, clientOperationId: operation.clientOperationId, deviceId: operation.deviceId, tenantId: operation.tenantId, userId: operation.userId, aggregateId: operation.aggregateId, type: attachment.type, checksum: attachment.checksum, pickupItemId: attachment.pickupItemId, expectedVersion: attachment.expectedVersion, mimeType: attachment.mimeType, size: attachment.size, termsVersion: attachment.termsVersion, termsHash: attachment.termsHash, capturedAtDevice: attachment.capturedAtDevice, width: attachment.width, height: attachment.height }));
    form.set("evidence", attachment.blob, "evidence");
    const response = await fetch("/api/sync/maintenance-attachment", { method: "POST", credentials: "same-origin", body: form, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (response.ok) {
      const ack = await response.json() as { attachmentId?: string; checksum?: string; evidenceId?: string; acceptanceId?: string; status?: string };
      const signature = attachment.purpose === "PICKUP_SIGNATURE";
      if (ack.attachmentId !== attachment.id || ack.checksum !== attachment.checksum || (signature ? ack.status !== "ACCEPTANCE_VERIFIED" || !ack.acceptanceId : ack.status !== "SERVER_CONFIRMED" || !ack.evidenceId)) throw new Error("ACK_INVALID");
      await offlineStore.updateAttachment(attachment.id, ...owner, "SERVER_CONFIRMED", { serverEvidenceId: ack.evidenceId, serverAcceptanceId: ack.acceptanceId, confirmedAt: new Date().toISOString() });
      return "confirmed";
    }
    const kind: AttachmentStatus = response.status === 401 ? "AUTH_REQUIRED" : response.status === 409 ? "CONFLICT" : response.status === 429 || response.status >= 500 ? "FAILED_RETRYABLE" : "FAILED_PERMANENT";
    await offlineStore.updateAttachment(attachment.id, ...owner, kind, { lastErrorCode: `HTTP_${response.status}`, nextAttemptAt: kind === "FAILED_RETRYABLE" ? backoff(attachment.attemptCount + 1) : undefined });
    return kind === "AUTH_REQUIRED" ? "auth" : kind === "CONFLICT" ? "conflict" : kind === "FAILED_RETRYABLE" ? "retry" : "permanent";
  } catch {
    await offlineStore.updateAttachment(attachment.id, ...owner, "FAILED_RETRYABLE", { lastErrorCode: "NETWORK_OR_ACK_ERROR", nextAttemptAt: backoff(attachment.attemptCount + 1) });
    return "retry";
  }
}
function backoff(attempts: number) { return new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6)) + Math.floor(Math.random() * 1000)).toISOString(); }
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
