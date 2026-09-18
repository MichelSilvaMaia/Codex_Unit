import "fake-indexeddb/auto";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { offlineStore, type PickupDraft, type PickupSnapshot } from "@/lib/offline/offline-store";

const dbName = "codex-unit-offline";
const request = <T>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
function snapshot(): PickupSnapshot {
  return { tenantId: randomUUID(), userId: randomUUID(), pickupId: randomUUID(), reservationId: randomUUID(), reservationCode: "R-1", serverUpdatedAt: "2026-09-18T00:00:00.000Z", pickupStatus: "IN_PROGRESS", cachedAt: "2026-09-18T00:00:00.000Z", schemaVersion: 1, recipientName: "Pessoa Original", recipientDocument: "", recipientPhone: "", vehiclePlate: "", notes: "", items: [{ pickupItemId: randomUUID(), resourceId: randomUUID(), resourceCode: "VEH-1", resourceName: "Veículo", condition: "OK", notes: "" }], termsVersion: "pickup-acceptance-v1", termsHash: "a".repeat(64), termsSnapshot: "Termo original", canInspect: true, canComplete: true, canSign: true };
}
describe("offline pickup snapshot v3", () => {
  beforeEach(async () => { await request(indexedDB.deleteDatabase(dbName)); });
  it("preserves a recipient and inspection draft across reopening without cross-user or cross-tenant access", async () => {
    const original = snapshot();
    await offlineStore.cachePickup(original);
    const draft: PickupDraft = { recipientName: "Novo Destinatário", recipientDocument: "123", recipientPhone: "11999999999", vehiclePlate: "ABC1234", notes: "Observação", items: [{ pickupItemId: original.items[0].pickupItemId, condition: "DAMAGED", notes: "Avaria visível" }], savedAt: new Date().toISOString() };
    await offlineStore.savePickupDraft(original.pickupId, original.tenantId, original.userId, draft);
    expect((await offlineStore.getPickupSnapshot(original.pickupId, original.tenantId, original.userId))?.draft).toEqual(draft);
    expect(await offlineStore.getPickupSnapshot(original.pickupId, original.tenantId, randomUUID())).toBeUndefined();
    expect(await offlineStore.getPickupSnapshot(original.pickupId, randomUUID(), original.userId)).toBeUndefined();
    await expect(offlineStore.savePickupDraft(original.pickupId, original.tenantId, randomUUID(), draft)).rejects.toThrow();
    await offlineStore.cachePickup({ ...original, serverUpdatedAt: "2026-09-18T01:00:00.000Z", termsHash: "b".repeat(64) });
    const retained = await offlineStore.getPickupSnapshot(original.pickupId, original.tenantId, original.userId);
    expect(retained?.serverUpdatedAt).toBe(original.serverUpdatedAt);
    expect(retained?.termsHash).toBe(original.termsHash);
    expect(retained?.draft).toEqual(draft);
  });
  it("upgrades v2 while preserving maintenance operations and Blobs", async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(dbName, 2); req.onupgradeneeded = () => { const db = req.result; const operations = db.createObjectStore("offlineOperations", { keyPath: "id" }); operations.createIndex("owner", ["tenantId", "userId"]); const attachments = db.createObjectStore("offlineAttachments", { keyPath: "id" }); attachments.createIndex("operationId", "operationId"); db.createObjectStore("offlineMetadata", { keyPath: "key" }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const opId = randomUUID(), tenantId = randomUUID(), userId = randomUUID(), blob = new Blob([new Uint8Array([1,2,3])]);
    const tx = legacy.transaction(["offlineOperations", "offlineAttachments"], "readwrite");
    tx.objectStore("offlineOperations").put({ id: opId, tenantId, userId, status: "AUTH_REQUIRED", createdAt: "2026-09-18" });
    tx.objectStore("offlineAttachments").put({ id: randomUUID(), operationId: opId, tenantId, userId, blob, status: "LOCAL" });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); legacy.close();
    await offlineStore.cachePickup(snapshot());
    expect((await offlineStore.getPendingOperations(tenantId, userId))[0].status).toBe("AUTH_REQUIRED");
    expect(new Uint8Array(await (await offlineStore.getAttachments(opId, tenantId, userId))[0].blob.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
  });
  it("rejects a draft with missing or foreign inspection item", async () => {
    const original = snapshot(); await offlineStore.cachePickup(original);
    const invalid: PickupDraft = { recipientName: "Pessoa", recipientDocument: "", recipientPhone: "", vehiclePlate: "", notes: "", items: [{ pickupItemId: randomUUID(), condition: "OK", notes: "" }], savedAt: new Date().toISOString() };
    await expect(offlineStore.savePickupDraft(original.pickupId, original.tenantId, original.userId, invalid)).rejects.toThrow();
  });
});
