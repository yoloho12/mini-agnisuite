"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Package, Search, Edit2, Trash2, Download, Upload, FileSpreadsheet, Wand2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NumericInput from "@/components/ui/NumericInput";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import PriceInput from "@/components/ui/PriceInput";
import { fetchProducts, addProduct, addProductsBulk, editProduct, removeProduct } from "@/app/actions/productActions";
import type { Product, ProductStatus, BarcodeFormat } from "@/types";
import { PRODUCT_UNITS, PRODUCT_CATEGORIES } from "@/constants";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatMmk } from "@/lib/money";
import { exportExcel, exportWorkbook, readSpreadsheet, type SheetData } from "@/lib/excel";
import {
  detectBarcodeFormat,
  generateBarcodeValue,
  isValidEan13,
  parseBarcodeFormat,
} from "@/lib/barcode";
import { usePagination } from "@/hooks/usePagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  isAllVisibleSelected,
  normalizeSelectedIds,
  setVisibleSelection,
  toggleSelectedId,
} from "@/lib/productSelection";
import { canManageProduct } from "@/lib/permissions";

const ITEMS_PER_PAGE = 10;

interface ProductFormData {
  name: string;
  sku: string;
  brand: string;
  model: string;
  category: string;
  color: string;
  size: string;
  unit: string;
  barcode_value: string;
  barcode_format: BarcodeFormat | null;
  reorder_point: number;
  base_cost_mmk: number;
  last_purchase_cost_mmk: number;
  upc_eans: string[];
  status: ProductStatus;
}

