// lib/kv.js
// Minimal @vercel/kv-compatible shim backed by a standard Redis connection.
// The Vercel Marketplace Redis integration exposes a redis:// connection URL
// (KV_REDIS_URL), not the REST API that @vercel/kv requires — so we talk to
// Redis over TCP via ioredis instead. Exposes the same { kv } interface the
// API routes already use: get / set / scan.

const Redis = require('ioredis');

// Reuse a single connection across warm serverless invocations.
let client;
function getClient() {
  if (!client) {
    const url =
      process.env.KV_REDIS_URL ||
      process.env.REDIS_URL ||
      process.env.KV_URL;

    if (!url) {
      throw new Error('Redis bağlantı adresi bulunamadı (KV_REDIS_URL tanımlı değil)');
    }

    // ioredis enables TLS automatically for the rediss:// scheme and reads
    // auth + host from the URL. We just set sane timeouts so a misconfigured
    // endpoint fails fast instead of hanging the serverless function.
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      enableReadyCheck: true
    });

    client.on('error', (err) => {
      console.error('Redis client error:', err.message);
    });
  }
  return client;
}

const kv = {
  // Returns the parsed value, or null if the key does not exist.
  async get(key) {
    const raw = await getClient().get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  // Stores a value. Objects are JSON-serialized. opts.ex sets a TTL in seconds.
  async set(key, value, opts) {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (opts && opts.ex) {
      return getClient().set(key, str, 'EX', opts.ex);
    }
    return getClient().set(key, str);
  },

  // Mirrors @vercel/kv's scan: returns [nextCursor (number), keys (string[])].
  async scan(cursor, { match, count } = {}) {
    const args = [String(cursor)];
    if (match) args.push('MATCH', match);
    if (count) args.push('COUNT', count);
    const [next, keys] = await getClient().scan(...args);
    return [Number(next), keys];
  }
};

module.exports = { kv };
