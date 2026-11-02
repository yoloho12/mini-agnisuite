export function normalizeSelectedIds(
  selectedIds: Iterable<string>,
  visibleIds: Iterable<string>
): Set<string> {
  const visibleSet = new Set(visibleIds);
  return new Set([...selectedIds].filter((id) => visibleSet.has(id)));
}

export function isAllVisibleSelected(
  selectedIds: Iterable<string>,
  visibleIds: Iterable<string>
): boolean {
  const visible = [...visibleIds];
  if (visible.length === 0) return false;

  const selectedSet = new Set(selectedIds);
  return visible.every((id) => selectedSet.has(id));
}

export function toggleSelectedId(selectedIds: Set<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function setVisibleSelection(
  selectedIds: Set<string>,
  visibleIds: Iterable<string>,
  checked: boolean
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of visibleIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}