const defaultForm: ProductFormData = {
  name: "",
  sku: "",
  brand: "",
  model: "",
  category: "",
  color: "",
  size: "",
  unit: "pcs",
  barcode_value: "",
  barcode_format: null,
  reorder_point: 0,
  base_cost_mmk: 0,
  last_purchase_cost_mmk: 0,
  upc_eans: [],
  status: "ACTIVE",
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { user, loading: userLoading } = useCurrentUser();
  const canManage = canManageProduct(user?.role);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
      setSelectedIds((prev) => normalizeSelectedIds(prev, data.map((product) => product.id)));
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    for (const c of PRODUCT_CATEGORIES) set.add(c);
    return [...set].sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(
      (p) =>
        (!categoryFilter || p.category === categoryFilter) &&
        (p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (p.brand && p.brand.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
          (p.model && p.model.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
          (p.category && p.category.toLowerCase().includes(debouncedSearch.toLowerCase())))
    );
  }, [products, debouncedSearch, categoryFilter]);

  const { page, setPage, totalPages, pageItems: paginated } = usePagination(filtered, ITEMS_PER_PAGE);
  const pageIds = useMemo(() => paginated.map((p) => p.id), [paginated]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => setVisibleSelection(prev, pageIds, checked));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => toggleSelectedId(prev, id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} product(s)? This cannot be undone.`)) return;

    let deleted = 0;
    const deletedIds = new Set<string>();
    const failures: string[] = [];
    for (const id of selectedIds) {
      try {
        await removeProduct(id);
        deleted++;
        deletedIds.add(id);
      } catch (err) {
        failures.push(friendlyErrorMessage(err, "Failed to delete a product"));
      }
    }
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} product(s)`);
      setSelectedIds((prev) => new Set([...prev].filter((id) => !deletedIds.has(id))));
      loadProducts();
    }
    if (failures.length > 0) {
      toast.error(
        deleted === 0
          ? "Could not delete the selected products"
          : `Deleted ${deleted}, but ${failures.length} could not be deleted`,
        { description: failures[0] }
      );
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    const selected = products.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;
    exportExcel(
      `products-${new Date().toISOString().slice(0,10)}.xlsx`,
      "Products",
      [
        ["SKU", "Name", "Brand", "Model", "Category", "Unit", "Status", "Reorder Point", "Base Cost (MMK)", "Last Cost (MMK)", "Barcode"],
        ...selected.map(p => [
          p.sku,
          p.name,
          p.brand || "",
          p.model || "",
          p.category || "",
          p.unit,
          p.status,
          p.reorder_point,
          p.base_cost_mmk,
          p.last_purchase_cost_mmk,
          p.barcode_value || "",
        ]),
      ],
      [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 16 }]
    );
  };

  const columns = [
    {
      key: "select",
      className: "w-14",
      header: (
        <label className="flex h-10 w-10 cursor-pointer items-center justify-center" title="Select all products on this page">
          <input
            type="checkbox"
            checked={isAllVisibleSelected(selectedIds, pageIds)}
            ref={(element) => {
              if (element) {
                element.indeterminate = pageIds.some((id) => selectedIds.has(id)) &&
                  !isAllVisibleSelected(selectedIds, pageIds);
              }
            }}
            aria-label="Select all products on this page"
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="cursor-pointer rounded border-border"
          />
        </label>
      ),
      render: (p: Product) => (
        <label
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded hover:bg-card-hover"
          onClick={(e) => e.stopPropagation()}
          title={`Select ${p.name}`}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(p.id)}
            aria-label={`Select ${p.name}`}
            onChange={() => toggleSelect(p.id)}
            className="cursor-pointer rounded border-border"
          />
        </label>
      ),
    },
    { key: "sku", header: "SKU" },
    { key: "name", header: "Name" },
    { key: "brand", header: "Brand", render: (p: Product) => p.brand || "-" },
    { key: "model", header: "Model", render: (p: Product) => p.model || "-" },
    {
      key: "category",
      header: "Category",
      render: (p: Product) =>
        p.category ? <Badge variant="info">{p.category}</Badge> : <span className="text-muted">-</span>,
    },
    { key: "unit", header: "Unit" },
    {
      key: "status",
      header: "Status",
      render: (p: Product) => (
        <Badge variant={p.status === "ACTIVE" ? "success" : "danger"}>{p.status}</Badge>
      ),
    },
    {
      key: "reorder",
      header: "Reorder",
      render: (p: Product) => <span className="text-sm">{p.reorder_point}</span>,
    },
    {
      key: "cost",
      header: "Last Cost",
      render: (p: Product) => <span className="text-sm">{formatMmk(p.last_purchase_cost_mmk)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          {canManage && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingProduct(p); }}
              className="p-1.5 rounded hover:bg-card-hover text-muted hover:text-foreground"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
          )}
          {canManage && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("Delete this product?")) return;
                try {
                  await removeProduct(p.id);
                  setProducts((prev) => prev.filter((x) => x.id !== p.id));
                  toast.success("Product deleted");
                } catch (err) {
                  toast.error(friendlyErrorMessage(err, "Failed to delete product"));
                }
              }}
              className="p-1.5 rounded hover:bg-danger/10 text-muted hover:text-danger"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Purchase costs are commercially sensitive; only roles that can manage the
  // catalog see them.
  const visibleColumns = canManage ? columns : columns.filter((column) => column.key !== "cost");

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        actions={
          canManage && (
            <Button onClick={() => { setEditingProduct(null); setShowAdd(true); }}>
              <Plus size={16} /> Add Product
            </Button>
          )
        }
      />

      {userLoading ? (
        <Spinner />
      ) : (
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <Input
            type="text"
            placeholder="Search by name, SKU, brand, model, or category..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            iconLeft={<Search size={16} />}
            wrapperClassName="max-w-md w-full sm:w-auto"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            options={[{ value: "", label: "All categories" }, ...allCategories.map((c) => ({ value: c, label: c }))]}
            wrapperClassName="w-full sm:w-44"
          />
          {canManage && (
            <Button variant="secondary" onClick={() => setShowImport(true)} title="Import products from CSV or Excel">
              <Upload size={16} /> Import
            </Button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted" aria-live="polite">{selectedIds.size} selected</span>
            <Button variant="secondary" size="sm" onClick={handleBulkExport}>
              <Download size={14} /> Export
            </Button>
            {canManage && (
              <Button variant="secondary" size="sm" onClick={handleBulkDelete} className="text-danger hover:bg-danger/10">
                <Trash2 size={14} /> Delete
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        )}
      </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description={canManage ? "Add your first product to get started with stock management." : "No products have been added yet."}
          action={canManage ? { label: "Add Product", onClick: () => { setEditingProduct(null); setShowAdd(true); } } : undefined}
        />
      ) : (
        <>
          <Table
            columns={visibleColumns}
            data={paginated}
            onRowClick={(p) => router.push(`/products/${(p as unknown as Product).id}`)}
            emptyMessage="No products match your search"
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Product pagination"
          />
        </>
      )}

      <ProductModal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditingProduct(null); }}
        onSuccess={loadProducts}
        initialData={editingProduct}
        categorySuggestions={allCategories}
        existingBarcodes={products.map((p) => p.barcode_value).filter((value): value is string => Boolean(value))}
      />

      <ImportProductsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadProducts}
        existingSkus={products.map((p) => p.sku.toLowerCase())}
        existingBarcodes={products.map((p) => p.barcode_value).filter((value): value is string => Boolean(value))}
      />
    </div>
  );
}

