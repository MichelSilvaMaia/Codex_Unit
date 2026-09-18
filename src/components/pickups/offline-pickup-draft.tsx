"use client";

import { useEffect, useState, type FormEvent } from "react";
import { offlineStore, type PickupDraft, type PickupSnapshot } from "@/lib/offline/offline-store";
import { PICKUP_TERMS_VERSION, pickupTermsSnapshot } from "@/lib/pickup-terms-content";
import { OfflinePickupAttachments } from "./offline-pickup-attachments";

function initial(snapshot: PickupSnapshot): PickupDraft {
  return { recipientName: snapshot.recipientName, recipientDocument: snapshot.recipientDocument, recipientPhone: snapshot.recipientPhone, vehiclePlate: snapshot.vehiclePlate, notes: snapshot.notes, items: snapshot.items.map(item => ({ pickupItemId: item.pickupItemId, condition: item.condition, notes: item.notes })), savedAt: "" };
}

export function OfflinePickupDraft({ snapshot }: { snapshot: PickupSnapshot }) {
  const [record, setRecord] = useState(snapshot);
  const [draft, setDraft] = useState<PickupDraft>(() => initial(snapshot));
  const [message, setMessage] = useState("Preparando dados para uso neste dispositivo…");
  const [ready, setReady] = useState(false);
  const [terms, setTerms] = useState({ version: snapshot.termsVersion, hash: snapshot.termsHash, snapshot: snapshot.termsSnapshot });
  const [termsReady, setTermsReady] = useState(false);
  useEffect(() => {
    let active = true;
    void offlineStore.cachePickup(snapshot).then(saved => {
      if (!active) return;
      setRecord(saved);
      setReady(true);
      setDraft(saved.draft ?? initial(saved));
      setMessage(saved.draft ? "Rascunho local recuperado. Ainda não foi enviado ao servidor." : "Dados desta retirada disponíveis neste dispositivo. Nenhuma alteração local foi confirmada no servidor.");
    }).catch(() => { if (active) setMessage("Não foi possível preparar esta retirada para uso offline. Não conte com estes dados após sair da página."); });
    return () => { active = false; };
  }, [snapshot]);
  useEffect(() => {
    if (!record.draft) return;
    let active = true;
    const saved = record.draft;
    const content = pickupTermsSnapshot({ reservationCode: record.reservationCode, recipientName: saved.recipientName, resources: record.items.map(item => `${item.resourceCode} ${item.resourceName}`), conditions: record.items.map(item => saved.items.find(row => row.pickupItemId === item.pickupItemId)!.condition) });
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)).then(bytes => {
      if (active) { setTerms({ version: PICKUP_TERMS_VERSION, snapshot: content, hash: Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("") }); setTermsReady(true); }
    }).catch(() => { if (active) setTermsReady(false); });
    return () => { active = false; };
  }, [record]);
  const updateItem = (pickupItemId: string, patch: Partial<PickupDraft["items"][number]>) => setDraft(current => ({ ...current, items: current.items.map(item => item.pickupItemId === pickupItemId ? { ...item, ...patch } : item) }));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record.canInspect) { setMessage("Sem permissão para registrar inspeção local."); return; }
    const recipientName = draft.recipientName.trim();
    if (recipientName.length < 2 || recipientName.length > 160 || draft.items.some(item => item.condition !== "OK" && item.notes.trim().length < 3)) { setMessage("Informe o destinatário e descreva cada divergência antes de guardar."); return; }
    try {
      const existing = (await offlineStore.getPendingOperations(record.tenantId, record.userId)).some(row => row.aggregateType === "ReservationPickup" && row.aggregateId === record.pickupId);
      if (existing && unsavedChanges) { setMessage("Já há anexos ou uma conclusão local vinculados à inspeção salva. Revise/descarte a operação antes de alterar o rascunho."); return; }
      const saved = await offlineStore.savePickupDraft(record.pickupId, record.tenantId, record.userId, { ...draft, recipientName, savedAt: new Date().toISOString() });
      setRecord(saved); setDraft(saved.draft!);
      setMessage("Rascunho de destinatário e inspeção salvo somente neste dispositivo. Evidências e aceite têm sincronização própria; a retirada NÃO está concluída.");
    } catch { setMessage("Não foi possível salvar no dispositivo. Suas alterações podem ser perdidas ao fechar a página."); }
  }
  const saved = record.draft;
  const unsavedChanges = !saved || draft.recipientName !== saved.recipientName || draft.recipientDocument !== saved.recipientDocument || draft.recipientPhone !== saved.recipientPhone || draft.vehiclePlate !== saved.vehiclePlate || draft.notes !== saved.notes || draft.items.some(item => { const prior = saved.items.find(row => row.pickupItemId === item.pickupItemId); return !prior || prior.condition !== item.condition || prior.notes !== item.notes; });
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
    <h2 className="text-lg font-semibold">Rascunho operacional neste dispositivo</h2>
    <p className="mt-1 text-sm">Dados atualizados pela última vez em {new Date(record.cachedAt).toLocaleString("pt-BR")}. Captura local não confirma aceite, saída ou custódia.</p>
    <form onSubmit={save} className="mt-4 grid gap-3">
      <label className="grid gap-1 text-sm">Destinatário<input className="rounded-lg border bg-white p-2" value={draft.recipientName} maxLength={160} onChange={e => setDraft({ ...draft, recipientName: e.target.value })} required/></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Documento<input className="rounded-lg border bg-white p-2" value={draft.recipientDocument} maxLength={40} onChange={e => setDraft({ ...draft, recipientDocument: e.target.value })}/></label>
        <label className="grid gap-1 text-sm">Telefone<input className="rounded-lg border bg-white p-2" value={draft.recipientPhone} maxLength={40} onChange={e => setDraft({ ...draft, recipientPhone: e.target.value })}/></label>
        <label className="grid gap-1 text-sm">Placa<input className="rounded-lg border bg-white p-2" value={draft.vehiclePlate} maxLength={12} onChange={e => setDraft({ ...draft, vehiclePlate: e.target.value })}/></label>
      </div>
      <label className="grid gap-1 text-sm">Observações<textarea className="rounded-lg border bg-white p-2" value={draft.notes} maxLength={1000} onChange={e => setDraft({ ...draft, notes: e.target.value })}/></label>
      {record.items.map(item => { const value = draft.items.find(row => row.pickupItemId === item.pickupItemId)!; return <div key={item.pickupItemId} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2"><strong className="sm:col-span-2">{item.resourceCode} · {item.resourceName}</strong><select className="rounded-lg border p-2" value={value.condition} onChange={e => updateItem(item.pickupItemId, { condition: e.target.value as typeof value.condition })}><option>OK</option><option>DAMAGED</option><option>DIVERGENT</option><option>OTHER</option></select><input className="rounded-lg border p-2" value={value.notes} maxLength={500} onChange={e => updateItem(item.pickupItemId, { notes: e.target.value })} placeholder="Descreva divergências"/></div>; })}
      <button className="w-fit rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white" disabled={!record.canInspect}>Guardar rascunho local</button>
    </form>
    <details className="mt-4 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">Termos do último rascunho salvo — {terms.version}</summary><pre className="mt-2 whitespace-pre-wrap font-sans">{terms.snapshot}</pre><p className="mt-2 break-all text-xs">SHA-256: {terms.hash}</p></details>
    {unsavedChanges&&<p className="mt-3 text-sm font-semibold">Salve o rascunho antes de anexar evidências, assinar ou concluir localmente.</p>}
    {ready && <OfflinePickupAttachments snapshot={record} terms={terms} termsReady={termsReady} unsavedChanges={unsavedChanges}/>}
    <p role="status" className="mt-3 text-sm font-medium">{message}</p>
  </section>;
}
