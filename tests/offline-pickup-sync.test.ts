import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/offline/connectivity", () => ({ checkConnectivity: vi.fn(async () => true) }));
import { offlineStore, type OfflineAttachment, type OfflineOperation, type PickupSnapshot } from "@/lib/offline/offline-store";
import { syncNow } from "@/lib/offline/sync-engine";

const owner = [randomUUID(), randomUUID()] as const;
const request = (req: IDBRequest): Promise<void> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
const locks = { request: async (_key: string, _options: object, callback: (lock: object) => Promise<unknown>) => callback({}) };
function fixture() {
  const id = randomUUID(), now = new Date().toISOString();
  const operation: OfflineOperation = { id, clientOperationId: id, tenantId: owner[0], userId: owner[1], deviceId: randomUUID(), operationType: "PICKUP_ATTACHMENTS", aggregateType: "ReservationPickup", aggregateId: randomUUID(), expectedVersion: 2, payload: { description: "Anexos de retirada" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
  const evidenceBlob = new Blob([new Uint8Array([137,80,78,71,1])], { type: "image/png" });
  const signatureBlob = new Blob([new Uint8Array(100)], { type: "image/png" });
  const base = { operationId: id, tenantId: owner[0], userId: owner[1], aggregateType: "ReservationPickup" as const, aggregateId: operation.aggregateId, expectedVersion: 2, createdAt: now, updatedAt: now, status: "LOCAL" as const, attemptCount: 0, schemaVersion: 2 as const };
  const evidence: OfflineAttachment = { ...base, id: randomUUID(), purpose: "PICKUP_EVIDENCE", type: "OUTPUT_CONDITION", blob: evidenceBlob, mimeType: evidenceBlob.type, size: evidenceBlob.size, checksum: "a".repeat(64) };
  const signature: OfflineAttachment = { ...base, id: randomUUID(), purpose: "PICKUP_SIGNATURE", type: "SIGNATURE", blob: signatureBlob, mimeType: signatureBlob.type, size: signatureBlob.size, checksum: "b".repeat(64), termsVersion: "pickup-acceptance-v1", termsHash: "c".repeat(64), width: 300, height: 120, capturedAtDevice: now };
  return { operation, evidence, signature };
}
async function fullFixture() {
  const f = fixture(), pickupItemId = randomUUID(), resourceId = randomUUID(), now = new Date().toISOString();
  const snapshot: PickupSnapshot = { tenantId: owner[0], userId: owner[1], pickupId: f.operation.aggregateId, reservationId: randomUUID(), reservationCode: "R-1", serverUpdatedAt: now, expectedVersion: 1, pickupStatus: "IN_PROGRESS", cachedAt: now, schemaVersion: 1, recipientName: "Motorista", recipientDocument: "", recipientPhone: "", vehiclePlate: "", notes: "", items: [{ pickupItemId, resourceId, resourceCode: "VEH-1", resourceName: "Veículo", condition: "OK", notes: "" }], termsVersion: "pickup-acceptance-v1", termsHash: "c".repeat(64), termsSnapshot: "Termo", canInspect: true, canAddEvidence: true, canComplete: true, canSign: true };
  await offlineStore.cachePickup(snapshot);
  const draft = { recipientName: "Motorista", recipientDocument: "", recipientPhone: "", vehiclePlate: "", notes: "", items: [{ pickupItemId, condition: "OK" as const, notes: "" }], savedAt: now };
  await offlineStore.savePickupDraft(snapshot.pickupId, ...owner, draft);
  f.operation.expectedVersion = 1;
  f.operation.deviceId = await offlineStore.deviceId();
  f.operation.payload.inspection = draft;
  await offlineStore.saveOperation(f.operation, [f.evidence, f.signature]);
  const completion = await offlineStore.queuePickupCompletion(snapshot.pickupId, ...owner);
  return { ...f, snapshot, completion };
}
beforeEach(async () => { vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("navigator", { locks, onLine: true }); await request(indexedDB.deleteDatabase("codex-unit-offline")); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("offline pickup attachment chain", () => {
  it("persists local completion and dependencies, then cleans all Blobs/snapshot only after FULL ACK", async () => {
    const f = await fullFixture();
    expect(f.completion.status).toBe("PENDING");
    expect(f.completion.dependsOnOperationIds).toEqual([f.operation.id]);
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      if (url.endsWith("/pickup")) return Response.json({ resultReference: f.operation.aggregateId, serverVersion: 2 });
      if (url.endsWith("/pickup-complete")) return Response.json({ clientOperationId: f.completion.id, pickupId: f.snapshot.pickupId, pickupStatus: "COMPLETED", completedAt: new Date().toISOString(), resultReference: f.snapshot.pickupId, processedAt: new Date().toISOString(), resourceResults: [{ resourceId: f.snapshot.items[0].resourceId, operationalStatus: "IN_USE" }], custodyEventIds: [randomUUID()], custodyConfirmed: true, acceptanceId: randomUUID(), evidenceConfirmed: true, fullAck: true });
      const metadata = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
      return Response.json({ attachmentId: metadata.attachmentId, checksum: metadata.checksum, ...(metadata.purpose === "PICKUP_SIGNATURE" ? { acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" } : { evidenceId: randomUUID(), status: "SERVER_CONFIRMED" }) });
    }));
    const result = await syncNow(...owner);
    expect(result.completedPickups).toBe(1);
    expect(urls.at(-1)).toContain("/pickup-complete");
    expect(await offlineStore.getPendingOperations(...owner)).toEqual([]);
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toEqual([]);
    expect(await offlineStore.getPickupSnapshot(f.snapshot.pickupId, ...owner)).toBeUndefined();
    await expect(offlineStore.queuePickupCompletion(f.snapshot.pickupId, ...owner)).rejects.toThrow();
  });
  it("retains Acceptance/evidence and recovers a lost completion response without repeating uploads", async () => {
    const f = await fullFixture(); let completeCalls = 0, attachmentCalls = 0, intentCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/pickup")) { intentCalls++; return Response.json({ resultReference: f.snapshot.pickupId, serverVersion: 2 }); }
      if (url.endsWith("/pickup-complete")) { completeCalls++; if (completeCalls === 1) throw new Error("response lost after commit"); return Response.json({ clientOperationId: f.completion.id, pickupId: f.snapshot.pickupId, pickupStatus: "COMPLETED", completedAt: new Date().toISOString(), resultReference: f.snapshot.pickupId, processedAt: new Date().toISOString(), resourceResults: [{ resourceId: f.snapshot.items[0].resourceId, operationalStatus: "IN_USE" }], custodyEventIds: [randomUUID()], custodyConfirmed: true, fullAck: true }); }
      attachmentCalls++;
      const metadata = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
      return Response.json({ attachmentId: metadata.attachmentId, checksum: metadata.checksum, ...(metadata.purpose === "PICKUP_SIGNATURE" ? { acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" } : { evidenceId: randomUUID(), status: "SERVER_CONFIRMED" }) });
    }));
    expect((await syncNow(...owner)).completedPickups).toBe(0);
    expect((await offlineStore.getPendingOperations(...owner)).find(row => row.operationType === "PICKUP_COMPLETE")?.status).toBe("FAILED_RETRYABLE");
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 120_000);
    expect((await syncNow(...owner)).completedPickups).toBe(1);
    expect(completeCalls).toBe(2); expect(attachmentCalls).toBe(2); expect(intentCalls).toBe(1);
  });
  it("recovers a persisted FULL ACK after crash before cleanup without another network request", async () => {
    const f = await fullFixture();
    await offlineStore.update(f.operation.id, ...owner, { status: "SYNCED" });
    await offlineStore.updateAttachment(f.evidence.id, ...owner, "PENDING_UPLOAD"); await offlineStore.updateAttachment(f.evidence.id, ...owner, "UPLOADING"); await offlineStore.updateAttachment(f.evidence.id, ...owner, "SERVER_CONFIRMED", { serverEvidenceId: randomUUID() });
    await offlineStore.updateAttachment(f.signature.id, ...owner, "PENDING_UPLOAD"); await offlineStore.updateAttachment(f.signature.id, ...owner, "UPLOADING"); await offlineStore.updateAttachment(f.signature.id, ...owner, "SERVER_CONFIRMED", { serverAcceptanceId: randomUUID() });
    await offlineStore.update(f.completion.id, ...owner, { status: "SYNCED", fullAck: true, serverResultId: f.snapshot.pickupId });
    vi.stubGlobal("fetch", vi.fn());
    await syncNow(...owner);
    expect(fetch).not.toHaveBeenCalled();
    expect(await offlineStore.getPendingOperations(...owner)).toEqual([]);
    expect(await offlineStore.getPickupSnapshot(f.snapshot.pickupId, ...owner)).toBeUndefined();
  });
  it("never cleans on 401, 403 or 409 from completion", async () => {
    for (const rejection of [401, 403, 409]) {
      await request(indexedDB.deleteDatabase("codex-unit-offline"));
      const f = await fullFixture();
      vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/pickup")) return Response.json({ resultReference: f.snapshot.pickupId, serverVersion: 2 });
        if (url.endsWith("/pickup-complete")) return Response.json({ code: rejection === 401 ? "UNAUTHENTICATED" : rejection === 403 ? "FORBIDDEN" : "CONFLICT" }, { status: rejection });
        const metadata = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
        return Response.json({ attachmentId: metadata.attachmentId, checksum: metadata.checksum, ...(metadata.purpose === "PICKUP_SIGNATURE" ? { acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" } : { evidenceId: randomUUID(), status: "SERVER_CONFIRMED" }) });
      }));
      await syncNow(...owner);
      const completion = (await offlineStore.getPendingOperations(...owner)).find(row => row.operationType === "PICKUP_COMPLETE");
      expect(completion?.status).toBe(rejection === 401 ? "AUTH_REQUIRED" : rejection === 403 ? "FAILED_PERMANENT" : "CONFLICT");
      expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
      expect(await offlineStore.getPickupSnapshot(f.snapshot.pickupId, ...owner)).toBeTruthy();
      await expect(offlineStore.cleanupPickupAfterFullAck(f.snapshot.pickupId, ...owner)).rejects.toThrow("FULL ACK ausente");
    }
  });
  it("does not call completion if required evidence upload fails", async () => {
    const f = await fullFixture(); let completionCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/pickup")) return Response.json({ resultReference: f.snapshot.pickupId, serverVersion: 2 });
      if (url.endsWith("/pickup-complete")) { completionCalls++; return Response.json({}); }
      const metadata = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
      if (metadata.purpose === "PICKUP_EVIDENCE") return Response.json({ code: "TEMPORARY" }, { status: 500 });
      return Response.json({ attachmentId: metadata.attachmentId, checksum: metadata.checksum, acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" });
    }));
    await syncNow(...owner);
    expect(completionCalls).toBe(0);
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
  });
  it("uploads evidence before signature, retains Blobs after Acceptance and never sends completion", async () => {
    const f = fixture(); await offlineStore.saveOperation(f.operation, [f.signature, f.evidence]);
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      urls.push(url);
      if (url.endsWith("/pickup")) return Response.json({ resultReference: f.operation.aggregateId });
      const metadata = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
      return Response.json({ attachmentId: metadata.attachmentId, checksum: metadata.checksum, ...(metadata.purpose === "PICKUP_SIGNATURE" ? { acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" } : { evidenceId: randomUUID(), status: "SERVER_CONFIRMED" }) });
    }));
    const simultaneous = await Promise.all([syncNow(...owner), syncNow(...owner)]);
    expect(simultaneous.reduce((sum, result) => sum + result.synced, 0)).toBe(1);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain("/pickup");
    expect(urls.every(url => !url.includes("complete"))).toBe(true);
    const saved = await offlineStore.getAttachments(f.operation.id, ...owner);
    expect(saved).toHaveLength(2);
    expect(saved.every(row => row.status === "SERVER_CONFIRMED")).toBe(true);
    expect(saved.find(row => row.purpose === "PICKUP_SIGNATURE")?.serverAcceptanceId).toBeTruthy();
    expect((await offlineStore.getPendingOperations(...owner))[0].status).toBe("SYNCED");
    await syncNow(...owner);
    expect(urls).toHaveLength(3);
  });
  it("preserves signature and blocks it when evidence fails; retry resumes without duplicating intent", async () => {
    const f = fixture(); await offlineStore.saveOperation(f.operation, [f.evidence, f.signature]);
    let intents = 0, evidenceAttempts = 0, signatureAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/pickup")) { intents++; return Response.json({ resultReference: f.operation.aggregateId }); }
      const meta = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
      if (meta.purpose === "PICKUP_EVIDENCE") { evidenceAttempts++; if (evidenceAttempts === 1) return Response.json({ code: "TEMPORARY" }, { status: 500 }); return Response.json({ attachmentId: meta.attachmentId, checksum: meta.checksum, evidenceId: randomUUID(), status: "SERVER_CONFIRMED" }); }
      signatureAttempts++;
      return Response.json({ attachmentId: meta.attachmentId, checksum: meta.checksum, acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" });
    }));
    await syncNow(...owner);
    expect(signatureAttempts).toBe(0);
    expect((await offlineStore.getAttachments(f.operation.id, ...owner)).find(row => row.purpose === "PICKUP_SIGNATURE")?.status).toBe("LOCAL");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 120_000);
    expect((await syncNow(...owner)).synced).toBe(1);
    expect(intents).toBe(1); expect(evidenceAttempts).toBe(2); expect(signatureAttempts).toBe(1);
  });
  it("retains both Blobs across 401, crash recovery and another tab's lock", async () => {
    const f = fixture(); await offlineStore.saveOperation(f.operation, [f.evidence, f.signature]);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "AUTH_REQUIRED" }, { status: 401 })));
    expect((await syncNow(...owner)).authRequired).toBe(true);
    expect((await offlineStore.getPendingOperations(...owner))[0].status).toBe("AUTH_REQUIRED");
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
    vi.stubGlobal("navigator", { locks: { request: async (_key: string, _options: object, callback: (lock: null) => Promise<unknown>) => callback(null) }, onLine: true });
    await syncNow(...owner);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.stubGlobal("navigator", { locks, onLine: true });
    await offlineStore.updateAttachment(f.evidence.id, ...owner, "PENDING_UPLOAD");
    await offlineStore.updateAttachment(f.evidence.id, ...owner, "UPLOADING");
    await offlineStore.recoverUploads(...owner, [f.operation.id]);
    expect((await offlineStore.getAttachments(f.operation.id, ...owner)).find(row => row.id === f.evidence.id)?.status).toBe("FAILED_RETRYABLE");
  });
  it("preserves confirmed evidence and signature Blob on a signature 401, then resumes after login", async () => {
    const f = fixture(); await offlineStore.saveOperation(f.operation, [f.evidence, f.signature]);
    let intentSends = 0, evidenceSends = 0, signatureSends = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/pickup")) { intentSends++; return Response.json({ resultReference: f.operation.aggregateId }); }
      const meta = JSON.parse(String((init.body as FormData).get("metadata"))) as { purpose: string; attachmentId: string; checksum: string };
      if (meta.purpose === "PICKUP_EVIDENCE") { evidenceSends++; return Response.json({ attachmentId: meta.attachmentId, checksum: meta.checksum, evidenceId: randomUUID(), status: "SERVER_CONFIRMED" }); }
      signatureSends++;
      if (signatureSends === 1) return Response.json({ code: "AUTH_REQUIRED" }, { status: 401 });
      return Response.json({ attachmentId: meta.attachmentId, checksum: meta.checksum, acceptanceId: randomUUID(), status: "ACCEPTANCE_VERIFIED" });
    }));
    expect((await syncNow(...owner)).authRequired).toBe(true);
    expect((await offlineStore.getPendingOperations(...owner))[0].status).toBe("AUTH_REQUIRED");
    expect((await offlineStore.getAttachments(f.operation.id, ...owner)).find(row => row.purpose === "PICKUP_SIGNATURE")?.status).toBe("AUTH_REQUIRED");
    expect((await syncNow(...owner)).synced).toBe(1);
    expect(intentSends).toBe(1); expect(evidenceSends).toBe(1); expect(signatureSends).toBe(2);
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
  });
  it("keeps Blobs after revoked permission without any second upload", async () => {
    const f = fixture(); await offlineStore.saveOperation(f.operation, [f.evidence, f.signature]);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "FORBIDDEN" }, { status: 403 })));
    const result = await syncNow(...owner);
    expect(result.failed).toBe(1);
    expect((await offlineStore.getPendingOperations(...owner))[0].status).toBe("FAILED_PERMANENT");
    expect(await offlineStore.getAttachments(f.operation.id, ...owner)).toHaveLength(2);
  });
});
