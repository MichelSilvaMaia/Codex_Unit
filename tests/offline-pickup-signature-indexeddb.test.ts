import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { offlineStore, type OfflineAttachment, type OfflineOperation } from "@/lib/offline/offline-store";

const request = (req: IDBRequest): Promise<void> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
describe("pickup signature Blob in IndexedDB v3", () => {
  beforeEach(async () => { vi.stubGlobal("crypto", webcrypto); await request(indexedDB.deleteDatabase("codex-unit-offline")); });
  it("persists signature metadata and bytes across reopen while isolating tenant/user", async () => {
    const now = new Date().toISOString(), tenantId = randomUUID(), userId = randomUUID(), id = randomUUID(), pickupId = randomUUID();
    const operation: OfflineOperation = { id, clientOperationId: id, tenantId, userId, deviceId: randomUUID(), operationType: "PICKUP_ATTACHMENTS", aggregateType: "ReservationPickup", aggregateId: pickupId, expectedVersion: 2, payload: { description: "Anexos de retirada" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
    const blob = new Blob([new Uint8Array([1,2,3,4,5])], { type: "image/png" });
    const checksum = Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256", await blob.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
    const signature: OfflineAttachment = { id: randomUUID(), operationId: id, tenantId, userId, aggregateType: "ReservationPickup", aggregateId: pickupId, purpose: "PICKUP_SIGNATURE", type: "SIGNATURE", blob, mimeType: "image/png", size: blob.size, checksum, expectedVersion: 2, termsVersion: "v1", termsHash: "a".repeat(64), capturedAtDevice: now, width: 300, height: 120, createdAt: now, updatedAt: now, status: "LOCAL", attemptCount: 0, schemaVersion: 2 };
    await offlineStore.saveOperation(operation, [signature]);
    const saved = (await offlineStore.getAttachments(id, tenantId, userId))[0];
    expect(new Uint8Array(await saved.blob.arrayBuffer())).toEqual(new Uint8Array([1,2,3,4,5]));
    expect(saved.checksum).toBe(checksum); expect(saved.termsHash).toBe(signature.termsHash);
    expect(await offlineStore.getAttachments(id, tenantId, randomUUID())).toEqual([]);
    expect(await offlineStore.getAttachments(id, randomUUID(), userId)).toEqual([]);
    await expect(offlineStore.removeLocalAttachment(signature.id, tenantId, userId)).rejects.toThrow();
  });
  it("does not report success on a failed Blob write", async () => {
    const now = new Date().toISOString(), tenantId = randomUUID(), userId = randomUUID(), id = randomUUID(), pickupId = randomUUID();
    const operation: OfflineOperation = { id, clientOperationId: id, tenantId, userId, deviceId: randomUUID(), operationType: "PICKUP_ATTACHMENTS", aggregateType: "ReservationPickup", aggregateId: pickupId, expectedVersion: 2, payload: { description: "Anexos de retirada" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
    const blob = new Blob([new Uint8Array([1,2,3])]);
    const invalid: OfflineAttachment = { id: randomUUID(), operationId: id, tenantId, userId, aggregateType: "ReservationPickup", aggregateId: pickupId, purpose: "PICKUP_SIGNATURE", type: "SIGNATURE", blob, mimeType: "image/png", size: 4, checksum: "a".repeat(64), createdAt: now, updatedAt: now, status: "LOCAL", attemptCount: 0, schemaVersion: 2 };
    await expect(offlineStore.saveOperation(operation, [invalid])).rejects.toThrow();
    expect(await offlineStore.getPendingOperations(tenantId, userId)).toEqual([]);
  });
});
