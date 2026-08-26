import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { LISTED_COMPANY_IDS } from '../src/lib/grafo-panel';
import { withoutJsonLdAndPageTools } from './page-tools-html';

const ENERGISA_ID = '00864214000106';
const GIPAR_ID = '02260956000158';
const RECORD_ID = 'record';
const ALASKA_ID = '11752203000150';
const DYNAMO_ID = '72116353000162';
const NOVA_FUTURA_ID = '41020034000125';
const UNIAO_ID = '00394460000141';
const TESOURARIA_ENERGISA_ID = 'tesouraria-00864214';
const OUTROS_ENERGISA_ID = 'outros-00864214';
const MUFFATO_ID = 'p-faf6d605';
const LAST_HOP_SLICE = 0.387;

function empresaDistPath(distPath: string, id: string): string {
  return path.join(distPath, 'empresa', id, 'index.html');
}

function pessoaDistPath(distPath: string, id: string): string {
  return path.join(distPath, 'pessoa', id, 'index.html');
}

describe('Built /empresa/ fichas and sitemap (issue #148)', () => {
  let distPath: string;
  let buildFailed = false;
  let buildError = '';

  beforeAll(() => {
    try {
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          ALLOW_OLD_FIXTURES: 'true',
        },
      });
    } catch (error: unknown) {
      buildFailed = true;
      buildError = error instanceof Error ? error.message : String(error);
    }
    distPath = path.join(__dirname, '..', 'dist');
  });

  it('builds /empresa/00864214000106/index.html with ENERGISA, fourteen-digit id, type, view-source cite', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const htmlPath = empresaDistPath(distPath, ENERGISA_ID);
    expect(fs.existsSync(htmlPath), `Energisa ficha should exist at ${htmlPath}`).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toMatch(/ENERGISA/);
    expect(html).toContain(ENERGISA_ID);
    expect(html).toMatch(/companhia aberta|semente listada|listada/i);
    expect(html).toMatch(/Gipar/i);
    expect(html).not.toContain(String(LAST_HOP_SLICE));
    const withoutJsonLd = html.replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/g, '');
    expect(withoutJsonLd).not.toMatch(/<script/);
  });

  it('builds /empresa/record/index.html with visible hole; Quadro de Sócios does not name shareholders; no diretor person', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const htmlPath = empresaDistPath(distPath, RECORD_ID);
    expect(fs.existsSync(htmlPath), `Record ficha should exist at ${htmlPath}`).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toMatch(/Record/i);
    expect(html).toMatch(/lacuna vis[ií]vel/i);
    expect(html).toMatch(/Quadro de S[oó]cios/);
    expect(html).toMatch(/n[aã]o nomeia acionistas/i);
    expect(html).not.toMatch(/Edir Macedo/i);
    expect(fs.existsSync(pessoaDistPath(distPath, 'edir-macedo'))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, 'EDIR MACEDO'))).toBe(false);
  });

  it('does not build globo, Dexco, Votorantim, tesouraria/outros/Uniao/Nova Futura/Alaska/Dynamo, or Gipar', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    expect(fs.existsSync(empresaDistPath(distPath, 'globo'))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, 'Globo'))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, 'dexco'))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, 'Dexco'))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, 'votorantim'))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, 'Votorantim'))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, TESOURARIA_ENERGISA_ID))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, OUTROS_ENERGISA_ID))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, UNIAO_ID))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, NOVA_FUTURA_ID))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, ALASKA_ID))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, DYNAMO_ID))).toBe(false);
    expect(fs.existsSync(empresaDistPath(distPath, GIPAR_ID))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, MUFFATO_ID))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, 'EVERTON MUFFATO'))).toBe(false);
  });

  it('does not nest Dexco under Votorantim and does not label a Dexco page as Votorantim', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    expect(fs.existsSync(path.join(distPath, 'empresa', 'votorantim', 'dexco', 'index.html'))).toBe(false);
    const empresaRoot = path.join(distPath, 'empresa');
    if (fs.existsSync(empresaRoot)) {
      for (const entry of fs.readdirSync(empresaRoot)) {
        const htmlPath = path.join(empresaRoot, entry, 'index.html');
        if (!fs.existsSync(htmlPath)) continue;
        if (!/dexco/i.test(entry)) continue;
        const html = fs.readFileSync(htmlPath, 'utf-8');
        expect(html, 'Dexco must not be filed as Votorantim').not.toMatch(/Votorantim/i);
      }
    }
  });

  it('sitemap.xml lists listed /empresa/{14digit}/ and /empresa/record/', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const xml = fs.readFileSync(path.join(distPath, 'sitemap.xml'), 'utf-8');
    for (const id of LISTED_COMPANY_IDS) {
      expect(xml).toMatch(new RegExp(`<loc>[^<]*/empresa/${id}/</loc>`));
    }
    expect(xml).toMatch(/<loc>[^<]*\/empresa\/record\/<\/loc>/);
    expect(xml).not.toMatch(/\/empresa\/globo\//);
    expect(xml).not.toMatch(/\/empresa\/02260956000158\//);
    expect(xml).not.toMatch(/\/empresa\/dexco\//);
    expect(xml).not.toMatch(/\/empresa\/votorantim\//);
  });

  it('grafo.astro has no /empresa/ links, no /pessoa/ links added, and no hash/query on tap', () => {
    const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
    const page = fs.readFileSync(pagePath, 'utf-8');
    expect(page).toContain('grafo-search');
    expect(page).toMatch(/searchGrafoNodes/);
    expect(page).not.toMatch(/\/empresa\//);
    expect(page).not.toMatch(/\/pessoa\//);
    expect(page).not.toMatch(/ver no grafo/i);
    expect(page).not.toMatch(/ver dossi[eê]/i);
    expect(page).not.toMatch(/location\.hash/);
    expect(page).not.toMatch(/history\.(pushState|replaceState)/);
    expect(page).not.toMatch(/searchParams/);
  });

  it('company HTML has no money_economic, no R$, no /grafo/, no /pessoa/, no UBO, no eleven-digit Cadastro', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    for (const id of [ENERGISA_ID, RECORD_ID]) {
      const html = fs.readFileSync(empresaDistPath(distPath, id), 'utf-8');
      expect(html).not.toContain('money_economic');
      expect(html).not.toMatch(/R\$/);
      expect(html).not.toMatch(/\/grafo\//);
      expect(html).not.toMatch(/\/pessoa\//);
      expect(html).not.toMatch(/\bUBO\b/i);
      expect(html).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(html).not.toContain(String(LAST_HOP_SLICE));
    }
  });

  it('home stays the freeze-elite list and other pages stay without extra script tags', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const home = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    expect(home).toContain('/pessoa/p1');
    expect(home).not.toContain('/empresa/00864214000106');
    expect(home).not.toContain('/empresa/record');
    expect(
      withoutJsonLdAndPageTools(fs.readFileSync(path.join(distPath, 'metodologia', 'index.html'), 'utf-8'))
    ).not.toMatch(/<script/);
    expect(
      withoutJsonLdAndPageTools(fs.readFileSync(path.join(distPath, 'doacoes', 'index.html'), 'utf-8'))
    ).not.toMatch(/<script/);
  });
});
