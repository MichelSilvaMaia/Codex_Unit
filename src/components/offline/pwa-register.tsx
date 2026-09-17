"use client";
import { useEffect, useState } from "react";

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(registration => {
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker); });
      });
    }).catch(() => {});
  }, []);
  if (!waiting) return null;
  return <aside className="fixed bottom-4 right-4 z-50 rounded-xl border bg-white p-4 shadow-xl" role="status">Nova versão disponível. <button className="font-semibold text-primary underline" onClick={() => { navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true }); waiting.postMessage({ type: "SKIP_WAITING" }); }}>Atualizar quando estiver pronto</button></aside>;
}