function ProductModal({ open, onClose, onSuccess, initialData, categorySuggestions, existingBarcodes }: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  initialData: Product | null;
  categorySuggestions?: string[];
  existingBarcodes?: string[];
}) {
  const [form, setForm] = useState<ProductFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({
          name: initialData.name,
          sku: initialData.sku,
          brand: initialData.brand || "",
          model: initialData.model || "",
          category: initialData.category || "",
          color: initialData.color || "",
          size: initialData.size || "",
          unit: initialData.unit,
          barcode_value: initialData.barcode_value || "",
          barcode_format: initialData.barcode_format,
          reorder_point: initialData.reorder_point,
          base_cost_mmk: initialData.base_cost_mmk,
          last_purchase_cost_mmk: initialData.last_purchase_cost_mmk,
          upc_eans: initialData.upc_eans || [],
          status: initialData.status,
        });
      } else {
        setForm(defaultForm);
      }
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        brand: form.brand || null,
        model: form.model || null,
        category: form.category.trim() || null,
        color: form.color || null,
        size: form.size || null,
        unit: form.unit,
        barcode_value: form.barcode_value || null,
        barcode_format: form.barcode_format,
        reorder_point: form.reorder_point,
        base_cost_mmk: form.base_cost_mmk,
        last_purchase_cost_mmk: form.last_purchase_cost_mmk,
        upc_eans: form.upc_eans,
        status: form.status,
      };
      if (isEditing && initialData) {
        await editProduct(initialData.id, payload);
        toast.success("Product updated");
      } else {
        const created = await addProduct(payload);
        const generated = !form.barcode_value.trim();
        toast.success(
          "Product created",
          generated && created.barcode_value
            ? { description: `Auto-generated barcode: ${created.barcode_value}` }
            : undefined
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(
        friendlyErrorMessage(err, isEditing ? "Failed to update product" : "Failed to create product")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit Product" : "Add Product"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        </div>
        <div>
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            list="product-category-suggestions"
            placeholder="e.g. PPE, Tools, Materials"
          />
          <datalist id="product-category-suggestions">
            {(categorySuggestions ?? PRODUCT_CATEGORIES).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <Input label="Size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Unit"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            options={PRODUCT_UNITS.map(u => ({ value: u, label: u }))}
          />
          <Select
            label="Barcode Format"
            value={form.barcode_format || ""}
            onChange={(e) => setForm({ ...form, barcode_format: (e.target.value as BarcodeFormat) || null })}
            options={[
              { value: "", label: "Auto (EAN-13 / detect)" },
              { value: "CODE128", label: "Code128" },
              { value: "EAN13", label: "EAN-13" },
              { value: "QR", label: "QR Code" },
            ]}
          />
        </div>
        <div>
          <div className="flex items-end gap-2">
            <Input
              label="Barcode Value"
              value={form.barcode_value}
              onChange={(e) => setForm({ ...form, barcode_value: e.target.value })}
              placeholder="Leave blank to auto-generate"
              wrapperClassName="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setForm({
                ...form,
                barcode_value: generateBarcodeValue(new Set(existingBarcodes ?? [])),
                barcode_format: form.barcode_format ?? "EAN13",
              })}
              title="Generate a unique EAN-13 barcode"
            >
              <Wand2 size={14} /> Generate
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted">
            Leave blank to auto-generate a unique EAN-13 barcode. The same value can be printed as a barcode or QR code from the product page.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <NumericInput 
            label="Reorder Point" 
            value={form.reorder_point} 
            onChange={(v) => setForm({ ...form, reorder_point: v })} 
          />
          <PriceInput
            label="Base Cost (MMK)"
            value={form.base_cost_mmk}
            onChange={(v) => setForm({ ...form, base_cost_mmk: v })}
            previousValue={initialData?.base_cost_mmk ?? null}
          />
          <PriceInput
            label="Last Cost (MMK)"
            value={form.last_purchase_cost_mmk}
            onChange={(v) => setForm({ ...form, last_purchase_cost_mmk: v })}
            previousValue={initialData?.last_purchase_cost_mmk ?? null}
          />
        </div>
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "DISCONTINUED", label: "Discontinued" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEditing ? "Update" : "Create"} Product</Button>
        </div>
      </form>
    </Modal>
  );
}

