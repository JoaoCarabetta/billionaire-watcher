export const BUCKETS = 512;

export const MISSING_SHARDS_HINT =
  "Dados de ficha e grafo ausentes neste clone. Rode python3 scripts/export_site_data.py e recarregue.";

const CPF_11 = /(?<!\d)\d{11}(?!\d)/g;
const PUBLIC_TEXT_KEYS = new Set([
  "nome",
  "origem_nome",
  "destino_nome",
  "semente_nome",
  "fonte_documento",
  "fonte_do_piso",
  "papel",
  "fonte",
  "regra_do_passo",
  "motivo_entrada",
]);

export class MissingShardError extends Error {
  constructor(url) {
    super(MISSING_SHARDS_HINT);
    this.name = "MissingShardError";
    this.url = url;
  }
}

export function isMissingShard(error) {
  return Boolean(error) && error.name === "MissingShardError";
}

export function missingShardsHtml() {
  return `<p class="empty">Dados de ficha e grafo ausentes neste clone. Rode <code>python3 scripts/export_site_data.py</code> e recarregue.</p>`;
}

export function publicText(value) {
  if (value == null) return value;
  return String(value).replace(CPF_11, "").replace(/\s+/g, " ").trim();
}

export function redactPublicFields(payload) {
  if (Array.isArray(payload)) return payload.map(redactPublicFields);
  if (payload && typeof payload === "object") {
    const out = {};
    for (const [key, value] of Object.entries(payload)) {
      out[key] =
        PUBLIC_TEXT_KEYS.has(key) && typeof value === "string"
          ? publicText(value)
          : redactPublicFields(value);
    }
    return out;
  }
  return payload;
}

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
  return redactPublicFields(await response.json());
}

async function loadRequiredJson(url) {
  const data = await loadJson(url);
  if (data == null) throw new MissingShardError(url);
  return data;
}

const entityCache = new Map();
const adjCache = new Map();
const searchCache = new Map();
let entityShardsPresent;

export function resetDataCaches() {
  entityCache.clear();
  adjCache.clear();
  searchCache.clear();
  entityShardsPresent = undefined;
}

export async function assertEntityShards() {
  if (entityShardsPresent === true) return;
  if (entityShardsPresent === false) {
    throw new MissingShardError("dados/e/");
  }
  const probe = `dados/e/${bucketId("0")}.json`;
  const shard = await loadJson(probe);
  if (shard == null) {
    entityShardsPresent = false;
    throw new MissingShardError(probe);
  }
  entityShardsPresent = true;
}

export async function getEntity(kind, id) {
  const key = nodeKey(kind, id);
  if (entityCache.has(key)) return entityCache.get(key);
  const shard = await loadRequiredJson(`dados/e/${bucketId(id)}.json`);
  for (const [entryKey, value] of Object.entries(shard)) {
    entityCache.set(entryKey, value);
  }
  return entityCache.get(key) || null;
}

export async function getAdj(kind, id) {
  const key = nodeKey(kind, id);
  if (adjCache.has(key)) return adjCache.get(key);
  const shard = await loadRequiredJson(`dados/adj/${bucketId(id)}.json`);
  for (const [entryKey, value] of Object.entries(shard)) {
    adjCache.set(entryKey, value);
  }
  return adjCache.get(key) || [];
}

export async function searchNames(query) {
  const prefix = searchPrefix(query);
  if (!searchCache.has(prefix)) {
    searchCache.set(
      prefix,
      loadJson(`dados/busca/${prefix}.json`).then(async (rows) => {
        if (rows == null) {
          // busca/ files are sparse by prefix; only fail if e/ shards are gone.
          await assertEntityShards();
          return [];
        }
        return rows;
      }),
    );
  }
  const rows = await searchCache.get(prefix);
  const needle = normalizeName(query);
  if (needle.length < 2) return rows.slice(0, 20);
  return rows.filter((row) => normalizeName(row.nome).includes(needle)).slice(0, 20);
}
