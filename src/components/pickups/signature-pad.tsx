"use client";

import { useRef, useState } from "react";
import { capturePickupSignatureAction } from "@/app/acceptance-actions";
import { Button } from "@/components/ui/button";

export function SignaturePad({ pickupId }: { pickupId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d")!;
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
    setDrawing(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const context = canvasRef.current!.getContext("2d")!;
    const current = point(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
    context.lineTo(current.x, current.y);
    context.stroke();
    setHasInk(true);
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function submit(form: FormData) {
    if (!hasInk) return;
    const canvas = canvasRef.current!;
    form.set("signature", canvas.toDataURL("image/png"));
    form.set("width", String(canvas.width));
    form.set("height", String(canvas.height));
    await capturePickupSignatureAction(pickupId, form);
  }

  return (
    <form action={submit} className="grid gap-3 rounded-xl border bg-background p-4">
      <p className="font-semibold">Assinatura desenhada</p>
      <p className="text-sm text-muted-foreground">O aceite fica vinculado somente a esta tentativa de retirada.</p>
      <canvas
        ref={canvasRef}
        width={700}
        height={220}
        className="h-44 w-full touch-none rounded-md border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => setDrawing(false)}
        onPointerCancel={() => setDrawing(false)}
        aria-label="Área para assinatura"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={clear}>Limpar</Button>
        <Button type="submit" disabled={!hasInk}>Registrar aceite</Button>
      </div>
    </form>
  );
}