const IMPORT_HEADERS = ["SKU *", "Name *", "Brand", "Model", "Category", "Unit", "Status", "Reorder Point", "Base Cost (MMK)", "Last Cost (MMK)", "Barcode", "Barcode Format"];

const IMPORT_GUIDE_ROWS: (string | null)[][] = [
  ["Product Import Guide", null, null],
  [null, null, null],
  ["Column", "Required", "Notes"],
  ["SKU *", "Yes", "Unique product code. Required on every row. SKUs that already exist are skipped."],
  ["Name *", "Yes", "Product name. Required on every row."],
  ["Brand", "No", "Optional brand name."],
  ["Model", "No", "Optional model number."],
  ["Category", "No", "Optional category, e.g. PPE, Tools, Materials."],
  ["Unit", "No", "Unit of measure. Defaults to pcs."],
  ["Status", "No", "ACTIVE (default) or DISCONTINUED."],
  ["Reorder Point", "No", "Whole number. Defaults to 0."],
  ["Base Cost (MMK)", "No", "Base cost in MMK. Defaults to 0."],
  ["Last Cost (MMK)", "No", "Last purchase cost in MMK. Defaults to 0."],
  ["Barcode", "No", "Leave blank to auto-generate a unique EAN-13 barcode. A QR code can be printed from the same value."],
  ["Barcode Format", "No", "CODE128, EAN13 or QR. If blank, a supplied 13-digit barcode is checked as EAN-13; otherwise Code128 is used."],
  [null, null, null],
  ["Tip", null, "Keep the header names in the Products sheet unchanged so the importer can map the columns."],
];

type ImportPayload = Omit<Product, "id" | "created_at" | "updated_at" | "org_id">;

interface ImportIssue {
  rowNumber: number;
  message: string;
}

