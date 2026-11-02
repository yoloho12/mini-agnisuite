"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, AlertTriangle, Download, Settings, Copy, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card, { CardTitle, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { fetchProduct } from "@/app/actions/productActions";
import { isValidEan13 } from "@/lib/barcode";
import bwipjs from "bwip-js";
import type { Product } from "@/types";
import { toast } from "sonner";

const LABEL_SIZES = [
  { value: "small", label: "Small (50x25mm)", width: 200, height: 100 },
  { value: "medium", label: "Medium (100x50mm)", width: 400, height: 200 },
  { value: "large", label: "Large (150x75mm)", width: 600, height: 300 },
] as const;

const BARCODE_FORMATS = [
  { value: "code128", label: "Code128" },
  { value: "ean13", label: "EAN-13" },
  { value: "qr", label: "QR Code" },
  { value: "upc", label: "UPC-A" },
] as const;

interface LabelSettings {
  format: string;
  labelSize: string;
  scale: number;
  height: number;
  includeText: boolean;
  showSku: boolean;
  showName: boolean;
  copies: number;
}

const defaultSettings: LabelSettings = {
  format: "code128",
  labelSize: "medium",
  scale: 3,
  height: 12,
  includeText: true,
  showSku: true,
  showName: true,
  copies: 1,
};

