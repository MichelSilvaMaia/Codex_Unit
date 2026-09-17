import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { offlineStore, type OfflineAttachment, type OfflineOperation } from "@/lib/offline/offline-store";

const dbName = "codex-unit-offline";
function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
const owner = [randomUUID(), randomUUID()] as const;
const now = new Date().toISOString();
function operation(): OfflineOperation { const id = randomUUID(); return { id, clientOperationId: id, tenantId: owner[0], userId: owner[1], deviceId: randomUUID(), operationType: "MAINTENANCE_ADD_EVIDENCE", aggregateType: "MaintenanceOrder", aggregateId: randomUUID(), expectedVersion: 1, payload: { description: "Evidência de manutenção" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 }; }
async function attachment(op: OfflineOperation): Promise<OfflineAttachment> {
  const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: "image/png" });
  const checksum = Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256", await blob.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
  return { id: randomUUID(), operationId: op.id, tenantId: op.tenantId, userId: op.userId, aggregateType: "MaintenanceOrder", aggregateId: op.aggregateId, purpose: "MAINTENANCE_EVIDENCE", type: "DIAGNOSIS", blob, mimeType: blob.type, size: blob.size, checksum, createdAt: now, updatedAt: now, status: "LOCAL", attemptCount: 0, schemaVersion: 2 };
}
describe("IndexedDB attachment lifecycle", () => {
  beforeEach(async () => { vi.stubGlobal("crypto", webcrypto); await request(indexedDB.deleteDatabase(dbName)); });
  it("persists Blob across reopening, isolates owners, recovers UPLOADING and gates cleanup", async () => {
    const op = operation(), photo = await attachment(op);
    await offlineStore.saveOperation(op, [photo]);
    const rows = await offlineStore.getAttachments(op.id, ...owner);
    expect(new Uint8Array(await rows[0].blob.arrayBuffer())).toEqual(new Uint8Array(await photo.blob.arrayBuffer()));
    expect(rows[0].checksum).toBe(photo.checksum);
    expect(await offlineStore.getAttachments(op.id, owner[0], randomUUID())).toEqual([]);
    expect(await offlineStore.getAttachments(op.id, randomUUID(), owner[1])).toEqual([]);
    await expect(offlineStore.updateAttachment(photo.id, owner[0], randomUUID(), "PENDING_UPLOAD")).rejects.toThrow();
    await offlineStore.updateAttachment(photo.id, ...owner, "PENDING_UPLOAD");
    await offlineStore.updateAttachment(photo.id, ...owner, "UPLOADING");
    await offlineStore.recoverUploads(...owner, [op.id]);
    expect((await offlineStore.getAttachments(op.id, ...owner))[0].status).toBe("FAILED_RETRYABLE");
    await offlineStore.markSynced(op.id, ...owner);
    await expect(offlineStore.deleteSynced(op.id, ...owner)).rejects.toThrow("não confirmadas");
    await offlineStore.updateAttachment(photo.id, ...owner, "UPLOADING");
    await offlineStore.updateAttachment(photo.id, ...owner, "SERVER_CONFIRMED", { serverEvidenceId: randomUUID() });
    await offlineStore.deleteSynced(op.id, ...owner);
    expect(await offlineStore.getPendingOperations(...owner)).toEqual([]);
    expect(await offlineStore.getAttachments(op.id, ...owner)).toEqual([]);
  });
  it("upgrades the v1 database without losing legacy operation, auth state or Blob", async () => {
    const op = operation(), photo = await attachment(op);
    op.status = "AUTH_REQUIRED";
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(dbName, 1); req.onupgradeneeded = () => { const db = req.result; const operations = db.createObjectStore("offlineOperations", { keyPath: "id" }); operations.createIndex("owner", ["tenantId", "userId"]); db.createObjectStore("offlineAttachments", { keyPath: "id" }); db.createObjectStore("offlineMetadata", { keyPath: "key" }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const tx = legacy.transaction(["offlineOperations", "offlineAttachments"], "readwrite");
    tx.objectStore("offlineOperations").put(op);
    tx.objectStore("offlineAttachments").put({ ...photo, status: undefined, schemaVersion: undefined });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); legacy.close();
    expect((await offlineStore.getPendingOperations(...owner))[0].status).toBe("AUTH_REQUIRED");
    const recovered = (await offlineStore.getAttachments(op.id, ...owner))[0];
    expect(recovered.status).toBe("LOCAL");
    expect(new Uint8Array(await recovered.blob.arrayBuffer())).toEqual(new Uint8Array(await photo.blob.arrayBuffer()));
  });
  it("does not report a successful save when storage rejects", async () => {
    const op = operation(), photo = await attachment(op);
    await offlineStore.saveOperation(op);
    const invalid = { ...photo, size: photo.size + 1 };
    await expect(offlineStore.saveAttachment(invalid)).rejects.toThrow();
    expect(await offlineStore.getAttachments(op.id, ...owner)).toEqual([]);
  });
  it("aborts operation and Blob together on simulated quota exhaustion", async () => {
    const op = operation(), photo = await attachment(op);
    const original = IDBObjectStore.prototype.add;
    const spy = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === "offlineAttachments") throw new DOMException("No space", "QuotaExceededError");
      return original.call(this, value, key);
    });
    await expect(offlineStore.saveOperation(op, [photo])).rejects.toMatchObject({ name: "QuotaExceededError" });
    spy.mockRestore();
    expect(await offlineStore.getPendingOperations(...owner)).toEqual([]);
    expect(await offlineStore.getAttachments(op.id, ...owner)).toEqual([]);
  });
});
