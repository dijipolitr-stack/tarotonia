// lib/kv.js
// @vercel/kv-compatible shim backed by the Upstash REST API.
//
// Serverless functions can't reliably hold TCP Redis connections, so we talk
// to Redis over HTTPS via @upstash/redis using the REST credentials Vercel's
// Upstash integration injects (KV_REST_API_URL / KV_REST_API_TOKEN). Exposes
// the same { kv } interface the API routes already use: get / set / scan.

const { Redis } = require('@upstash/redis');

let client;
function getClient() {
  if (!client) {
    const url =
      process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('Upstash REST kimlik bilgileri bulunamadı (KV_REST_API_URL / KV_REST_API_TOKEN)');
    }

    client = new Redis({ url, token });
  }
  return client;
}

const kv = {
  // @upstash/redis auto-deserializes JSON, so objects come back as objects.
  async get(key) {
    return getClient().get(key);
  },

  // Objects are auto-serialized. opts.ex sets a TTL in seconds.
  async set(key, value, opts) {
    if (opts && opts.ex) {
      return getClient().set(key, value, { ex: opts.ex });
    }
    return getClient().set(key, value);
  },

  // Returns [nextCursor (number), keys (string[])], matching @vercel/kv.
  async scan(cursor, { match, count } = {}) {
    const [next, keys] = await getClient().scan(cursor, { match, count });
    return [Number(next), keys];
  }
};

module.exports = { kv };
