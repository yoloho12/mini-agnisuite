export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

export type DemoRows = Record<string, unknown>[];
export type DemoStore = Record<string, DemoRows>;

let seq = 0;
export function nextId(): string {
  seq += 1;
  return `demo-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const now = new Date();
const iso = (daysAgo: number): string => {
  const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString();
};

const ORG = DEMO_ORG_ID;

const WH_MAIN = "wh-0001";
const WH_THILAWA = "wh-0002";
const SITE_DAWBON = "site-0001";
const SITE_HLAING = "site-0002";
const SITE_PROJECT = "site-0003";

const SUP_AGNI = "sup-0001";
const SUP_GOLD = "sup-0002";
const SUP_UNION = "sup-0003";

const P1 = "p-0001";
const P2 = "p-0002";
const P3 = "p-0003";
const P4 = "p-0004";
const P5 = "p-0005";
const P6 = "p-0006";
const P7 = "p-0007";
const P8 = "p-0008";
const P9 = "p-0009";
const P10 = "p-0010";
const P11 = "p-0011";
const P12 = "p-0012";

function seeded(): DemoStore {
  const products = [
    {
      id: P1,
      org_id: ORG,
      name: "Safety Helmet (White)",
      sku: "HELM-WHT",
      brand: "MSA",
      model: "V-Gard",
      category: "PPE",
      color: "White",
      size: "One Size",
      unit: "pcs",
      barcode_value: "8991100012341",
      barcode_format: "EAN13",
      reorder_point: 10,
      base_cost_mmk: 8500,
      last_purchase_cost_mmk: 8500,
      upc_eans: ["8991100012341"],
      status: "ACTIVE",
      created_at: iso(120),
      updated_at: iso(45),
    },
    {
      id: P2,
      org_id: ORG,
      name: 'Safety Gloves "ProGrip" (Pair)',
      sku: "GLV-PRO",
      brand: "Honeywell",
      model: "ProGrip 400",
      category: "PPE",
      color: "Grey",
      size: "L",
      unit: "pair",
      barcode_value: "8991100012358",
      barcode_format: "EAN13",
      reorder_point: 25,
      base_cost_mmk: 4200,
      last_purchase_cost_mmk: 4100,
      upc_eans: ["8991100012358"],
      status: "ACTIVE",
      created_at: iso(118),
      updated_at: iso(30),
    },
    {
      id: P3,
      org_id: ORG,
      name: "Reflective Safety Vest",
      sku: "VEST-REF",
      brand: "Agni",
      model: "V2",
      category: "Safety Gear",
      color: "Orange",
      size: "Universal",
      unit: "pcs",
      barcode_value: "8991100012365",
      barcode_format: "EAN13",
      reorder_point: 15,
      base_cost_mmk: 6800,
      last_purchase_cost_mmk: 6800,
      upc_eans: ["8991100012365"],
      status: "ACTIVE",
      created_at: iso(100),
      updated_at: iso(20),
    },
    {
      id: P4,
      org_id: ORG,
      name: "Lanyard with Quick Release",
      sku: "LAN-QR",
      brand: "3M",
      model: "QR-200",
      category: "Safety Gear",
      color: "Yellow",
      size: "1.2m",
      unit: "pcs",
      barcode_value: "8991100012372",
      barcode_format: "EAN13",
      reorder_point: 20,
      base_cost_mmk: 12500,
      last_purchase_cost_mmk: 11800,
      upc_eans: ["8991100012372"],
      status: "ACTIVE",
      created_at: iso(95),
      updated_at: iso(15),
    },
    {
      id: P5,
      org_id: ORG,
      name: "Disposable Dust Masks (50/Pack)",
      sku: "MASK-D50",
      brand: "Agni",
      model: null,
      category: "PPE",
      color: "White",
      size: null,
      unit: "pack",
      barcode_value: "8991100012389",
      barcode_format: "EAN13",
      reorder_point: 40,
      base_cost_mmk: 5600,
      last_purchase_cost_mmk: 5400,
      upc_eans: ["8991100012389"],
      status: "ACTIVE",
      created_at: iso(88),
      updated_at: iso(8),
    },
    {
      id: P6,
      org_id: ORG,
      name: "Steel Toe Safety Boots",
      sku: "BOOT-ST",
      brand: "Red Wing",
      model: "Kingsman",
      category: "Footwear",
      color: "Black",
      size: "42",
      unit: "pair",
      barcode_value: "8991100012396",
      barcode_format: "EAN13",
      reorder_point: 8,
      base_cost_mmk: 52000,
      last_purchase_cost_mmk: 50500,
      upc_eans: ["8991100012396"],
      status: "ACTIVE",
      created_at: iso(80),
      updated_at: iso(5),
    },
    {
      id: P7,
      org_id: ORG,
      name: "Copper Cable 2.5mm² (100m Roll)",
      sku: "CBL-CU25",
      brand: "Myanmar Cable",
      model: "Cu-2.5",
      category: "Electrical",
      color: null,
      size: "100m",
      unit: "roll",
      barcode_value: "8991100012403",
      barcode_format: "EAN13",
      reorder_point: 5,
      base_cost_mmk: 62000,
      last_purchase_cost_mmk: 72000,
      upc_eans: ["8991100012403"],
      status: "ACTIVE",
      created_at: iso(70),
      updated_at: iso(10),
    },
    {
      id: P8,
      org_id: ORG,
      name: "LED Work Light 50W",
      sku: "LIGHT-LED50",
      brand: "Philips",
      model: "LED-50W",
      category: "Electrical",
      color: null,
      size: null,
      unit: "pcs",
      barcode_value: "8991100012410",
      barcode_format: "EAN13",
      reorder_point: 10,
      base_cost_mmk: 27000,
      last_purchase_cost_mmk: 24000,
      upc_eans: ["8991100012410"],
      status: "ACTIVE",
      created_at: iso(50),
      updated_at: iso(12),
    },
    {
      id: P9,
      org_id: ORG,
      name: "Angle Grinder 850W",
      sku: "GRIND-850",
      brand: "Makita",
      model: "GA4530",
      category: "Tools",
      color: "Teal",
      size: null,
      unit: "pcs",
      barcode_value: "8991100012417",
      barcode_format: "EAN13",
      reorder_point: 4,
      base_cost_mmk: 38500,
      last_purchase_cost_mmk: 38500,
      upc_eans: ["8991100012417"],
      status: "ACTIVE",
      created_at: iso(70),
      updated_at: iso(55),
    },
    {
      id: P10,
      org_id: ORG,
      name: "Cement Bag 50kg",
      sku: "CEM-50",
      brand: "Myanmar Cement",
      model: null,
      category: "Materials",
      color: "Grey",
      size: "50kg",
      unit: "bag",
      barcode_value: "8991100012424",
      barcode_format: "EAN13",
      reorder_point: 30,
      base_cost_mmk: 9500,
      last_purchase_cost_mmk: 9200,
      upc_eans: ["8991100012424"],
      status: "ACTIVE",
      created_at: iso(70),
      updated_at: iso(20),
    },
    {
      id: P11,
      org_id: ORG,
      name: "Copper Pipe 1/2in (6m)",
      sku: "PIPE-CU12",
      brand: "Parker",
      model: null,
      category: "Materials",
      color: "Copper",
      size: "6m",
      unit: "length",
      barcode_value: "8991100012431",
      barcode_format: "EAN13",
      reorder_point: 10,
      base_cost_mmk: 15500,
      last_purchase_cost_mmk: 16800,
      upc_eans: ["8991100012431"],
      status: "ACTIVE",
      created_at: iso(50),
      updated_at: iso(10),
    },
    {
      id: P12,
      org_id: ORG,
      name: "Welding Rod 3.2mm (5kg)",
      sku: "WELD-32",
      brand: "Kobe",
      model: null,
      category: "Consumables",
      color: null,
      size: "5kg",
      unit: "box",
      barcode_value: "8991100012438",
      barcode_format: "EAN13",
      reorder_point: 8,
      base_cost_mmk: 12800,
      last_purchase_cost_mmk: 12800,
      upc_eans: ["8991100012438"],
      status: "ACTIVE",
      created_at: iso(50),
      updated_at: iso(9),
    },
  ];

  const warehouses = [
    {
      id: WH_MAIN,
      org_id: ORG,
      name: "Main Warehouse",
      address: "No. 124, Thiri Mingalar Road, Yangon",
      contact_person: "U Aung Myint",
      is_active: true,
      created_at: iso(120),
    },
    {
      id: WH_THILAWA,
      org_id: ORG,
      name: "Thilawa Distrib Center",
      address: "Zone B, Thilawa SEZ, Thanlyin",
      contact_person: "Daw Ei Mon",
      is_active: true,
      created_at: iso(110),
    },
  ];

  const sites = [
    {
      id: SITE_DAWBON,
      org_id: ORG,
      name: "Dawbon Site",
      address: "Dawbon Industrial, Yangon",
      site_type: "PROJECT",
      contact_person: "Ko Zaw Lin",
      is_active: true,
      created_at: iso(100),
    },
    {
      id: SITE_HLAING,
      org_id: ORG,
      name: "Hlaing Site",
      address: "Hlaing Thar Yar, Yangon",
      site_type: "BRANCH",
      contact_person: "Ma Su Su",
      is_active: true,
      created_at: iso(90),
    },
    {
      id: SITE_PROJECT,
      org_id: ORG,
      name: "Shwe Linban Project",
      address: "Shwe Linban, Bago Region",
      site_type: "PROJECT",
      contact_person: "Ko Ko Gyi",
      is_active: true,
      created_at: iso(70),
    },
  ];

  const siteReceivers = [
    { id: "recv-0001", site_id: SITE_DAWBON, name: "Zaw Lin", phone: "09 123 456 789", is_active: true },
    { id: "recv-0002", site_id: SITE_DAWBON, name: "Htet Aung", phone: "09 987 654 321", is_active: true },
    { id: "recv-0003", site_id: SITE_HLAING, name: "Su Su Hlaing", phone: "09 555 111 222", is_active: true },
    { id: "recv-0004", site_id: SITE_PROJECT, name: "Ko Ko Gyi", phone: "09 777 333 444", is_active: true },
  ];

  const contacts = [
    {
      id: SUP_AGNI,
      org_id: ORG,
      name: "Agni Safety Supplies",
      phone: "01 380 999",
      email: "sales@agnisafety.com.mm",
      type: "SUPPLIER",
      blacklist_status: false,
      notes: "Primary PPE supplier",
      created_at: iso(120),
    },
    {
      id: SUP_GOLD,
      org_id: ORG,
      name: "Golden Gate Trading",
      phone: "01 502 113",
      email: "order@goldengate.com.mm",
      type: "SUPPLIER",
      blacklist_status: false,
      notes: null,
      created_at: iso(115),
    },
    {
      id: SUP_UNION,
      org_id: ORG,
      name: "Union Industrial Supply",
      phone: "09 430 220 118",
      email: "contact@unionind.com.mm",
      type: "SUPPLIER",
      blacklist_status: false,
      notes: null,
      created_at: iso(100),
    },
  ];

  const stockLevels = [
    { id: "sl-0001", product_id: P1, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 120, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0002", product_id: P2, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 85, reserved_quantity: 5, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0003", product_id: P3, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 9, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0004", product_id: P4, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 0, reserved_quantity: 0, status: "OUT_OF_STOCK", updated_at: iso(1) },
    { id: "sl-0005", product_id: P5, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 200, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0006", product_id: P6, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 26, reserved_quantity: 2, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0007", product_id: P1, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_THILAWA, quantity: 60, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0008", product_id: P2, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_THILAWA, quantity: 14, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0009", product_id: P5, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_THILAWA, quantity: 90, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0010", product_id: P3, org_id: ORG, location_type: "SITE", location_id: SITE_DAWBON, quantity: 30, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0011", product_id: P1, org_id: ORG, location_type: "SITE", location_id: SITE_DAWBON, quantity: 40, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0012", product_id: P2, org_id: ORG, location_type: "SITE", location_id: SITE_DAWBON, quantity: 6, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0013", product_id: P1, org_id: ORG, location_type: "SITE", location_id: SITE_HLAING, quantity: 25, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0014", product_id: P4, org_id: ORG, location_type: "SITE", location_id: SITE_HLAING, quantity: 0, reserved_quantity: 0, status: "OUT_OF_STOCK", updated_at: iso(1) },
    { id: "sl-0015", product_id: P6, org_id: ORG, location_type: "SITE", location_id: SITE_PROJECT, quantity: 4, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0016", product_id: P7, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 28, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0017", product_id: P7, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_THILAWA, quantity: 6, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0018", product_id: P8, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 33, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0019", product_id: P8, org_id: ORG, location_type: "SITE", location_id: SITE_PROJECT, quantity: 5, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0020", product_id: P9, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 6, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0021", product_id: P9, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_THILAWA, quantity: 2, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0022", product_id: P10, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 16, reserved_quantity: 0, status: "LOW_STOCK", updated_at: iso(1) },
    { id: "sl-0023", product_id: P10, org_id: ORG, location_type: "SITE", location_id: SITE_PROJECT, quantity: 60, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
{ id: "sl-0024", product_id: P11, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_MAIN, quantity: 25, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
{ id: "sl-0025", product_id: P11, org_id: ORG, location_type: "SITE", location_id: SITE_DAWBON, quantity: 25, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
    { id: "sl-0026", product_id: P12, org_id: ORG, location_type: "WAREHOUSE", location_id: WH_THILAWA, quantity: 22, reserved_quantity: 0, status: "IN_STOCK", updated_at: iso(1) },
  ];

  const purchaseOrders = [
    {
      id: "po-0001",
      org_id: ORG,
      supplier_id: SUP_AGNI,
      warehouse_id: WH_MAIN,
      po_number: "PO-2026-0001",
      status: "RECEIVED",
      currency: "MMK",
      usd_rate: 4200,
      total_mmk: 1140000,
      notes: "Fortnightly PPE restock",
      created_by: "dev-user-000",
      created_at: iso(14),
      updated_at: iso(7),
    },
    {
      id: "po-0002",
      org_id: ORG,
      supplier_id: SUP_GOLD,
      warehouse_id: WH_THILAWA,
      po_number: "PO-2026-0002",
      status: "PARTIAL",
      currency: "MMK",
      usd_rate: 4200,
      total_mmk: 1560000,
      notes: null,
      created_by: "dev-user-000",
      created_at: iso(6),
      updated_at: iso(2),
    },
    {
      id: "po-0003",
      org_id: ORG,
      supplier_id: SUP_UNION,
      warehouse_id: WH_MAIN,
      po_number: "PO-2026-0003",
      status: "PENDING",
      currency: "USD",
      usd_rate: 4200,
      total_mmk: 0,
      notes: "Awaiting proforma invoice",
      created_by: "dev-user-000",
      created_at: iso(2),
      updated_at: iso(2),
    },
    {
      id: "po-0004",
      org_id: ORG,
      supplier_id: SUP_UNION,
      warehouse_id: WH_MAIN,
      po_number: "PO-2026-0004",
      status: "RECEIVED",
      currency: "MMK",
      usd_rate: 4200,
      total_mmk: 2885000,
      notes: "Electrical & materials restock",
      created_by: "dev-user-000",
      created_at: iso(70),
      updated_at: iso(62),
    },
    {
      id: "po-0005",
      org_id: ORG,
      supplier_id: SUP_GOLD,
      warehouse_id: WH_MAIN,
      po_number: "PO-2026-0005",
      status: "RECEIVED",
      currency: "MMK",
      usd_rate: 4200,
      total_mmk: 1865000,
      notes: null,
      created_by: "dev-user-000",
      created_at: iso(50),
      updated_at: iso(42),
    },
    {
      id: "po-0006",
      org_id: ORG,
      supplier_id: SUP_UNION,
      warehouse_id: WH_MAIN,
      po_number: "PO-2026-0006",
      status: "RECEIVED",
      currency: "MMK",
      usd_rate: 4250,
      total_mmk: 1416000,
      notes: "Reorder at new market prices",
      created_by: "dev-user-000",
      created_at: iso(12),
      updated_at: iso(10),
    },
  ];

  const poLineItems = [
    { id: "poi-0001", po_id: "po-0001", product_id: P1, qty_ordered: 60, qty_received: 60, unit_cost_mmk: 8500, status: "RECEIVED" },
    { id: "poi-0002", po_id: "po-0001", product_id: P2, qty_ordered: 100, qty_received: 100, unit_cost_mmk: 4100, status: "RECEIVED" },
    { id: "poi-0003", po_id: "po-0001", product_id: P3, qty_ordered: 30, qty_received: 30, unit_cost_mmk: 6800, status: "RECEIVED" },
    { id: "poi-0004", po_id: "po-0002", product_id: P4, qty_ordered: 60, qty_received: 40, unit_cost_mmk: 11800, status: "PARTIAL" },
    { id: "poi-0005", po_id: "po-0002", product_id: P6, qty_ordered: 20, qty_received: 20, unit_cost_mmk: 50500, status: "RECEIVED" },
    { id: "poi-0006", po_id: "po-0003", product_id: P1, qty_ordered: 40, qty_received: 0, unit_cost_mmk: 8500, status: "PENDING" },
    { id: "poi-0007", po_id: "po-0003", product_id: P5, qty_ordered: 100, qty_received: 0, unit_cost_mmk: 5400, status: "PENDING" },
    { id: "poi-0008", po_id: "po-0004", product_id: P7, qty_ordered: 25, qty_received: 25, unit_cost_mmk: 62000, status: "RECEIVED" },
    { id: "poi-0009", po_id: "po-0004", product_id: P9, qty_ordered: 10, qty_received: 10, unit_cost_mmk: 38500, status: "RECEIVED" },
    { id: "poi-0010", po_id: "po-0004", product_id: P10, qty_ordered: 100, qty_received: 100, unit_cost_mmk: 9500, status: "RECEIVED" },
    { id: "poi-0011", po_id: "po-0005", product_id: P8, qty_ordered: 40, qty_received: 40, unit_cost_mmk: 27000, status: "RECEIVED" },
    { id: "poi-0012", po_id: "po-0005", product_id: P11, qty_ordered: 30, qty_received: 30, unit_cost_mmk: 15500, status: "RECEIVED" },
    { id: "poi-0013", po_id: "po-0005", product_id: P12, qty_ordered: 25, qty_received: 25, unit_cost_mmk: 12800, status: "RECEIVED" },
    { id: "poi-0014", po_id: "po-0006", product_id: P7, qty_ordered: 15, qty_received: 15, unit_cost_mmk: 72000, status: "RECEIVED" },
    { id: "poi-0015", po_id: "po-0006", product_id: P11, qty_ordered: 20, qty_received: 20, unit_cost_mmk: 16800, status: "RECEIVED", dest_type: "SITE", dest_id: SITE_DAWBON },
  ];

  const poReceipts = [
    {
      id: "rec-0001",
      po_id: "po-0001",
      org_id: ORG,
      slip_number: "SUP-AGNISAFETYS/SLIP-0001",
      supplier_slip_seq: 1,
      received_by: "U Aung Myint",
      received_items: [
        { product_id: P1, qty: 60 },
        { product_id: P2, qty: 100 },
        { product_id: P3, qty: 30 },
      ],
      received_at: iso(7),
    },
    {
      id: "rec-0002",
      po_id: "po-0002",
      org_id: ORG,
      slip_number: "SUP-GOLDENGATETR/SLIP-0001",
      supplier_slip_seq: 1,
      received_by: "Daw Ei Mon",
      received_items: [
        { product_id: P4, qty: 40 },
        { product_id: P6, qty: 20 },
      ],
      received_at: iso(2),
    },
    {
      id: "rec-0003",
      po_id: "po-0004",
      org_id: ORG,
      slip_number: "SUP-UNIONINDUST/SLIP-0001",
      supplier_slip_seq: 1,
      received_by: "U Aung Myint",
      received_items: [
        { product_id: P7, qty: 25 },
        { product_id: P9, qty: 10 },
        { product_id: P10, qty: 100 },
      ],
      received_at: iso(62),
    },
    {
      id: "rec-0004",
      po_id: "po-0005",
      org_id: ORG,
      slip_number: "SUP-GOLDENGATETR/SLIP-0002",
      supplier_slip_seq: 2,
      received_by: "Daw Ei Mon",
      received_items: [
        { product_id: P8, qty: 40 },
        { product_id: P11, qty: 30 },
        { product_id: P12, qty: 25 },
      ],
      received_at: iso(42),
    },
    {
      id: "rec-0005",
      po_id: "po-0006",
      org_id: ORG,
      slip_number: "SUP-UNIONINDUST/SLIP-0002",
      supplier_slip_seq: 2,
      received_by: "U Aung Myint",
      received_items: [
        { product_id: P7, qty: 15 },
        { product_id: P11, qty: 20 },
      ],
      received_at: iso(10),
    },
  ];

  const poAttachments: Record<string, unknown>[] = [];

  const dispatches = [
    {
      id: "d-0001",
      org_id: ORG,
      from_warehouse_id: WH_MAIN,
      to_site_id: SITE_DAWBON,
      dispatch_number: "DISP-2026-0001",
      status: "ACKNOWLEDGED",
      sender_name: "Demo Owner",
      receiver_name: "Zaw Lin",
      receiver_signature: "Zaw Lin",
      dispatch_note: "Site equipment top-up",
      dispatched_by: "dev-user-000",
      dispatched_at: iso(4),
      acknowledged_at: iso(3),
      acknowledged_by: "dev-user-000",
    },
    {
      id: "d-0002",
      org_id: ORG,
      from_warehouse_id: WH_MAIN,
      to_site_id: SITE_HLAING,
      dispatch_number: "DISP-2026-0002",
      status: "DISPATCHED",
      sender_name: "Demo Owner",
      receiver_name: "Su Su Hlaing",
      receiver_signature: null,
      dispatch_note: null,
      dispatched_by: "dev-user-000",
      dispatched_at: iso(1),
    },
    {
      id: "d-0003",
      org_id: ORG,
      from_warehouse_id: WH_MAIN,
      to_site_id: SITE_PROJECT,
      dispatch_number: "DISP-2026-0003",
      status: "DISPATCHED",
      sender_name: "Demo Owner",
      receiver_name: "Ko Ko Gyi",
      receiver_signature: null,
      dispatch_note: "Materials & tools for phase 2",
      dispatched_by: "dev-user-000",
      dispatched_at: iso(8),
    },
  ];

  const dispatchLineItems = [
    { id: "dli-0001", dispatch_id: "d-0001", product_id: P1, quantity: 40 },
    { id: "dli-0002", dispatch_id: "d-0001", product_id: P3, quantity: 30 },
    { id: "dli-0003", dispatch_id: "d-0002", product_id: P1, quantity: 25 },
    { id: "dli-0004", dispatch_id: "d-0002", product_id: P2, quantity: 10 },
    { id: "dli-0005", dispatch_id: "d-0003", product_id: P7, quantity: 6 },
    { id: "dli-0006", dispatch_id: "d-0003", product_id: P10, quantity: 60 },
    { id: "dli-0007", dispatch_id: "d-0003", product_id: P9, quantity: 2 },
  ];

  const siteReturns = [
    {
      id: "sr-0001",
      org_id: ORG,
      from_site_id: SITE_PROJECT,
      to_warehouse_id: WH_MAIN,
      origin_dispatch_id: null,
      return_number: "RET-2026-0001",
      status: "RETURNED",
      sender_name: "Ko Ko Gyi",
      sender_signature: "Ko Ko Gyi",
      notes: "Unused stock after project phase 1",
      created_by: "dev-user-000",
      created_at: iso(3),
    },
  ];

  const siteReturnLineItems = [
    { id: "srli-0001", return_id: "sr-0001", product_id: P6, quantity: 4, reason: "PROJECT_COMPLETED", condition_notes: "Unopened boxes" },
    { id: "srli-0002", return_id: "sr-0001", product_id: P2, quantity: 12, reason: "UNUSED", condition_notes: null },
  ];

  const stockTransfers = [
    {
      id: "t-0001",
      org_id: ORG,
      from_warehouse_id: WH_THILAWA,
      to_warehouse_id: WH_MAIN,
      transfer_number: "TRF-2026-0001",
      status: "COMPLETED",
      notes: "Re-balance helmet stock",
      created_by: "dev-user-000",
      created_at: iso(5),
    },
  ];

  const transferLineItems = [
    { id: "tli-0001", transfer_id: "t-0001", product_id: P1, quantity: 30 },
  ];

  const supplierReturns = [
    {
      id: "sret-0001",
      org_id: ORG,
      supplier_id: SUP_GOLD,
      warehouse_id: WH_THILAWA,
      return_number: "SRET-2026-0001",
      reason: "Defective batch",
      status: "RETURNED",
      items: [{ product_id: P2, quantity: 10, unit_cost_mmk: 4100 }],
      created_by: "dev-user-000",
      created_at: iso(6),
    },
    {
      id: "sret-0002",
      org_id: ORG,
      supplier_id: SUP_UNION,
      warehouse_id: WH_MAIN,
      return_number: "SRET-2026-0002",
      reason: "Overstocked cement — returned for refund",
      status: "RETURNED",
      items: [{ product_id: P10, quantity: 20, unit_cost_mmk: 9500 }],
      created_by: "dev-user-000",
      created_at: iso(15),
    },
  ];

  const writeOffs = [
    {
      id: "wo-0001",
      org_id: ORG,
      location_type: "WAREHOUSE",
      location_id: WH_MAIN,
      product_id: P4,
      quantity: 2,
      reason: "DAMAGED",
      notes: "Frayed lanyard from storage",
      created_by: "dev-user-000",
      created_at: iso(4),
    },
    {
      id: "wo-0002",
      org_id: ORG,
      location_type: "WAREHOUSE",
      location_id: WH_MAIN,
      product_id: P10,
      quantity: 4,
      reason: "LOST",
      notes: "Water damage in store — bags unusable",
      created_by: "dev-user-000",
      created_at: iso(18),
    },
    {
      id: "wo-0003",
      org_id: ORG,
      location_type: "WAREHOUSE",
      location_id: WH_THILAWA,
      product_id: P12,
      quantity: 3,
      reason: "DAMAGED",
      notes: "Crushed packaging — rods scattered",
      created_by: "dev-user-000",
      created_at: iso(9),
    },
    {
      id: "wo-0004",
      org_id: ORG,
      location_type: "WAREHOUSE",
      location_id: WH_MAIN,
      product_id: P8,
      quantity: 2,
      reason: "DAMAGED",
      notes: "Broken in transit",
      created_by: "dev-user-000",
      created_at: iso(25),
    },
    {
      id: "wo-0005",
      org_id: ORG,
      location_type: "WAREHOUSE",
      location_id: WH_MAIN,
      product_id: P5,
      quantity: 15,
      reason: "EXPIRED",
      notes: "Expired stock rotation",
      created_by: "dev-user-000",
      created_at: iso(5),
    },
  ];

  const audits = [
    {
      id: "a-0001",
      org_id: ORG,
      location_type: "WAREHOUSE",
      location_id: WH_MAIN,
      status: "COMPLETED",
      count_sheet: [
        { product_id: P1, expected: 118, actual: 120 },
        { product_id: P2, expected: 85, actual: 85 },
      ],
      discrepancies: [{ product_id: P1, expected: 118, actual: 120, diff: 2 }],
      created_by: "dev-user-000",
      approved_by: "U Kaung Myat",
      created_at: iso(9),
      completed_at: iso(9),
    },
  ];

  return {
    organizations: [
      { id: ORG, name: "Agni Idea Co., Ltd.", base_currency: "MMK", usd_rate: 4200, preferences: {}, created_at: iso(180) },
      { id: "00000000-0000-0000-0000-000000000002", name: "Isolated Demo Organization", base_currency: "MMK", usd_rate: 4200, preferences: {}, created_at: iso(30) },
    ],
    profiles: [
      { id: "dev-user-000", full_name: "Demo Owner", role: "owner", avatar_url: null, site_id: null, signature: "Demo Owner", created_at: iso(180) },
      { id: "dev-user-manager", full_name: "Demo Manager", role: "manager", avatar_url: null, site_id: null, signature: "Demo Manager", created_at: iso(30) },
      { id: "dev-user-warehouse", full_name: "Warehouse Staff", role: "staff_warehouse", avatar_url: null, site_id: null, signature: "Warehouse Staff", created_at: iso(30) },
      { id: "dev-user-site", full_name: "Dawbon Site Staff", role: "staff_site", avatar_url: null, site_id: SITE_DAWBON, signature: "Dawbon Site Staff", created_at: iso(30) },
      { id: "dev-user-viewer", full_name: "Demo Viewer", role: "viewer", avatar_url: null, site_id: null, signature: null, created_at: iso(30) },
      { id: "dev-user-other-org", full_name: "Other Organization Owner", role: "owner", avatar_url: null, site_id: null, signature: "Other Organization Owner", created_at: iso(30) },
    ],
    user_notifications: [],
    org_users: [
      { id: "membership-owner", org_id: ORG, user_id: "dev-user-000", role: "owner", assigned_locations: [] },
      { id: "membership-manager", org_id: ORG, user_id: "dev-user-manager", role: "manager", assigned_locations: [] },
      { id: "membership-warehouse", org_id: ORG, user_id: "dev-user-warehouse", role: "staff_warehouse", assigned_locations: [WH_MAIN, WH_THILAWA] },
      { id: "membership-site", org_id: ORG, user_id: "dev-user-site", role: "staff_site", assigned_locations: [SITE_DAWBON, WH_MAIN] },
      { id: "membership-viewer", org_id: ORG, user_id: "dev-user-viewer", role: "viewer", assigned_locations: [] },
      { id: "membership-other-org", org_id: "00000000-0000-0000-0000-000000000002", user_id: "dev-user-other-org", role: "owner", assigned_locations: [] },
    ],
    products,
    warehouses,
    sites,
    site_receivers: siteReceivers,
    contacts,
    stock_levels: stockLevels,
    purchase_orders: purchaseOrders,
    po_line_items: poLineItems,
    po_receipts: poReceipts,
    po_attachments: poAttachments,
    dispatches,
    dispatch_line_items: dispatchLineItems,
    site_returns: siteReturns,
    site_return_line_items: siteReturnLineItems,
    stock_transfers: stockTransfers,
    transfer_line_items: transferLineItems,
    supplier_returns: supplierReturns,
    write_offs: writeOffs,
    audits,
    price_history: [
      { id: "ph-0001", product_id: P1, org_id: ORG, cost_mmk: 8500, usd_rate: 4200, recorded_at: iso(45), source: "MANUAL" },
      { id: "ph-0002", product_id: P1, org_id: ORG, cost_mmk: 8500, usd_rate: 4200, recorded_at: iso(7), source: "PO" },
      { id: "ph-0003", product_id: P2, org_id: ORG, cost_mmk: 4100, usd_rate: 4200, recorded_at: iso(7), source: "PO" },
      { id: "ph-0004", product_id: P6, org_id: ORG, cost_mmk: 50500, usd_rate: 4200, recorded_at: iso(2), source: "PO" },
      { id: "ph-0005", product_id: P7, org_id: ORG, cost_mmk: 62000, usd_rate: 4200, recorded_at: iso(62), source: "PO" },
      { id: "ph-0006", product_id: P7, org_id: ORG, cost_mmk: 72000, usd_rate: 4250, recorded_at: iso(10), source: "PO" },
      { id: "ph-0007", product_id: P8, org_id: ORG, cost_mmk: 27000, usd_rate: 4200, recorded_at: iso(42), source: "PO" },
      { id: "ph-0008", product_id: P8, org_id: ORG, cost_mmk: 24000, usd_rate: 4250, recorded_at: iso(12), source: "MANUAL" },
      { id: "ph-0009", product_id: P9, org_id: ORG, cost_mmk: 38500, usd_rate: 4200, recorded_at: iso(62), source: "PO" },
      { id: "ph-0010", product_id: P10, org_id: ORG, cost_mmk: 9500, usd_rate: 4200, recorded_at: iso(62), source: "PO" },
      { id: "ph-0011", product_id: P10, org_id: ORG, cost_mmk: 9200, usd_rate: 4200, recorded_at: iso(20), source: "MANUAL" },
      { id: "ph-0012", product_id: P11, org_id: ORG, cost_mmk: 15500, usd_rate: 4200, recorded_at: iso(42), source: "PO" },
      { id: "ph-0013", product_id: P11, org_id: ORG, cost_mmk: 16800, usd_rate: 4250, recorded_at: iso(10), source: "PO" },
      { id: "ph-0014", product_id: P12, org_id: ORG, cost_mmk: 12800, usd_rate: 4200, recorded_at: iso(42), source: "PO" },
    ],
  };
}

type GlobalWithDemoStore = typeof globalThis & {
  __miniAgniDemoData?: DemoStore;
};

const globalStore = globalThis as GlobalWithDemoStore;
// Dev/Turbopack can load this module more than once (route handlers and server
// actions get separate bundles). Keep one shared store so a write made in an
// action is visible to route handlers without a reload.
globalStore.__miniAgniDemoData ??= seeded();

export const demoData: DemoStore = globalStore.__miniAgniDemoData;

export function resetDemoData(): void {
  const fresh = seeded();
  for (const key of Object.keys(demoData)) delete demoData[key];
  Object.assign(demoData, fresh);
}

export function getTable(name: string): DemoRows {
  const table = demoData[name];
  return table ?? [];
}

export function createSeedStore(): DemoStore {
  return seeded();
}

export function listTables(): string[] {
  return Object.keys(demoData);
}

export function replaceTable(name: string, rows: DemoRows): void {
  demoData[name] = rows;
}

export function getStoreSnapshot(): DemoStore {
  const out: DemoStore = {};
  for (const [name, rows] of Object.entries(demoData)) {
    out[name] = rows.map((r) => ({ ...r }));
  }
  return out;
}