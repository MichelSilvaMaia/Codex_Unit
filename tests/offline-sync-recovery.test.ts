import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  recoverInterrupted: vi.fn(), getPendingOperations: vi.fn(), markSyncing: vi.fn(),
  markAuthRequired: vi.fn(), markFailed: vi.fn(), markSynced: vi.fn(),
  resolveDependency: vi.fn(), deleteSynced: vi.fn(),
}));
vi.mock("@/lib/offline/offline-store", () => ({ offlineStore: store }));
vi.mock("@/lib/offline/connectivity", () => ({ checkConnectivity: vi.fn(async () => true) }));
import { syncNow } from "@/lib/offline/sync-engine";

const operation = {
  id: "one", clientOperationId: "one", tenantId: "tenant", userId: "user", deviceId: "device",
  operationType: "MAINTENANCE_ADD_DIAGNOSIS", aggregateType: "MaintenanceOrder", aggregateId: "order",
  expectedVersion: 1, payload: { description: "Teste" }, dependsOnOperationIds: [],
  status: "SYNCING", attemptCount: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01", schemaVersion: 1,
};
describe("offline sync recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: object, callback: (lock: object) => Promise<unknown>) => callback({}) } });
    store.getPendingOperations.mockResolvedValue([{ ...operation, status: "FAILED_RETRYABLE" }]);
  });
  it("recovers interrupted work under the lock and retains it on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 401, ok: false })));
    const result = await syncNow("tenant", "user");
    expect(store.recoverInterrupted).toHaveBeenCalledWith("tenant", "user");
    expect(store.markAuthRequired).toHaveBeenCalledWith("one", "tenant", "user");
    expect(store.deleteSynced).not.toHaveBeenCalled();
    expect(result.authRequired).toBe(true);
  });
  it("does not send when another tab owns the lock", async () => {
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: object, callback: (lock: null) => Promise<unknown>) => callback(null) } });
    vi.stubGlobal("fetch", vi.fn());
    await syncNow("tenant", "user");
    expect(store.recoverInterrupted).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
