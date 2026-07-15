const resourceCache = new Map();

export function getCachedResource(key, loader, options = {}) {
  const { ttlMs = 15000, force = false } = options;
  const now = Date.now();
  const cached = resourceCache.get(key);

  if (!force && cached?.promise) return cached.promise;
  if (!force && cached && cached.expiresAt > now && 'value' in cached) {
    return Promise.resolve(cached.value);
  }

  const promise = Promise.resolve().then(loader);
  resourceCache.set(key, { promise, expiresAt: now + ttlMs });

  return promise.then((value) => {
    resourceCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).catch((error) => {
    if (resourceCache.get(key)?.promise === promise) resourceCache.delete(key);
    throw error;
  });
}

export function invalidateResourceCache(matcher = '') {
  if (!matcher) {
    resourceCache.clear();
    return;
  }
  for (const key of resourceCache.keys()) {
    const matches = typeof matcher === 'function' ? matcher(key) : key.startsWith(matcher);
    if (matches) resourceCache.delete(key);
  }
}

export function getResourceCacheSize() {
  return resourceCache.size;
}
