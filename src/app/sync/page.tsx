import { AppHeader } from "@/components/app-header";
import { SyncCenter } from "@/components/offline/sync-center";
import { requireActiveTenantForPage } from "@/server/tenancy/page-context";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sincronização" };
export default async function SyncPage() {
  const context = await requireActiveTenantForPage();
  return <main className="app-canvas min-h-screen"><AppHeader tenantName={context.tenantName} permissions={context.permissions}/><section className="page-shell"><header className="hero-panel"><div><p className="eyebrow">Operações no dispositivo</p><h1>Sincronização</h1><p>Confira pendências e conflitos antes de considerar uma operação concluída.</p></div></header><SyncCenter tenantId={context.tenantId} userId={context.user.id}/></section></main>;
}
