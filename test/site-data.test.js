import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
import {
  bucketId,
  entityHref,
  normalizeName,
  parseHash,
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

describe("CPF redaction in export", () => {
  it("strips an 11-digit token glued to a QSA name", () => {
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
