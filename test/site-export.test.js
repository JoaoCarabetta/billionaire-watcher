import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
const exportPath = path.join(root, "scripts", "export_site_data.py");
const siteDir = path.join(root, "site");

const CPF_11 = /(?<!\d)\d{11}(?!\d)/;
const FORBIDDEN = /\b(cpf|filiacao|data_nascimento)\b/i;

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

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

function scanPublicText(payload) {
  if (Array.isArray(payload)) return payload.some(scanPublicText);
  if (payload && typeof payload === "object") {
    return Object.entries(payload).some(([key, value]) => {
      if (PUBLIC_TEXT_KEYS.has(key) && typeof value === "string") {
        return CPF_11.test(value);
      }
      return scanPublicText(value);
    });
  }
  return false;
}

describe("export script security", () => {
  it("never selects warehouse-only identity columns", () => {
    const sql = fs.readFileSync(exportPath, "utf8");
    expect(sql).toMatch(/FORBIDDEN_COLUMNS/);
    const queries = [...sql.matchAll(/f"""([\s\S]*?)"""/g)].map((m) => m[1]);
    expect(queries.length).toBeGreaterThan(3);
    for (const query of queries) {
      expect(query).not.toMatch(FORBIDDEN);
    }
  });
});

describe("Cloudflare Pages 404", () => {
  it("keeps a root 404.html with root-relative assets", () => {
    const html = fs.readFileSync(path.join(siteDir, "404.html"), "utf8");
    expect(html).toMatch(/href="\/css\/arquivo\.css"/);
    expect(html).toMatch(/href="\/index\.html"/);
    expect(html).not.toMatch(/href="css\//);
  });

  it("does not use an unsupported /* /404.html 404 rewrite", () => {
    const redirects = fs.readFileSync(path.join(siteDir, "_redirects"), "utf8");
    expect(redirects).toMatch(/404\.html/);
    expect(redirects).toMatch(/Pages/);
    expect(redirects).not.toMatch(/^\s*\/\*\s+\/404\.html\s+404\s*$/m);
  });
});

describe("published site has no CPF", () => {
  it("does not embed 11-digit sequences in HTML, JS, or dados shards", () => {
    const files = walkFiles(siteDir).filter((file) => {
      if (file.includes(`${path.sep}vendor${path.sep}`)) return false;
      if (file.includes(`${path.sep}dados${path.sep}e${path.sep}`)) return false;
      if (file.includes(`${path.sep}dados${path.sep}adj${path.sep}`)) return false;
      if (file.includes(`${path.sep}dados${path.sep}busca${path.sep}`)) return false;
      return /\.(html|js|css|txt|json)$/.test(file);
    });
    expect(files.length).toBeGreaterThan(5);
    const offenders = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (file.endsWith(".json")) {
        const payload = JSON.parse(text);
        if (scanPublicText(payload)) offenders.push(path.relative(root, file));
        continue;
      }
      if (CPF_11.test(text)) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });
});
