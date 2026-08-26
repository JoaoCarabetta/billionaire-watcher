import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { withoutJsonLdAndPageTools } from './page-tools-html';

const IVAN_ID = 'p-cdbc8c4e';
const JOAQUIM_ID = 'p-da3e3836';
const EDUARDO_ID = 'p-e1365405';
const MUFFATO_ID = 'p-faf6d605';
const LAST_HOP_SLICE = 0.387;

function pessoaDistPath(distPath: string, id: string): string {
  return path.join(distPath, 'pessoa', id, 'index.html');
}

function containsLiteralOrPtBr(html: string, raw: number): boolean {
  const [whole, cents] = raw.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return html.includes(String(raw)) || html.includes(`${grouped},${cents}`);
}

describe('Built /pessoa/ fichas and sitemap (issue #147)', () => {
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

  it('builds Ivan /pessoa/p-cdbc8c4e/index.html with the cite in view-source', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const htmlPath = pessoaDistPath(distPath, IVAN_ID);
    expect(fs.existsSync(htmlPath), `Ivan ficha should exist at ${htmlPath}`).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toMatch(/IVAN MÜLLER BOTELHO/);
    expect(html).toMatch(/Formul[aá]rio|FRE/);
    expect(html).toMatch(/2025-05-16|16 de maio de 2025/);
    expect(containsLiteralOrPtBr(html, 1300458655.36)).toBe(true);
    expect(containsLiteralOrPtBr(html, 2896272224.98)).toBe(true);
    expect(html).toContain('Não é uma fortuna.');
    const withoutJsonLd = withoutJsonLdAndPageTools(html);
    expect(withoutJsonLd).not.toMatch(/<script/);
    expect(html).not.toContain(String(LAST_HOP_SLICE));
  });

  it('keeps freeze page p1 at 200 under ALLOW_OLD_FIXTURES', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    expect(fs.existsSync(pessoaDistPath(distPath, 'p1'))).toBe(true);
  });

  it('does not build Muffato name slug or p-faf6d605', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    expect(fs.existsSync(pessoaDistPath(distPath, MUFFATO_ID))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, 'EVERTON MUFFATO'))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, 'EVERTON%20MUFFATO'))).toBe(false);
  });

  it('builds Joaquim p-da3e3836 and does not build Eduardo p-e1365405', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    expect(fs.existsSync(pessoaDistPath(distPath, JOAQUIM_ID))).toBe(true);
    expect(fs.existsSync(pessoaDistPath(distPath, EDUARDO_ID))).toBe(false);
  });

  it('does not mint tesouraria, outros, or União as /pessoa/ pages', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    expect(fs.existsSync(pessoaDistPath(distPath, 'tesouraria-00864214'))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, 'outros-00864214'))).toBe(false);
    expect(fs.existsSync(pessoaDistPath(distPath, '00394460000141'))).toBe(false);
  });

  it('sitemap.xml lists freeze locs and minted p-id locs', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const xml = fs.readFileSync(path.join(distPath, 'sitemap.xml'), 'utf-8');
    expect(xml).toMatch(/<loc>[^<]*\/pessoa\/p1\/<\/loc>/);
    expect(xml).toMatch(/<loc>[^<]*\/pessoa\/p-cdbc8c4e\/<\/loc>/);
    expect(xml).toMatch(/<loc>[^<]*\/pessoa\/p-da3e3836\/<\/loc>/);
    expect(xml).not.toMatch(/\/pessoa\/p-faf6d605\//);
    expect(xml).not.toMatch(/\/pessoa\/EVERTON/);
  });

  it('grafo.astro has search, no /pessoa/ links, and no hash/query on tap', () => {
    const pagePath = path.join(__dirname, '..', 'src', 'pages', 'grafo.astro');
    const page = fs.readFileSync(pagePath, 'utf-8');
    expect(page).toContain('grafo-search');
    expect(page).toMatch(/searchGrafoNodes/);
    expect(page).not.toMatch(/\/pessoa\//);
    expect(page).not.toMatch(/ver no grafo/i);
    expect(page).not.toMatch(/ver dossi[eê]/i);
    expect(page).not.toMatch(/location\.hash/);
    expect(page).not.toMatch(/history\.(pushState|replaceState)/);
    expect(page).not.toMatch(/searchParams/);
  });

  it('grafo-panel has no ver no grafo / ver dossiê', () => {
    const helper = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'grafo-panel.ts'), 'utf-8');
    expect(helper).not.toMatch(/ver no grafo/i);
    expect(helper).not.toMatch(/ver dossi[eê]/i);
    expect(helper).not.toMatch(/\/pessoa\//);
  });

  it('new public ficha HTML has zero eleven-digit Cadastro, no UBO, no raw 0.387', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    for (const id of [IVAN_ID, JOAQUIM_ID]) {
      const html = fs.readFileSync(pessoaDistPath(distPath, id), 'utf-8');
      expect(html).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
      expect(html).not.toMatch(/\bUBO\b/i);
      expect(html).not.toContain(String(LAST_HOP_SLICE));
      expect(html).not.toMatch(/ver no grafo/i);
      expect(html).not.toMatch(/ver dossi[eê]/i);
    }
  });

  it('home stays the freeze-elite list and other pages stay without extra script tags', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const home = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    expect(withoutJsonLdAndPageTools(home)).not.toMatch(/<script/);
    expect(home).not.toContain('/pessoa/p-cdbc8c4e');
    expect(home).not.toContain('/pessoa/p-da3e3836');
    expect(
      withoutJsonLdAndPageTools(fs.readFileSync(path.join(distPath, 'metodologia', 'index.html'), 'utf-8'))
    ).not.toMatch(/<script/);
    expect(
      withoutJsonLdAndPageTools(fs.readFileSync(path.join(distPath, 'doacoes', 'index.html'), 'utf-8'))
    ).not.toMatch(/<script/);
  });
});