export default function BarcodePage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [settings, setSettings] = useState<LabelSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = await fetchProduct(params.id as string);
      setProduct(p);
      if (p) {
        const preferred =
          p.barcode_format === "QR"
            ? "qr"
            : p.barcode_format === "EAN13" && p.barcode_value && isValidEan13(p.barcode_value)
              ? "ean13"
              : "code128";
        setSettings((prev) => ({ ...prev, format: preferred }));
      }
    } catch {
      setError("Failed to load product. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const renderAllBarcodes = useCallback(() => {
    if (!product || canvasRefs.current.length === 0) return;
    
    const barcodeValue = product.barcode_value || product.sku;
    const requested = settings.format;
    const format = requested === "ean13" && !isValidEan13(barcodeValue) ? "code128" : requested;
    let renderError = "";
    
    canvasRefs.current.forEach((canvas, index) => {
      if (!canvas) return;
      try {
        if (format === "qr") {
          bwipjs.toCanvas(canvas, {
            bcid: "qrcode",
            text: barcodeValue,
            scale: Math.max(settings.scale, 4),
            padding: 4,
          });
        } else {
          bwipjs.toCanvas(canvas, {
            bcid: format,
            text: barcodeValue,
            scale: settings.scale,
            height: settings.height,
            includetext: settings.includeText,
            textxalign: "center",
          });
        }
      } catch {
        renderError = `Could not render label ${index + 1} for this value.`;
      }
    });

    setBarcodeError(
      renderError ||
        (requested === "ean13" && format !== "ean13"
          ? "This value is not a valid EAN-13; Code128 is shown instead."
          : "")
    );
  }, [product, settings]);

  useEffect(() => {
    if (!product) return;
    renderAllBarcodes();
  }, [product, settings, renderAllBarcodes]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (!product || canvasRefs.current.length === 0) return;
    
    const suffix =
      settings.format === "qr" ? "qr" : settings.format === "ean13" ? "ean13" : "barcode";
    canvasRefs.current.forEach((canvas, index) => {
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `${product.sku}-${suffix}-${index + 1}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
    toast.success(
      `Downloaded ${settings.copies} ${settings.format === "qr" ? "QR code(s)" : "label(s)"}`
    );
  }, [product, settings.copies, settings.format]);

  const copyBarcodeValue = useCallback(() => {
    if (!product) return;
    const value = product.barcode_value || product.sku;
    navigator.clipboard.writeText(value);
    toast.success("Barcode value copied to clipboard");
  }, [product]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle size={32} className="text-danger mb-3" />
        <p className="text-sm text-muted mb-4 max-w-sm">{error}</p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  if (!product) {
    return <div className="text-center py-12 text-muted">Product not found</div>;
  }

  const labelSize = LABEL_SIZES.find(s => s.value === settings.labelSize) || LABEL_SIZES[1];
  const isQr = settings.format === "qr";
  // QR symbols must stay square; barcodes use the full label width.
  const canvasWidth = isQr ? labelSize.height : labelSize.width;
  const canvasHeight = labelSize.height;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`${product.name} — Barcode / QR Labels`}
          description="Generate and print barcode or QR labels for this product"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push(`/products/${product.id}`)}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button variant="secondary" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={16} /> Settings
            </Button>
            <Button variant="secondary" onClick={copyBarcodeValue}>
              <Copy size={16} className="mr-1" /> Copy Value
            </Button>
            <Button onClick={handleDownloadAll} disabled={!product}>
              <Download size={16} className="mr-1" /> Download All
            </Button>
            <Button onClick={handlePrint}>
              <Printer size={16} className="mr-1" /> Print
            </Button>
          </div>
        }
      />
      </div>

      {showSettings && (
        <Card className="mb-6 no-print">
          <CardTitle className="flex items-center justify-between">
            Label Settings
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </Button>
          </CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Select
                label="Format"
                value={settings.format}
                onChange={(e) => setSettings({ ...settings, format: e.target.value })}
                options={BARCODE_FORMATS}
              />
              <Select
                label="Label Size"
                value={settings.labelSize}
                onChange={(e) => setSettings({ ...settings, labelSize: e.target.value })}
                options={LABEL_SIZES}
              />
              <Input
                label="Scale"
                type="number"
                min="1"
                max="5"
                value={settings.scale}
                onChange={(e) => setSettings({ ...settings, scale: parseInt(e.target.value) })}
              />
              <Input
                label="Height"
                type="number"
                min="5"
                max="20"
                value={settings.height}
                onChange={(e) => setSettings({ ...settings, height: parseInt(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Copies"
                type="number"
                min="1"
                max="50"
                value={settings.copies}
                onChange={(e) => setSettings({ ...settings, copies: parseInt(e.target.value) })}
              />
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeText}
                    onChange={(e) => setSettings({ ...settings, includeText: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Include Text</span>
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showSku}
                    onChange={(e) => setSettings({ ...settings, showSku: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Show SKU</span>
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showName}
                    onChange={(e) => setSettings({ ...settings, showName: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Show Name</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="print-area">
        <div className="grid gap-4" style={{ 
          gridTemplateColumns: `repeat(${Math.min(settings.copies, 4)}, 1fr)`,
          maxWidth: `${(isQr ? canvasWidth + 32 : labelSize.width) * Math.min(settings.copies, 4)}px`,
          margin: "0 auto"
        }}>
          {Array.from({ length: settings.copies }, (_, i) => (
            <div key={i} className="rounded-xl border border-dashed border-border bg-card p-4 flex flex-col items-center gap-2 print:border-0 print:bg-transparent print:p-0 print:text-black">
              <div className="w-full" style={{ 
                width: `${canvasWidth}px`, 
                height: `${canvasHeight}px` 
              }}>
                <canvas 
                  ref={(el) => { canvasRefs.current[i] = el; }} 
                  className="w-full h-full"
                  style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
                />
              </div>
              <div className="flex flex-col items-center gap-1 text-xs text-muted print:text-black">
                {settings.showName && <span className="font-medium text-foreground text-sm print:text-black">{product.name}</span>}
                {settings.showSku && <span>SKU: {product.sku}</span>}
                {!settings.showName && !settings.showSku && <span>{product.sku}</span>}
              </div>
            </div>
          ))}
        </div>
        
        {barcodeError && (
          <div className="text-center mt-4 text-sm text-danger no-print">{barcodeError}</div>
        )}
      </div>
    </div>
  );
}