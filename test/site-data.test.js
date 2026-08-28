import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
import {
  assertEntityShards,
  bucketId,
  entityHref,
  getAdj,
  getEntity,
  isMissingShard,
  MissingShardError,
  MISSING_SHARDS_HINT,
  normalizeName,
  parseHash,
  publicText,
  redactPublicFields,
  resetDataCaches,
  searchNames,
  searchPrefix,
} from "../site/js/data.js";

function pythonBucket(entityId) {
  return execFileSync(
    "python3",
    [
      "-c",
      "import sys; from scripts.export_site_data import bucket_id; print(bucket_id(sys.argv[1]), end='')",
      entityId,
    ],
    { encoding: "utf-8", cwd: root },
  );
}

describe("hash-bucket routing", () => {
  it("matches the Python exporter for ASCII and nome: keys", () => {
    const samples = [
      "abc",
      "02916265000160",
      "nome:HOLDINGESTRANGEIRASEMCNPJ",
      "pessoa-provisoria",
    ];
    for (const sample of samples) {
      expect(bucketId(sample)).toBe(pythonBucket(sample));
    }
  });

  it("stays inside three hex chars and 512 buckets", () => {
    const id = bucketId("qualquer-id");
    expect(id).toMatch(/^[0-9a-f]{3}$/);
    expect(parseInt(id, 16)).toBeLessThan(512);
  });
});

describe("name search", () => {
  it("strips accents and punctuation", () => {
    expect(normalizeName("Joesley Mendonça Batista")).toBe(
      "JOESLEYMENDONCABATISTA",
    );
    expect(searchPrefix("Joesley")).toBe("JO");
    expect(searchPrefix("..")).toBe("_");
  });
});

describe("hash routing", () => {
  it("parses kind/id and builds ficha hrefs", () => {
    expect(parseHash("#pessoa/abc%2Fdef")).toEqual({
      kind: "pessoa",
      id: "abc/def",
    });
    expect(entityHref("empresa", "12000000000100")).toBe(
      "pessoa.html#empresa/12000000000100",
    );
  });

  it("defaults a bare hash to pessoa", () => {
    expect(parseHash("#so-o-id")).toEqual({ kind: "pessoa", id: "so-o-id" });
  });
});

describe("CPF redaction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDataCaches();
  });

  it("strips an 11-digit token glued to a QSA name in Python and JS", () => {
    const cleaned = execFileSync(
      "python3",
      [
        "-c",
        "from scripts.export_site_data import public_text; print(public_text('VITOR TESTE 34237325806'), end='')",
      ],
      { encoding: "utf-8", cwd: root },
    );
    expect(cleaned).toBe("VITOR TESTE");
    expect(cleaned).not.toMatch(/\d{11}/);
    expect(publicText("VITOR TESTE 34237325806")).toBe("VITOR TESTE");
    expect(publicText(null)).toBe(null);
  });

  it("redacts public text keys and leaves ids alone", () => {
    const dirty = {
      id: "34237325806",
      nome: "VITOR 34237325806",
      passos: [{ papel: "socio 34237325806", origem_id: "34237325806" }],
    };
    const jsClean = redactPublicFields(dirty);
    expect(jsClean).toEqual({
      id: "34237325806",
      nome: "VITOR",
      passos: [{ papel: "socio", origem_id: "34237325806" }],
    });

    const pyClean = execFileSync(
      "python3",
      [
        "-c",
        "import json,sys; from scripts.export_site_data import redact_public_fields; print(json.dumps(redact_public_fields(json.loads(sys.argv[1])), ensure_ascii=False), end='')",
        JSON.stringify(dirty),
      ],
      { encoding: "utf-8", cwd: root },
    );
    expect(JSON.parse(pyClean)).toEqual(jsClean);
  });

  it("strips CPF when loading a shard through getEntity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            "pessoa:x": { id: "x", kind: "pessoa", nome: "ANA 10987654321" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const entity = await getEntity("pessoa", "x");
    expect(entity.nome).toBe("ANA");
    expect(entity.nome).not.toMatch(/\d{11}/);
  });
});

describe("missing shards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDataCaches();
  });

  function stub404() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
  }

  it("getEntity and getAdj throw MissingShardError on 404", async () => {
    stub404();
    await expect(getEntity("pessoa", "id-sem-shard")).rejects.toBeInstanceOf(
      MissingShardError,
    );
    await expect(getAdj("pessoa", "id-sem-adj")).rejects.toMatchObject({
      name: "MissingShardError",
      message: MISSING_SHARDS_HINT,
    });
    expect(isMissingShard(new MissingShardError("dados/e/000.json"))).toBe(true);
    expect(isMissingShard(new Error("falha"))).toBe(false);
  });

  it("searchNames treats a sparse prefix 404 as empty when e/ shards exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("/busca/")) {
          return new Response("not found", { status: 404 });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    await expect(searchNames("ZZ")).resolves.toEqual([]);
  });

  it("searchNames fails closed when e/ shards are also gone", async () => {
    stub404();
    await expect(searchNames("Joesley")).rejects.toBeInstanceOf(MissingShardError);
    await expect(assertEntityShards()).rejects.toBeInstanceOf(MissingShardError);
  });
});

describe("speed", () => {
  it("filters 5k normalized names in well under 50ms", () => {
    const names = Array.from({ length: 5000 }, (_, i) => `Pessoa Acento ${i} Ç`);
    const start = performance.now();
    const needle = normalizeName("pessoa acento 42");
    const hits = names.filter((name) => normalizeName(name).includes(needle));
    const elapsed = performance.now() - start;
    expect(hits.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});
