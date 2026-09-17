import "fake-indexeddb/auto";
import { randomUUID, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/offline/connectivity", () => ({ checkConnectivity: vi.fn(async () => true) }));
import { offlineStore, type OfflineAttachment, type OfflineOperation } from "@/lib/offline/offline-store";
import { syncNow } from "@/lib/offline/sync-engine";

const owner = [randomUUID(), randomUUID()] as const;
const locks = { request: async (_key: string, _opts: object, callback: (lock: object) => Promise<unknown>) => callback({}) };
const request = (req: IDBRequest): Promise<void> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("domain ACK plus N attachment ACKs", () => {
  it("does not repeat domain mutation or cleanup if one of three uploads fails", async () => {
    vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("navigator", { locks, onLine: true });
    await request(indexedDB.deleteDatabase("codex-unit-offline"));
    const id = randomUUID(), now = new Date().toISOString();
    const op: OfflineOperation = { id, clientOperationId: id, tenantId: owner[0], userId: owner[1], deviceId: randomUUID(), operationType: "MAINTENANCE_ADD_EVIDENCE", aggregateType: "MaintenanceOrder", aggregateId: randomUUID(), expectedVersion: 1, payload: { description: "Evidência de manutenção" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
    const blob = new Blob([new Uint8Array([0x89,0x50,0x4e,0x47,1])], { type: "image/png" });
    const photos: OfflineAttachment[] = Array.from({ length: 3 }, () => ({ id: randomUUID(), operationId: id, tenantId: owner[0], userId: owner[1], aggregateType: "MaintenanceOrder", aggregateId: op.aggregateId, purpose: "MAINTENANCE_EVIDENCE", type: "DIAGNOSIS", blob, mimeType: blob.type, size: blob.size, checksum: "a".repeat(64), createdAt: now, updatedAt: now, status: "LOCAL", attemptCount: 0, schemaVersion: 2 }));
    await offlineStore.saveOperation(op, photos);
    let domainSends = 0, attachmentSends = 0, failOnce = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/maintenance")) { domainSends++; return Response.json({ resultReference: randomUUID() }); }
      attachmentSends++;
      const metadata = JSON.parse(String((init.body as FormData).get("metadata"))) as { attachmentId: string; checksum: string };
      if (attachmentSends === 3 && failOnce) { failOnce = false; return Response.json({ code: "TEMPORARY" }, { status: 500 }); }
      return Response.json({ attachmentId: metadata.attachmentId, checksum: metadata.checksum, evidenceId: randomUUID(), status: "SERVER_CONFIRMED" });
    }));
    const first = await syncNow(...owner);
    expect(first.synced).toBe(0); expect(domainSends).toBe(1);
    expect((await offlineStore.getPendingOperations(...owner))[0].domainConfirmed).toBe(true);
    expect((await offlineStore.getAttachments(id, ...owner)).filter(a => a.status === "SERVER_CONFIRMED")).toHaveLength(2);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 120_000);
    const second = await syncNow(...owner);
    expect(second.synced).toBe(1); expect(domainSends).toBe(1); expect(attachmentSends).toBe(4);
    expect(await offlineStore.getAttachments(id, ...owner)).toEqual([]);
    expect(await offlineStore.getPendingOperations(...owner)).toEqual([]);
  });
});
