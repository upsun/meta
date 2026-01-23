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