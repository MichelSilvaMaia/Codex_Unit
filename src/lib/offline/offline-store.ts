export type OfflineStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT" | "CONFLICT";
export type OfflineOperation = {
  id: string; clientOperationId: string; tenantId: string; userId: string; deviceId: string;
  operationType: "MAINTENANCE_ADD_DIAGNOSIS" | "MAINTENANCE_ADD_ACTIVITY";
  aggregateType: "MaintenanceOrder"; aggregateId: string; expectedVersion: number;
  payload: { description: string; type?: "INSPECTION" | "REPAIR" | "CLEANING" | "TEST" | "ADJUSTMENT" | "OTHER" };
  dependsOnOperationIds: string[]; status: OfflineStatus; attemptCount: number;
  createdAt: string; updatedAt: string; lastAttemptAt?: string; nextAttemptAt?: string;
  lastErrorCode?: string; serverResultId?: string; syncedAt?: string; schemaVersion: 1;
};
export type OfflineAttachment = { id: string; operationId: string; tenantId: string; userId: string; blob: Blob; mimeType: string; size: number; checksum: string; createdAt: string };
type Metadata = { key: string; value: string };
const DB_NAME = "codex-unit-offline";
const DB_VERSION = 1;
const stores = { operations: "offlineOperations", attachments: "offlineAttachments", metadata: "offlineMetadata" } as const;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
}
async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB indisponível neste dispositivo.");
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(stores.operations)) {
      const operations = db.createObjectStore(stores.operations, { keyPath: "id" });
      operations.createIndex("owner", ["tenantId", "userId"]);
    }
    if (!db.objectStoreNames.contains(stores.attachments)) db.createObjectStore(stores.attachments, { keyPath: "id" });
    if (!db.objectStoreNames.contains(stores.metadata)) db.createObjectStore(stores.metadata, { keyPath: "key" });
  };
  return requestResult(request);
}
async function withStore<T>(name: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try { const tx = db.transaction(name, mode); const result = await action(tx.objectStore(name)); await transactionDone(tx); return result; }
  finally { db.close(); }
}
export const offlineStore = {
  async deviceId() {
    const db = await openDatabase();
    try {
      const tx = db.transaction(stores.metadata, "readwrite"), store = tx.objectStore(stores.metadata);
      const existing = await requestResult(store.get("deviceId") as IDBRequest<Metadata | undefined>);
      const id = existing?.value ?? crypto.randomUUID();
      if (!existing) store.put({ key: "deviceId", value: id });
      await transactionDone(tx); return id;
    } finally { db.close(); }
  },
  async saveOperation(operation: OfflineOperation, attachments: OfflineAttachment[] = []) {
    if (!operation.id || operation.id !== operation.clientOperationId || operation.schemaVersion !== 1 || attachments.some(a => a.operationId !== operation.id || a.tenantId !== operation.tenantId || a.userId !== operation.userId)) throw new Error("Operação local inválida.");
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments, stores.metadata], "readwrite");
      tx.objectStore(stores.operations).put(operation);
      for (const attachment of attachments) tx.objectStore(stores.attachments).put(attachment);
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async getPendingOperations(tenantId: string, userId: string) {
    return withStore(stores.operations, "readonly", async store => {
      const rows = await requestResult(store.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  },
  async update(id: string, tenantId: string, userId: string, patch: Partial<OfflineOperation>) {
    return withStore(stores.operations, "readwrite", async store => {
      const current = await requestResult(store.get(id) as IDBRequest<OfflineOperation | undefined>);
      if (!current || current.tenantId !== tenantId || current.userId !== userId) throw new Error("Operação local não encontrada.");
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      store.put(next); return next;
    });
  },
  markSyncing(id: string, tenantId: string, userId: string) { return this.update(id, tenantId, userId, { status: "SYNCING", lastAttemptAt: new Date().toISOString() }); },
  markSynced(id: string, tenantId: string, userId: string, serverResultId?: string) { return this.update(id, tenantId, userId, { status: "SYNCED", syncedAt: new Date().toISOString(), serverResultId }); },
  markFailed(id: string, tenantId: string, userId: string, status: "FAILED_RETRYABLE" | "FAILED_PERMANENT" | "CONFLICT", code: string, attempts: number, nextAttemptAt?: string) { return this.update(id, tenantId, userId, { status, lastErrorCode: code, attemptCount: attempts, nextAttemptAt }); },
  async deleteSynced(id: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments], "readwrite");
      const operation = await requestResult(tx.objectStore(stores.operations).get(id) as IDBRequest<OfflineOperation | undefined>);
      if (!operation || operation.tenantId !== tenantId || operation.userId !== userId || operation.status !== "SYNCED") throw new Error("Não há confirmação de sincronização para limpeza.");
      const attachments = await requestResult(tx.objectStore(stores.attachments).getAll() as IDBRequest<OfflineAttachment[]>);
      for (const attachment of attachments.filter(a => a.operationId === id)) tx.objectStore(stores.attachments).delete(attachment.id);
      tx.objectStore(stores.operations).delete(id); await transactionDone(tx);
    } finally { db.close(); }
  },
  async resolveDependency(completedId: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(stores.operations, "readwrite"), store = tx.objectStore(stores.operations);
      const rows = await requestResult(store.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      for (const row of rows) if (row.dependsOnOperationIds.includes(completedId)) store.put({ ...row, dependsOnOperationIds: row.dependsOnOperationIds.filter(id => id !== completedId) });
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async discardRejected(id: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments, stores.metadata], "readwrite");
      const operation = await requestResult(tx.objectStore(stores.operations).get(id) as IDBRequest<OfflineOperation | undefined>);
      if (!operation || operation.tenantId !== tenantId || operation.userId !== userId || !["CONFLICT", "FAILED_PERMANENT"].includes(operation.status)) throw new Error("Somente operações rejeitadas podem ser descartadas.");
      const attachments = await requestResult(tx.objectStore(stores.attachments).getAll() as IDBRequest<OfflineAttachment[]>);
      for (const attachment of attachments.filter(a => a.operationId === id)) tx.objectStore(stores.attachments).delete(attachment.id);
      tx.objectStore(stores.operations).delete(id);
      tx.objectStore(stores.metadata).put({ key: `discard:${id}`, value: new Date().toISOString() });
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async saveAttachment(attachment: OfflineAttachment) { return withStore(stores.attachments, "readwrite", async store => { store.put(attachment); }); },
  async deleteAttachment(id: string) { return withStore(stores.attachments, "readwrite", async store => { store.delete(id); }); },
  async getStorageUsage() { return navigator.storage?.estimate?.() ?? { usage: undefined, quota: undefined }; },
};
