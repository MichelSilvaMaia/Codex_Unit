export type OfflineStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT" | "CONFLICT" | "AUTH_REQUIRED";
export type OfflineOperation = {
  id: string; clientOperationId: string; tenantId: string; userId: string; deviceId: string;
  operationType: "MAINTENANCE_ADD_DIAGNOSIS" | "MAINTENANCE_ADD_ACTIVITY" | "MAINTENANCE_ADD_EVIDENCE" | "PICKUP_ATTACHMENTS" | "PICKUP_COMPLETE" | "RETURN_ATTACHMENTS" | "RETURN_COMPLETE";
  aggregateType: "MaintenanceOrder" | "ReservationPickup" | "ReservationReturn"; aggregateId: string; expectedVersion: number;
  payload: { description: string; type?: "INSPECTION" | "REPAIR" | "CLEANING" | "TEST" | "ADJUSTMENT" | "OTHER"; inspection?: PickupDraft; returnInspection?: ReturnDraft };
  dependsOnOperationIds: string[]; status: OfflineStatus; attemptCount: number;
  createdAt: string; updatedAt: string; lastAttemptAt?: string; nextAttemptAt?: string;
  lastErrorCode?: string; serverResultId?: string; serverVersion?: number; syncedAt?: string; domainConfirmed?: boolean; fullAck?: boolean; schemaVersion: 1;
};
export type AttachmentStatus = "LOCAL" | "PENDING_UPLOAD" | "UPLOADING" | "SERVER_CONFIRMED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT" | "AUTH_REQUIRED" | "CONFLICT";
export type OfflineAttachment = { id: string; operationId: string; tenantId: string; userId: string; aggregateType: "MaintenanceOrder" | "ReservationPickup" | "ReservationReturn"; aggregateId: string; purpose: "MAINTENANCE_EVIDENCE" | "PICKUP_EVIDENCE" | "PICKUP_SIGNATURE" | "RETURN_EVIDENCE"; type: "DAMAGE" | "DIAGNOSIS" | "REPAIR" | "TEST_RESULT" | "FINAL_CONDITION" | "OTHER" | "DIVERGENCE" | "RESOURCE_IDENTIFICATION" | "OUTPUT_CONDITION" | "RETURN_CONDITION" | "RETURN_DAMAGE" | "MISSING_COMPONENT" | "SIGNATURE"; blob: Blob; mimeType: string; size: number; checksum: string; pickupItemId?: string; returnItemId?: string; expectedVersion?: number; termsVersion?: string; termsHash?: string; capturedAtDevice?: string; width?: number; height?: number; createdAt: string; updatedAt: string; status: AttachmentStatus; attemptCount: number; lastAttemptAt?: string; nextAttemptAt?: string; lastErrorCode?: string; serverEvidenceId?: string; serverAcceptanceId?: string; confirmedAt?: string; schemaVersion: 2 };
export type PickupDraft = {
  recipientName: string; recipientDocument: string; recipientPhone: string; vehiclePlate: string; notes: string;
  items: { pickupItemId: string; condition: "OK" | "DAMAGED" | "DIVERGENT" | "OTHER"; notes: string }[];
  savedAt: string;
};
export type PickupSnapshot = {
  tenantId: string; userId: string; pickupId: string; reservationId: string; reservationCode: string;
  serverUpdatedAt: string; pickupStatus: "IN_PROGRESS"; cachedAt: string; schemaVersion: 1;
  expectedVersion: number;
  recipientName: string; recipientDocument: string; recipientPhone: string; vehiclePlate: string; notes: string;
  items: { pickupItemId: string; resourceId: string; resourceCode: string; resourceName: string; condition: PickupDraft["items"][number]["condition"]; notes: string }[];
  termsVersion: string; termsHash: string; termsSnapshot: string;
  canInspect: boolean; canAddEvidence: boolean; canComplete: boolean; canSign: boolean;
  draft?: PickupDraft;
};
export type ReturnDraft = { items: { returnItemId: string; presence: "PRESENT" | "NOT_PRESENT"; condition?: "GOOD" | "DAMAGED" | "MISSING_COMPONENTS" | "DIRTY" | "UNUSABLE" | "OTHER"; disposition?: "MAINTENANCE" | "UNAVAILABLE"; notes: string }[]; savedAt: string };
export type ReturnSnapshot = {
  tenantId: string; userId: string; returnId: string; pickupId: string; reservationId: string; reservationCode: string;
  serverUpdatedAt: string; returnStatus: "IN_PROGRESS"; cachedAt: string; schemaVersion: 1; expectedVersion: number;
  items: { returnItemId: string; resourceId: string; resourceCode: string; resourceName: string; operationalStatus: "IN_USE"; presence: ReturnDraft["items"][number]["presence"]; condition?: ReturnDraft["items"][number]["condition"]; disposition?: ReturnDraft["items"][number]["disposition"]; notes: string }[];
  canInspect: boolean; canAddEvidence: boolean; canComplete: boolean; draft?: ReturnDraft;
};
type Metadata = { key: string; value: string };
const DB_NAME = "codex-unit-offline";
const DB_VERSION = 4;
const stores = { operations: "offlineOperations", attachments: "offlineAttachments", metadata: "offlineMetadata", pickups: "offlinePickupSnapshots", returns: "offlineReturnSnapshots" } as const;

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
    const attachments = db.objectStoreNames.contains(stores.attachments) ? request.transaction!.objectStore(stores.attachments) : db.createObjectStore(stores.attachments, { keyPath: "id" });
    if (!attachments.indexNames.contains("operationId")) attachments.createIndex("operationId", "operationId");
    if (!db.objectStoreNames.contains(stores.metadata)) db.createObjectStore(stores.metadata, { keyPath: "key" });
    if (!db.objectStoreNames.contains(stores.pickups)) {
      const pickups = db.createObjectStore(stores.pickups, { keyPath: ["tenantId", "userId", "pickupId"] });
      pickups.createIndex("owner", ["tenantId", "userId"]);
    }
    if (!db.objectStoreNames.contains(stores.returns)) {
      const returns = db.createObjectStore(stores.returns, { keyPath: ["tenantId", "userId", "returnId"] });
      returns.createIndex("owner", ["tenantId", "userId"]);
    }
  };
  return requestResult(request);
}
async function withStore<T>(name: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try { const tx = db.transaction(name, mode); const result = await action(tx.objectStore(name)); await transactionDone(tx); return result; }
  finally { db.close(); }
}
export const offlineStore = {
  async cachePickup(snapshot: PickupSnapshot) {
    if (snapshot.pickupStatus !== "IN_PROGRESS" || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.expectedVersion) || snapshot.expectedVersion < 1 || !snapshot.items.length) throw new Error("Snapshot de retirada inválido.");
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.pickups, stores.operations], "readwrite"), store = tx.objectStore(stores.pickups);
      const key = [snapshot.tenantId, snapshot.userId, snapshot.pickupId];
      const current = await requestResult(store.get(key) as IDBRequest<PickupSnapshot | undefined>);
      const operations = await requestResult(tx.objectStore(stores.operations).index("owner").getAll([snapshot.tenantId, snapshot.userId]) as IDBRequest<OfflineOperation[]>);
      const hasPickupWork = operations.some(row => row.aggregateType === "ReservationPickup" && row.aggregateId === snapshot.pickupId);
      // Keep the exact terms/version used by any local draft, evidence or signature.
      if (hasPickupWork && !current) throw new Error("Anexos locais sem snapshot original: revisão necessária.");
      if (!current?.draft && !hasPickupWork) store.put(snapshot);
      await transactionDone(tx);
      return current?.draft || hasPickupWork ? current! : snapshot;
    } finally { db.close(); }
  },
  async getPickupSnapshot(pickupId: string, tenantId: string, userId: string) {
    return withStore(stores.pickups, "readonly", async store => requestResult(store.get([tenantId, userId, pickupId]) as IDBRequest<PickupSnapshot | undefined>));
  },
  async savePickupDraft(pickupId: string, tenantId: string, userId: string, draft: PickupDraft) {
    return withStore(stores.pickups, "readwrite", async store => {
      const current = await requestResult(store.get([tenantId, userId, pickupId]) as IDBRequest<PickupSnapshot | undefined>);
      if (!current || current.pickupStatus !== "IN_PROGRESS" || !current.canInspect || draft.items.length !== current.items.length || new Set(draft.items.map(item => item.pickupItemId)).size !== current.items.length || draft.items.some(item => !current.items.some(saved => saved.pickupItemId === item.pickupItemId))) throw new Error("Retirada indisponível ou rascunho inválido neste dispositivo.");
      const next = { ...current, draft };
      store.put(next); return next;
    });
  },
  async queuePickupCompletion(pickupId: string, tenantId: string, userId: string) {
    const deviceId = await this.deviceId(), db = await openDatabase();
    try {
      const tx = db.transaction([stores.pickups, stores.operations, stores.attachments], "readwrite");
      const snapshot = await requestResult(tx.objectStore(stores.pickups).get([tenantId, userId, pickupId]) as IDBRequest<PickupSnapshot | undefined>);
      if (!snapshot || !snapshot.canComplete || !snapshot.draft || snapshot.draft.recipientName.trim().length < 2 || snapshot.draft.items.length !== snapshot.items.length || snapshot.draft.items.some(item => item.condition !== "OK")) throw new Error("Inspeção integral sem divergências deve estar salva antes da conclusão local.");
      const operationStore = tx.objectStore(stores.operations);
      const rows = await requestResult(operationStore.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      const related = rows.filter(row => row.aggregateType === "ReservationPickup" && row.aggregateId === pickupId);
      const existing = related.find(row => row.operationType === "PICKUP_COMPLETE");
      if (existing) { await transactionDone(tx); return existing; }
      const dependencies = related.filter(row => row.operationType === "PICKUP_ATTACHMENTS");
      if (!dependencies.length || dependencies.some(row => ["CONFLICT", "FAILED_PERMANENT"].includes(row.status) || row.deviceId !== deviceId)) throw new Error("Anexos ou assinatura rejeitados impedem a conclusão local.");
      if (dependencies.filter(row => Boolean(row.payload.inspection)).length !== 1) throw new Error("Uma inspeção local única deve preceder os anexos.");
      const attached = (await Promise.all(dependencies.map(row => requestResult(tx.objectStore(stores.attachments).index("operationId").getAll(row.id) as IDBRequest<OfflineAttachment[]>)))).flat();
      if (attached.some(row => row.tenantId !== tenantId || row.userId !== userId || ["CONFLICT", "FAILED_PERMANENT"].includes(row.status))) throw new Error("Anexo inválido ou de outra conta.");
      if (attached.filter(row => row.purpose === "PICKUP_SIGNATURE").length !== 1) throw new Error("Assinatura local obrigatória antes de concluir.");
      const now = new Date().toISOString(), id = crypto.randomUUID();
      const operation: OfflineOperation = { id, clientOperationId: id, tenantId, userId, deviceId, operationType: "PICKUP_COMPLETE", aggregateType: "ReservationPickup", aggregateId: pickupId, expectedVersion: snapshot.expectedVersion + 1, payload: { description: "Concluir retirada" }, dependsOnOperationIds: dependencies.map(row => row.id).sort(), status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
      operationStore.add(operation);
      await transactionDone(tx);
      return operation;
    } finally { db.close(); }
  },
  async cleanupPickupAfterFullAck(pickupId: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.pickups, stores.operations, stores.attachments], "readwrite");
      const operationStore = tx.objectStore(stores.operations), attachmentStore = tx.objectStore(stores.attachments);
      const rows = await requestResult(operationStore.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      const related = rows.filter(row => row.aggregateType === "ReservationPickup" && row.aggregateId === pickupId);
      if (!related.length) { await transactionDone(tx); return false; }
      const completion = related.find(row => row.operationType === "PICKUP_COMPLETE");
      if (!completion || completion.status !== "SYNCED" || !completion.fullAck || completion.serverResultId !== pickupId) throw new Error("FULL ACK ausente: dados locais preservados.");
      const dependencies = related.filter(row => row.operationType === "PICKUP_ATTACHMENTS");
      if (!dependencies.length || dependencies.some(row => row.status !== "SYNCED" || !completion.dependsOnOperationIds.includes(row.id))) throw new Error("Dependências sem confirmação: dados locais preservados.");
      for (const row of dependencies) {
        const attachments = await requestResult(attachmentStore.index("operationId").getAll(row.id) as IDBRequest<OfflineAttachment[]>);
        if (attachments.some(item => item.tenantId !== tenantId || item.userId !== userId || item.status !== "SERVER_CONFIRMED" || item.purpose === "PICKUP_SIGNATURE" && !item.serverAcceptanceId)) throw new Error("Anexos sem ACK: dados locais preservados.");
        for (const item of attachments) attachmentStore.delete(item.id);
      }
      for (const row of related) operationStore.delete(row.id);
      tx.objectStore(stores.pickups).delete([tenantId, userId, pickupId]);
      await transactionDone(tx);
      return true;
    } finally { db.close(); }
  },
  async cacheReturn(snapshot: ReturnSnapshot) {
    if (snapshot.returnStatus !== "IN_PROGRESS" || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.expectedVersion) || snapshot.expectedVersion < 1 || !snapshot.items.length) throw new Error("Snapshot de devolução inválido.");
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.returns, stores.operations], "readwrite"), store = tx.objectStore(stores.returns), key = [snapshot.tenantId, snapshot.userId, snapshot.returnId];
      const current = await requestResult(store.get(key) as IDBRequest<ReturnSnapshot | undefined>);
      const operations = await requestResult(tx.objectStore(stores.operations).index("owner").getAll([snapshot.tenantId, snapshot.userId]) as IDBRequest<OfflineOperation[]>);
      const hasWork = operations.some(row => row.aggregateType === "ReservationReturn" && row.aggregateId === snapshot.returnId);
      if (hasWork && !current) throw new Error("Operações locais sem snapshot original: revisão necessária.");
      if (!current?.draft && !hasWork) store.put(snapshot);
      await transactionDone(tx); return current?.draft || hasWork ? current! : snapshot;
    } finally { db.close(); }
  },
  getReturnSnapshot(returnId: string, tenantId: string, userId: string) { return withStore(stores.returns, "readonly", store => requestResult(store.get([tenantId, userId, returnId]) as IDBRequest<ReturnSnapshot | undefined>)); },
  async saveReturnDraft(returnId: string, tenantId: string, userId: string, draft: ReturnDraft) {
    return withStore(stores.returns, "readwrite", async store => {
      const current = await requestResult(store.get([tenantId, userId, returnId]) as IDBRequest<ReturnSnapshot | undefined>);
      if (!current || !current.canInspect || draft.items.length !== current.items.length || new Set(draft.items.map(item => item.returnItemId)).size !== current.items.length || draft.items.some(item => !current.items.some(saved => saved.returnItemId === item.returnItemId))) throw new Error("Devolução indisponível ou rascunho inválido.");
      const next = { ...current, draft }; store.put(next); return next;
    });
  },
  async queueReturnAttachments(snapshot: ReturnSnapshot, draft: ReturnDraft, attachments: OfflineAttachment[]) {
    const now = new Date().toISOString(), id = crypto.randomUUID();
    const operation: OfflineOperation = { id, clientOperationId: id, tenantId: snapshot.tenantId, userId: snapshot.userId, deviceId: await this.deviceId(), operationType: "RETURN_ATTACHMENTS", aggregateType: "ReservationReturn", aggregateId: snapshot.returnId, expectedVersion: snapshot.expectedVersion, payload: { description: "Inspeção e evidências de devolução", returnInspection: draft }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
    await this.saveOperation(operation, attachments.map(item => ({ ...item, operationId: id }))); return operation;
  },
  async queueReturnCompletion(returnId: string, tenantId: string, userId: string) {
    const deviceId = await this.deviceId(), db = await openDatabase();
    try {
      const tx = db.transaction([stores.returns, stores.operations, stores.attachments], "readwrite"), operationStore = tx.objectStore(stores.operations);
      const snapshot = await requestResult(tx.objectStore(stores.returns).get([tenantId, userId, returnId]) as IDBRequest<ReturnSnapshot | undefined>);
      if (!snapshot?.draft || !snapshot.canComplete || snapshot.draft.items.some(item => item.presence !== "PRESENT" || !item.condition || item.condition !== "GOOD" && item.notes.trim().length < 3)) throw new Error("Inspeção integral válida deve estar salva antes da conclusão local.");
      const rows = await requestResult(operationStore.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>), related = rows.filter(row => row.aggregateType === "ReservationReturn" && row.aggregateId === returnId);
      const existing = related.find(row => row.operationType === "RETURN_COMPLETE"); if (existing) { await transactionDone(tx); return existing; }
      const dependencies = related.filter(row => row.operationType === "RETURN_ATTACHMENTS");
      if (dependencies.length !== 1 || dependencies[0].deviceId !== deviceId || ["CONFLICT", "FAILED_PERMANENT"].includes(dependencies[0].status)) throw new Error("Inspeção e evidências devem ser preparadas antes da conclusão.");
      const attachments = await requestResult(tx.objectStore(stores.attachments).index("operationId").getAll(dependencies[0].id) as IDBRequest<OfflineAttachment[]>);
      const irregular = snapshot.draft.items.filter(item => item.condition && item.condition !== "GOOD");
      if (irregular.some(item => !attachments.some(file => file.purpose === "RETURN_EVIDENCE" && file.returnItemId === item.returnItemId))) throw new Error("Toda irregularidade exige evidência local.");
      const now = new Date().toISOString(), id = crypto.randomUUID();
      const operation: OfflineOperation = { id, clientOperationId: id, tenantId, userId, deviceId, operationType: "RETURN_COMPLETE", aggregateType: "ReservationReturn", aggregateId: returnId, expectedVersion: snapshot.expectedVersion + 1, payload: { description: "Concluir devolução" }, dependsOnOperationIds: [dependencies[0].id], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
      operationStore.add(operation); await transactionDone(tx); return operation;
    } finally { db.close(); }
  },
  async cleanupReturnAfterFullAck(returnId: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.returns, stores.operations, stores.attachments], "readwrite"), ops = tx.objectStore(stores.operations), files = tx.objectStore(stores.attachments);
      const rows = await requestResult(ops.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>), related = rows.filter(row => row.aggregateType === "ReservationReturn" && row.aggregateId === returnId);
      if (!related.length) { await transactionDone(tx); return false; }
      const completion = related.find(row => row.operationType === "RETURN_COMPLETE");
      if (!completion || completion.status !== "SYNCED" || !completion.fullAck || completion.serverResultId !== returnId) throw new Error("FULL ACK ausente: dados locais preservados.");
      const dependencies = related.filter(row => row.operationType === "RETURN_ATTACHMENTS");
      if (dependencies.length !== 1 || dependencies[0].status !== "SYNCED" || !completion.dependsOnOperationIds.includes(dependencies[0].id)) throw new Error("Dependências sem confirmação.");
      for (const row of dependencies) { const attached = await requestResult(files.index("operationId").getAll(row.id) as IDBRequest<OfflineAttachment[]>); if (attached.some(item => item.status !== "SERVER_CONFIRMED")) throw new Error("Evidências sem ACK."); for (const item of attached) files.delete(item.id); }
      for (const row of related) ops.delete(row.id); tx.objectStore(stores.returns).delete([tenantId, userId, returnId]); await transactionDone(tx); return true;
    } finally { db.close(); }
  },
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
    if (!operation.id || operation.id !== operation.clientOperationId || operation.schemaVersion !== 1 || attachments.some(a => a.operationId !== operation.id || a.tenantId !== operation.tenantId || a.userId !== operation.userId || a.aggregateId !== operation.aggregateId || a.aggregateType !== operation.aggregateType || a.size !== a.blob.size || a.schemaVersion !== 2)) throw new Error("Operação local inválida.");
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments, stores.metadata], "readwrite");
      try {
        tx.objectStore(stores.operations).add(operation);
        for (const attachment of attachments) tx.objectStore(stores.attachments).add(attachment);
      } catch (error) { tx.abort(); throw error; }
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async getPendingOperations(tenantId: string, userId: string) {
    return withStore(stores.operations, "readonly", async store => {
      const rows = await requestResult(store.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  },
  async getAttachments(operationId: string, tenantId: string, userId: string) {
    return withStore(stores.attachments, "readonly", async store => {
      const rows = await requestResult(store.index("operationId").getAll(operationId) as IDBRequest<OfflineAttachment[]>);
      return rows.filter(row => row.tenantId === tenantId && row.userId === userId).map(row => ({ ...row, status: row.status ?? "LOCAL", attemptCount: row.attemptCount ?? 0 } as OfflineAttachment));
    });
  },
  async updateAttachment(id: string, tenantId: string, userId: string, status: AttachmentStatus, patch: Partial<OfflineAttachment> = {}) {
    return withStore(stores.attachments, "readwrite", async store => {
      const current = await requestResult(store.get(id) as IDBRequest<OfflineAttachment | undefined>);
      if (!current || current.tenantId !== tenantId || current.userId !== userId) throw new Error("Evidência local não encontrada.");
      const from = current.status ?? "LOCAL";
      const allowed: Record<AttachmentStatus, AttachmentStatus[]> = { LOCAL: ["PENDING_UPLOAD"], PENDING_UPLOAD: ["UPLOADING"], UPLOADING: ["SERVER_CONFIRMED", "FAILED_RETRYABLE", "FAILED_PERMANENT", "AUTH_REQUIRED", "CONFLICT"], FAILED_RETRYABLE: ["UPLOADING"], AUTH_REQUIRED: ["UPLOADING"], FAILED_PERMANENT: [], CONFLICT: [], SERVER_CONFIRMED: [] };
      if (!allowed[from].includes(status)) throw new Error(`Transição de evidência inválida: ${from} → ${status}`);
      const next = { ...current, ...patch, status, updatedAt: new Date().toISOString() };
      store.put(next); return next;
    });
  },
  async recoverUploads(tenantId: string, userId: string, operationIds: string[]) {
    for (const id of operationIds) for (const row of await this.getAttachments(id, tenantId, userId)) {
      if (row.status === "UPLOADING") await this.updateAttachment(row.id, tenantId, userId, "FAILED_RETRYABLE", { lastErrorCode: "INTERRUPTED", nextAttemptAt: undefined });
    }
  },
  async recoverInterrupted(tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(stores.operations, "readwrite"), store = tx.objectStore(stores.operations);
      const rows = await requestResult(store.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      // Called only while holding the cross-tab sync lock: another tab cannot be mid-request.
      for (const row of rows.filter(row => row.status === "SYNCING")) store.put({ ...row, status: "FAILED_RETRYABLE", lastErrorCode: "INTERRUPTED", nextAttemptAt: undefined, updatedAt: new Date().toISOString() });
      await transactionDone(tx);
    } finally { db.close(); }
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
  markAuthRequired(id: string, tenantId: string, userId: string) { return this.update(id, tenantId, userId, { status: "AUTH_REQUIRED", lastErrorCode: "AUTH_REQUIRED", nextAttemptAt: undefined }); },
  async deleteSynced(id: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments], "readwrite");
      const operation = await requestResult(tx.objectStore(stores.operations).get(id) as IDBRequest<OfflineOperation | undefined>);
      if (!operation || operation.tenantId !== tenantId || operation.userId !== userId || operation.status !== "SYNCED") throw new Error("Não há confirmação de sincronização para limpeza.");
      const attachments = await requestResult(tx.objectStore(stores.attachments).index("operationId").getAll(id) as IDBRequest<OfflineAttachment[]>);
      if (attachments.some(a => a.tenantId !== tenantId || a.userId !== userId || a.status !== "SERVER_CONFIRMED")) throw new Error("Evidências ainda não confirmadas impedem limpeza.");
      for (const attachment of attachments) tx.objectStore(stores.attachments).delete(attachment.id);
      tx.objectStore(stores.operations).delete(id); await transactionDone(tx);
    } finally { db.close(); }
  },
  async resolveDependency(completedId: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(stores.operations, "readwrite"), store = tx.objectStore(stores.operations);
      const rows = await requestResult(store.index("owner").getAll([tenantId, userId]) as IDBRequest<OfflineOperation[]>);
      for (const row of rows) if (!["PICKUP_COMPLETE", "RETURN_COMPLETE"].includes(row.operationType) && row.dependsOnOperationIds.includes(completedId)) store.put({ ...row, dependsOnOperationIds: row.dependsOnOperationIds.filter(id => id !== completedId) });
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async discardRejected(id: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments, stores.metadata], "readwrite");
      const operation = await requestResult(tx.objectStore(stores.operations).get(id) as IDBRequest<OfflineOperation | undefined>);
      if (!operation || operation.tenantId !== tenantId || operation.userId !== userId || !["CONFLICT", "FAILED_PERMANENT"].includes(operation.status)) throw new Error("Somente operações rejeitadas podem ser descartadas.");
      const attachments = await requestResult(tx.objectStore(stores.attachments).index("operationId").getAll(id) as IDBRequest<OfflineAttachment[]>);
      for (const attachment of attachments.filter(a => a.operationId === id && a.tenantId === tenantId && a.userId === userId)) tx.objectStore(stores.attachments).delete(attachment.id);
      tx.objectStore(stores.operations).delete(id);
      tx.objectStore(stores.metadata).put({ key: `discard:${id}`, value: new Date().toISOString() });
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async saveAttachment(attachment: OfflineAttachment) {
    if (attachment.size !== attachment.blob.size || attachment.status !== "LOCAL" || attachment.schemaVersion !== 2) throw new Error("Evidência local inválida.");
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments], "readwrite");
      const operation = await requestResult(tx.objectStore(stores.operations).get(attachment.operationId) as IDBRequest<OfflineOperation | undefined>);
      if (!operation || operation.tenantId !== attachment.tenantId || operation.userId !== attachment.userId || operation.aggregateId !== attachment.aggregateId || operation.aggregateType !== attachment.aggregateType || ["SYNCED", "CONFLICT", "FAILED_PERMANENT"].includes(operation.status)) throw new Error("Operação local incompatível.");
      if (await requestResult(tx.objectStore(stores.attachments).get(attachment.id))) throw new Error("Identificador da evidência já existe.");
      tx.objectStore(stores.attachments).add(attachment); await transactionDone(tx);
    } finally { db.close(); }
  },
  async removeLocalAttachment(id: string, tenantId: string, userId: string) {
    const db = await openDatabase();
    try {
      const tx = db.transaction([stores.operations, stores.attachments], "readwrite");
      const attachments = tx.objectStore(stores.attachments);
      const attachment = await requestResult(attachments.get(id) as IDBRequest<OfflineAttachment | undefined>);
      if (!attachment || attachment.tenantId !== tenantId || attachment.userId !== userId || attachment.purpose === "PICKUP_SIGNATURE" || !["LOCAL", "PENDING_UPLOAD"].includes(attachment.status)) throw new Error("Somente uma evidência ainda local pode ser removida.");
      const operation = await requestResult(tx.objectStore(stores.operations).get(attachment.operationId) as IDBRequest<OfflineOperation | undefined>);
      if (!operation || operation.tenantId !== tenantId || operation.userId !== userId || operation.domainConfirmed || operation.status === "SYNCING") throw new Error("Evidência já submetida à sincronização.");
      attachments.delete(id);
      await transactionDone(tx);
    } finally { db.close(); }
  },
  async getStorageUsage() { return navigator.storage?.estimate?.() ?? { usage: undefined, quota: undefined }; },
  async storageEstimate() { const { usage, quota } = await this.getStorageUsage(); return { usage, quota, ratio: usage !== undefined && quota ? usage / quota : undefined }; },
  async requestPersistence() { if (!navigator.storage?.persisted || !navigator.storage?.persist) return undefined; return await navigator.storage.persisted() || await navigator.storage.persist(); },
};
