const cache = new Map()
const TTL = 30 * 1000

function get(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function set(key, data) {
  cache.set(key, { data, expires: Date.now() + TTL })
}

function invalidate(key) {
  cache.delete(key)
}

function invalidateAll() {
  cache.clear()
}

function invalidateTab(tabName) {
  for (const key of cache.keys()) {
    if (key.startsWith(tabName + ':')) cache.delete(key)
  }
}

module.exports = { get, set, invalidate, invalidateAll, invalidateTab }