function ImportProductsModal({
  open,
  onClose,
  onImported,
  existingSkus,
  existingBarcodes,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  existingSkus: string[];
  existingBarcodes: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [valid, setValid] = useState<ImportPayload[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [skippedExisting, setSkippedExisting] = useState(0);
  const [generatedBarcodes, setGeneratedBarcodes] = useState(0);
  const [importing, setImporting] = useState(false);

  function reset() {
    setFileName("");
    setParseError(null);
    setValid([]);
    setIssues([]);
    setSkippedExisting(0);
    setGeneratedBarcodes(0);
  }

  function analyze(data: SheetData) {
    const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
    const findCol = (...aliases: string[]) => data.headers.findIndex((h) => aliases.includes(norm(h)));

    const nameCol = findCol("name", "productname", "product");
    const skuCol = findCol("sku", "productcode", "code");
    if (nameCol === -1 || skuCol === -1) {
      setParseError('Missing required columns. The file must contain "Name" and "SKU" headers.');
      return;
    }
    const brandCol = findCol("brand");
    const modelCol = findCol("model");
    const categoryCol = findCol("category", "cat");
    const unitCol = findCol("unit", "uom");
    const statusCol = findCol("status");
    const reorderCol = findCol("reorderpoint", "reorder", "reorderlevel");
    const baseCostCol = findCol("basecostmmk", "basecost");
    const lastCostCol = findCol("lastcostmmk", "lastcost", "lastpurchasecostmmk", "lastpurchasecost", "cost");
    const barcodeCol = findCol("barcode", "barcodevalue", "barcodeno");
    const barcodeFormatCol = findCol("barcodeformat", "format");

    const known = new Set(existingSkus);
    const seenInFile = new Set<string>();
    const usedBarcodes = new Set(existingBarcodes.map((value) => value.trim()).filter(Boolean));
    const validRows: ImportPayload[] = [];
    const foundIssues: ImportIssue[] = [];
    let skipped = 0;
    let generated = 0;

    const parseNumber = (raw: string): number | null => {
      if (raw === "") return 0;
      const n = Number(raw.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    data.rows.forEach((row, i) => {
      const rowNumber = i + 2; // 1-based, +1 for header row
      const cell = (col: number) => (col === -1 ? "" : (row[col] ?? "").trim());

      const name = cell(nameCol);
      const sku = cell(skuCol);
      if (!name) {
        foundIssues.push({ rowNumber, message: "Name is required" });
        return;
      }
      if (!sku) {
        foundIssues.push({ rowNumber, message: "SKU is required" });
        return;
      }
      const skuKey = sku.toLowerCase();
      if (known.has(skuKey)) {
        skipped++;
        return;
      }
      if (seenInFile.has(skuKey)) {
        foundIssues.push({ rowNumber, message: `Duplicate SKU "${sku}" in this file` });
        return;
      }

      let status: ProductStatus = "ACTIVE";
      const statusRaw = cell(statusCol).toLowerCase();
      if (statusRaw && statusRaw !== "active" && statusRaw !== "discontinued") {
        foundIssues.push({ rowNumber, message: `Unknown status "${cell(statusCol)}" (use ACTIVE or DISCONTINUED)` });
        return;
      }
      if (statusRaw === "discontinued") status = "DISCONTINUED";

      const reorder = parseNumber(cell(reorderCol));
      const baseCost = parseNumber(cell(baseCostCol));
      const lastCost = parseNumber(cell(lastCostCol));
      if (reorder === null) {
        foundIssues.push({ rowNumber, message: `"${cell(reorderCol)}" is not a valid reorder point` });
        return;
      }
      if (baseCost === null) {
        foundIssues.push({ rowNumber, message: `"${cell(baseCostCol)}" is not a valid base cost` });
        return;
      }
      if (lastCost === null) {
        foundIssues.push({ rowNumber, message: `"${cell(lastCostCol)}" is not a valid last cost` });
        return;
      }

      const formatRaw = cell(barcodeFormatCol);
      const requestedFormat = parseBarcodeFormat(formatRaw);
      if (formatRaw && !requestedFormat) {
        foundIssues.push({
          rowNumber,
          message: `Unknown barcode format "${formatRaw}" (use CODE128, EAN13 or QR)`,
        });
        return;
      }

      const barcode = cell(barcodeCol);
      let barcodeValue: string;
      let barcodeFormat: BarcodeFormat;

      if (barcode) {
        if (usedBarcodes.has(barcode)) {
          foundIssues.push({
            rowNumber,
            message: `Barcode "${barcode}" is already used by another product or row`,
          });
          return;
        }
        barcodeValue = barcode;
        barcodeFormat = requestedFormat ?? detectBarcodeFormat(barcode);
        if (barcodeFormat === "EAN13" && !isValidEan13(barcode)) {
          foundIssues.push({
            rowNumber,
            message: `"${barcode}" is not a valid EAN-13 barcode (use CODE128 or QR for this value)`,
          });
          return;
        }
      } else {
        barcodeValue = generateBarcodeValue(usedBarcodes);
        barcodeFormat = requestedFormat ?? "EAN13";
        generated += 1;
      }
      usedBarcodes.add(barcodeValue);

      seenInFile.add(skuKey);
      validRows.push({
        name,
        sku,
        brand: cell(brandCol) || null,
        model: cell(modelCol) || null,
        category: cell(categoryCol) || null,
        color: null,
        size: null,
        unit: cell(unitCol) || "pcs",
        barcode_value: barcodeValue,
        barcode_format: barcodeFormat,
        reorder_point: Math.max(0, Math.round(reorder)),
        base_cost_mmk: Math.max(0, baseCost),
        last_purchase_cost_mmk: Math.max(0, lastCost),
        upc_eans: [],
        status,
      });
    });

    setValid(validRows);
    setIssues(foundIssues);
    setSkippedExisting(skipped);
    setGeneratedBarcodes(generated);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    setValid([]);
    setIssues([]);
    setSkippedExisting(0);
    setGeneratedBarcodes(0);
    setParsing(true);
    try {
      const data = await readSpreadsheet(file);
      analyze(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read the file");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (valid.length === 0) return;
    setImporting(true);
    try {
      await addProductsBulk(valid);
      toast.success(
        `Imported ${valid.length} product(s)`,
        generatedBarcodes > 0
          ? { description: `${generatedBarcodes} barcode(s) auto-generated. Print them from each product's Barcode tab.` }
          : undefined
      );
      onImported();
      onClose();
      reset();
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Failed to import products"));
    } finally {
      setImporting(false);
    }
  }

  const hasAnalysis = !parsing && (valid.length > 0 || issues.length > 0 || skippedExisting > 0);

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Import Products" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Upload a .csv or .xlsx file with product rows. <span className="text-foreground">SKU</span> and{" "}
          <span className="text-foreground">Name</span> are required; every other column is optional.
          Rows without a barcode get a unique EAN-13 barcode automatically. Use the{" "}
          <span className="text-foreground">Barcode Format</span> column (CODE128, EAN13 or QR) to
          choose the label type. Download the template for the full field guide.
        </p>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
            <FileSpreadsheet size={16} /> {fileName || "Choose file…"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              exportWorkbook("product-import-template.xlsx", [
                {
                  name: "Products",
                  rows: [IMPORT_HEADERS],
                  colWidths: [
                    { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
                    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
                  ],
                },
                {
                  name: "Instructions",
                  rows: IMPORT_GUIDE_ROWS,
                  colWidths: [{ wch: 24 }, { wch: 10 }, { wch: 100 }],
                },
              ])
            }
          >
            <Download size={14} /> Template
          </Button>
        </div>

        {parsing && <p className="text-sm text-muted">Reading file…</p>}
        {parseError && <p className="text-sm text-danger">{parseError}</p>}

        {hasAnalysis && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="text-foreground font-medium">{valid.length}</span> ready to import</span>
              {skippedExisting > 0 && (
                <span className="text-muted"><span className="font-medium">{skippedExisting}</span> skipped (SKU already exists)</span>
              )}
              {generatedBarcodes > 0 && (
                <span className="text-muted"><span className="font-medium">{generatedBarcodes}</span> barcode(s) will be auto-generated</span>
              )}
              {issues.length > 0 && (
                <span className="text-danger"><span className="font-medium">{issues.length}</span> with errors</span>
              )}
            </div>
            {issues.length > 0 && (
              <ul className="text-xs text-danger space-y-0.5 max-h-32 overflow-y-auto">
                {issues.slice(0, 8).map((issue, i) => (
                  <li key={i}>Row {issue.rowNumber}: {issue.message}</li>
                ))}
                {issues.length > 8 && <li>…and {issues.length - 8} more</li>}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={() => { onClose(); reset(); }}>Cancel</Button>
          <Button onClick={handleImport} loading={importing} disabled={valid.length === 0 || parsing}>
            Import {valid.length > 0 ? `${valid.length} product(s)` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}