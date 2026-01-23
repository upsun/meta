export function withSelfLink<T extends Record<string, any>>(items: T, buildHref: (id: string) => string) {
  return Object.fromEntries(
    Object.entries(items).map(([id, payload]) => [
      id,
      {
        ...payload,
        _links: { self: buildHref(id) }
      }
    ])
  );
}

export function withSelfLinkArray<T extends { id: string }>(items: T[], buildHref: (id: string, item: T) => string) {
  return items.map((item) => ({
    ...item,
    _links: { self: buildHref(item.id, item) }
  }));
}