"use client";

import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  label?: string;
  /** Fires with a cropped data:image/png;base64,... URL after each stroke, or null when cleared. */
  onChange?: (dataUrl: string | null) => void;
  className?: string;
  /** Height of the signing area in CSS px. */
  height?: number;
}

/**
 * Hand-rolled signature pad (no library). Draws on a transparent canvas so the
 * exported PNG contains only the ink; the baseline is a CSS overlay that is not
 * baked into the export. Exports are cropped to the ink's bounding box.
 */
export default function SignaturePad({
  label = "Signature",
  onChange,
  className,
  height = 160,
}: SignaturePadProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [hasCursorInk, setHasCursorInk] = useState(false);

  const sizedRef = useRef(false);

  const getContext = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  /** Resolve the signature ink color from the page's text color so it matches
   *  the current theme (and print mode, where text is forced black). */
  function resolveInkColor(): string {
    if (typeof document === "undefined") return "#111827";
    const root = document.documentElement;
    let color = getComputedStyle(root).getPropertyValue("--color-foreground").trim();
    if (!color) color = getComputedStyle(document.body).color;
    if (!color || color === "transparent") color = "#111827";
    return color;
  }

  // Size the backing store once the wrapper has a real width.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    if (sizedRef.current) return;

    const rect = wrapper.getBoundingClientRect();
    const w = Math.round(rect.width || 640);
    const h = Math.round(height);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    sizedRef.current = true;
  }, [height]);

  function localPos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleStart(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drawingRef.current = true;
    const { x, y } = localPos(e);
    const inkColor = resolveInkColor();
    ctx.strokeStyle = inkColor;
    ctx.fillStyle = inkColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handleMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = localPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handleEnd(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setHasCursorInk(true);
    onChange?.(exportCropped());
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setHasInk(false);
    setHasCursorInk(false);
    onChange?.(null);
  }

  /** Crop the transparent canvas down to its ink bounding box (with padding). */
  function exportCropped(): string | null {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return null;

    const { width, height: ch } = canvas;
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, width, ch);
    } catch {
      return canvas.toDataURL("image/png");
    }
    const { data } = imageData;

    let minX = width,
      minY = ch,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < ch; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (data[row + x * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || maxY < 0) return null;

    const pad = Math.round(Math.min(width, ch) * 0.06);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(ch - 1, maxY + pad);
    const sw = maxX - minX + 1;
    const sh = maxY - minY + 1;

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const octx = out.getContext("2d");
    if (!octx) return canvas.toDataURL("image/png");
    octx.drawImage(canvas, minX, minY, sw, sh, 0, 0, sw, sh);

    const url = out.toDataURL("image/png");
    setHasInk(true);
    return url;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-foreground-dim">{label}</span>
      <div
        ref={wrapperRef}
        className="relative w-full overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/50"
        style={{ height }}
      >
        {/* Visual baseline — CSS only, never baked into the exported image. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[6%] right-[6%] border-b border-dashed border-border"
          style={{ top: `${Math.round(height * 0.75)}px` }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted"
        >
          {hasCursorInk ? "" : "Sign here"}
        </span>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={handleStart}
          onPointerMove={handleMove}
          onPointerUp={handleEnd}
          onPointerLeave={handleEnd}
          onPointerCancel={handleEnd}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{hasInk ? "Signature captured" : "Draw your signature"}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} aria-label="Clear signature">
          <Eraser size={14} /> Clear
        </Button>
      </div>
    </div>
  );
}
