import test from "node:test";
import assert from "node:assert/strict";

const { canAccessLocation, normalizeAssignedLocations } = await import(
  new URL("./locationAccess.ts", import.meta.url).href
);

test("owner and manager can access every location", () => {
  for (const role of ["owner", "manager"] as const) {
    assert.equal(
      canAccessLocation(
        { role, site_id: null, assigned_locations: [] },
        "WAREHOUSE",
        "warehouse-a"
      ),
      true
    );
  }
});

test("limited roles can access only assigned locations and their own site", () => {
  const user = {
    role: "staff_site" as const,
    site_id: "site-primary",
    assigned_locations: ["warehouse-assigned"],
  };

  assert.equal(canAccessLocation(user, "WAREHOUSE", "warehouse-assigned"), true);
  assert.equal(canAccessLocation(user, "SITE", "site-primary"), true);
  assert.equal(canAccessLocation(user, "WAREHOUSE", "warehouse-other"), false);
  assert.equal(canAccessLocation(user, "SITE", "site-other"), false);
  assert.equal(canAccessLocation(null, "SITE", "site-primary"), false);
});

test("assigned locations normalize legacy strings and typed records", () => {
  assert.deepEqual(
    normalizeAssignedLocations([
      "warehouse-a",
      { type: "SITE", id: "site-a" },
      { type: "WAREHOUSE", id: "warehouse-a" },
      { type: "SITE", id: 1 },
      null,
    ]),
    ["warehouse-a", "site-a"]
  );
});
