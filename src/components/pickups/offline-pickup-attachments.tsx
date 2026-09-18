"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { offlineStore, type OfflineAttachment, type OfflineOperation, type PickupSnapshot } from "@/lib/offline/offline-store";
import { SignaturePad } from "./signature-pad";

const evidenceTypes = ["DAMAGE", "DIVERGENCE", "RESOURCE_IDENTIFICATION", "OUTPUT_CONDITION"] as const;
const maxEvidence = 8 * 1024 * 1024;

async function digest(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
}

function EvidencePreview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const value = URL.createObjectURL(blob); const timer = window.setTimeout(() => setUrl(value), 0); return () => { window.clearTimeout(timer); URL.revokeObjectURL(value); }; }, [blob]);
  return url ? <Image src={url} alt="Prévia da evidência guardada neste dispositivo" width={300} height={144} unoptimized className="mt-2 max-h-36 rounded border object-contain"/> : null;
}

export function OfflinePickupAttachments({ snapshot, termsChanged }: { snapshot: PickupSnapshot; termsChanged: boolean }) {
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [attachments, setAttachments] = useState<OfflineAttachment[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const all = (await offlineStore.getPendingOperations(snapshot.tenantId, snapshot.userId)).filter(row => row.aggregateType === "ReservationPickup" && row.aggregateId === snapshot.pickupId);
    setOperations(all);
    setAttachments((await Promise.all(all.map(row => offlineStore.getAttachments(row.id, snapshot.tenantId, snapshot.userId)))).flat());
  }, [snapshot.tenantId, snapshot.userId, snapshot.pickupId]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload().catch(() => setMessage("Não foi possível consultar os anexos locais.")); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  async function prepare(blob: Blob, purpose: OfflineAttachment["purpose"], type: OfflineAttachment["type"], extra: Partial<OfflineAttachment> = {}) {
    const { usage, quota } = await offlineStore.storageEstimate();
    if (quota && usage !== undefined && (quota - usage < blob.size * 1.5 || usage / quota > .95)) throw new Error("Armazenamento do dispositivo próximo do limite.");
    const live = operations.filter(row => !["SYNCED", "CONFLICT", "FAILED_PERMANENT"].includes(row.status));
    let operation = live.at(-1);
    if (operation?.status === "SYNCING") throw new Error("Sincronização em andamento. Tente novamente depois.");
    if (operation && operation.expectedVersion !== snapshot.expectedVersion) throw new Error("A versão do rascunho não corresponde à operação pendente.");
    const now = new Date().toISOString();
    if (!operation) {
      const id = crypto.randomUUID();
      operation = { id, clientOperationId: id, tenantId: snapshot.tenantId, userId: snapshot.userId, deviceId: await offlineStore.deviceId(), operationType: "PICKUP_ATTACHMENTS", aggregateType: "ReservationPickup", aggregateId: snapshot.pickupId, expectedVersion: snapshot.expectedVersion, payload: { description: "Anexos de retirada" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
    }
    const attachment: OfflineAttachment = { id: crypto.randomUUID(), operationId: operation.id, tenantId: snapshot.tenantId, userId: snapshot.userId, aggregateType: "ReservationPickup", aggregateId: snapshot.pickupId, purpose, type, blob, mimeType: blob.type, size: blob.size, checksum: await digest(blob), expectedVersion: snapshot.expectedVersion, createdAt: now, updatedAt: now, status: "LOCAL", attemptCount: 0, schemaVersion: 2, ...extra };
    if (live.length) await offlineStore.saveAttachment(attachment);
    else await offlineStore.saveOperation(operation, [attachment]);
    await reload();
    return attachment;
  }

  async function saveEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, data = new FormData(form), file = data.get("evidence"), type = String(data.get("type")), item = String(data.get("pickupItemId") ?? "");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > maxEvidence || !evidenceTypes.includes(type as typeof evidenceTypes[number]) || (item && !snapshot.items.some(row => row.pickupItemId === item))) { setMessage("Selecione uma imagem JPEG, PNG ou WebP de até 8 MB e um item válido."); return; }
    setBusy(true);
    try { await prepare(file, "PICKUP_EVIDENCE", type as OfflineAttachment["type"], item ? { pickupItemId: item } : {}); form.reset(); setMessage("Evidência salva neste dispositivo. Ainda não confirmada no servidor."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar evidência no dispositivo."); }
    finally { setBusy(false); }
  }

  async function saveSignature(blob: Blob, width: number, height: number) {
    if (busy) return;
    if (termsChanged || !snapshot.canSign) { setMessage("Os termos mudaram neste rascunho; atualize a página online antes de assinar."); return; }
    if (attachments.some(row => row.purpose === "PICKUP_SIGNATURE")) { setMessage("Já existe assinatura local para esta tentativa. Revise a sincronização antes de outra captura."); return; }
    setBusy(true);
    try {
      if (blob.type !== "image/png" || blob.size < 65 || blob.size > 2_000_000) throw new Error("PNG da assinatura inválido.");
      await prepare(blob, "PICKUP_SIGNATURE", "SIGNATURE", { termsVersion: snapshot.termsVersion, termsHash: snapshot.termsHash, capturedAtDevice: new Date().toISOString(), width, height });
      setMessage("Assinatura salva neste dispositivo. Aceite ainda não confirmado no servidor; retirada NÃO concluída.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao persistir assinatura no dispositivo."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await offlineStore.removeLocalAttachment(id, snapshot.tenantId, snapshot.userId); await reload(); setMessage("Evidência local removida antes do envio."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível remover esta evidência."); }
  }

  const signature = attachments.find(row => row.purpose === "PICKUP_SIGNATURE");
  return <section className="mt-5 grid gap-4 border-t border-amber-300 pt-4">
    <div><h3 className="font-semibold">Evidências e assinatura offline</h3><p className="text-sm">Fotos e assinatura ficam vinculadas a esta conta, empresa e tentativa. Nenhuma captura local libera recursos ou transfere custódia.</p></div>
    {snapshot.canAddEvidence && <form onSubmit={saveEvidence} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2">
      <select name="type" className="rounded border p-2" aria-label="Tipo de evidência">{evidenceTypes.map(type => <option key={type}>{type}</option>)}</select>
      <select name="pickupItemId" className="rounded border p-2" aria-label="Recurso da evidência"><option value="">Retirada inteira</option>{snapshot.items.map(item => <option key={item.pickupItemId} value={item.pickupItemId}>{item.resourceCode} · {item.resourceName}</option>)}</select>
      <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="max-w-full text-sm sm:col-span-2"/>
      <button disabled={busy} className="rounded bg-amber-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar foto neste dispositivo</button>
    </form>}
    {attachments.filter(row => row.purpose === "PICKUP_EVIDENCE").map(row => <div key={row.id} className="rounded-lg border bg-white p-3 text-sm"><strong>{row.type}</strong> · {row.status === "SERVER_CONFIRMED" ? "Confirmada no servidor" : "Salva neste dispositivo"}{row.lastErrorCode && <p className="text-red-700">{row.lastErrorCode}</p>}<EvidencePreview blob={row.blob}/>{["LOCAL", "PENDING_UPLOAD"].includes(row.status) && <button type="button" onClick={() => void remove(row.id)} className="mt-2 block text-red-700 underline">Remover antes do envio</button>}</div>)}
    <details className="rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Revisar termo antes de assinar · {snapshot.termsVersion}</summary><pre className="mt-2 whitespace-pre-wrap font-sans">{snapshot.termsSnapshot}</pre><p className="mt-2 break-all text-xs">SHA-256: {snapshot.termsHash}</p></details>
    {snapshot.canSign && !signature && !termsChanged && <SignaturePad pickupId={snapshot.pickupId} onOfflineSave={saveSignature}/>}
    {termsChanged && <p className="text-sm font-semibold text-red-800">Termos incompatíveis com o rascunho alterado; assinatura offline bloqueada.</p>}
    {signature && <p className="text-sm">Assinatura: {signature.serverAcceptanceId ? "aceite confirmado no servidor" : signature.status === "SERVER_CONFIRMED" ? "confirmada no servidor" : "salva neste dispositivo, aceite pendente"}. O Blob será mantido até o futuro FULL ACK.</p>}
    {operations.some(row => row.status === "AUTH_REQUIRED") && <p className="text-sm">Entre novamente para retomar; seus arquivos permanecem neste dispositivo.</p>}
    <p className="text-sm">OTP só funciona online. Esta etapa não enfileira códigos.</p>
    {message && <p role="status" className="text-sm font-medium">{message}</p>}
  </section>;
}
