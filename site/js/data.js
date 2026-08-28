export const BUCKETS = 512;

export function bucketId(entityId, buckets = BUCKETS) {
  let h = 2166136261;
  for (let i = 0; i < entityId.length; i += 1) {
    h ^= entityId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % buckets).toString(16).padStart(3, "0");
}

export function nodeKey(kind, id) {
  return `${kind}:${id}`;
}

export function parseNodeKey(key) {
  const cut = key.indexOf(":");
  if (cut < 0) return { kind: "pessoa", id: key };
  return { kind: key.slice(0, cut), id: key.slice(cut + 1) };
}

export function normalizeName(name) {
  return (name || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function searchPrefix(name) {
  const key = normalizeName(name);
  if (key.length >= 2) return key.slice(0, 2);
  return key || "_";
}

export function parseHash(hash) {
  const raw = (hash || "").replace(/^#/, "");
  if (!raw) return null;
  const cut = raw.indexOf("/");
  if (cut < 0) {
    return { kind: "pessoa", id: decodeURIComponent(raw) };
  }
  return {
    kind: raw.slice(0, cut),
    id: decodeURIComponent(raw.slice(cut + 1)),
  };
}

export function entityHref(kind, id) {
  return `pessoa.html#${kind}/${encodeURIComponent(id)}`;
}

export function grafoHref(kind, id) {
  return `grafo.html#${kind}/${encodeURIComponent(id)}`;
}

export function formatBrl(value) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export async function loadJson(url) {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`falha ao ler ${url}: ${response.status}`);
  }
  return response.json();
}

const entityCache = new Map();
const adjCache = new Map();
const searchCache = new Map();

export async function getEntity(kind, id) {
  const key = nodeKey(kind, id);
  if (entityCache.has(key)) return entityCache.get(key);
  const shard = await loadJson(`dados/e/${bucketId(id)}.json`);
  if (shard) {
    for (const [entryKey, value] of Object.entries(shard)) {
      entityCache.set(entryKey, value);
    }
  }
  return entityCache.get(key) || null;
}

export async function getAdj(kind, id) {
  const key = nodeKey(kind, id);
  if (adjCache.has(key)) return adjCache.get(key);
  const shard = await loadJson(`dados/adj/${bucketId(id)}.json`);
  if (shard) {
    for (const [entryKey, value] of Object.entries(shard)) {
      adjCache.set(entryKey, value);
    }
  }
  return adjCache.get(key) || [];
}

export async function searchNames(query) {
  const prefix = searchPrefix(query);
  if (!searchCache.has(prefix)) {
    searchCache.set(prefix, loadJson(`dados/busca/${prefix}.json`).then((rows) => rows || []));
  }
  const rows = await searchCache.get(prefix);
  const needle = normalizeName(query);
  if (needle.length < 2) return rows.slice(0, 20);
  return rows.filter((row) => normalizeName(row.nome).includes(needle)).slice(0, 20);
}
