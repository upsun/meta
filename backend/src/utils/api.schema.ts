export function withSelfLink<T extends Record<string, any>>(
  items: T,
  buildHref: (id: string) => string,
  options?: { targetKey?: string }
): T {
  const applyLinks = (target: Record<string, any>) =>
    Object.fromEntries(
      Object.entries(target).map(([id, payload]) => [
        id,
        {
          ...payload,
          _links: { self: buildHref(id) }
        }
      ])
    );

  const result: Record<string, any> = {};

  for (const [id, payload] of Object.entries(items)) {
    if (options?.targetKey && payload[options.targetKey] && typeof payload[options.targetKey] === 'object') {
      result[id] = {
        ...payload,
        [options.targetKey]: applyLinks(payload[options.targetKey])
      };
    } else {
      result[id] = {
        ...payload,
        _links: { self: buildHref(id) }
      };
    }
  }

  return result as T;
}

export function withSelfLinkArray<T extends { id: string }>(items: T[], buildHref: (id: string, item: T) => string) {
  return items.map((item) => ({
    ...item,
    _links: { self: buildHref(item.id, item) }
  }));
}
