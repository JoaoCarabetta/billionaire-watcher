import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const IVAN_ID = 'p-cdbc8c4e';
const ENERGISA_ID = '00864214000106';

function readIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Home is the índice search surface (issue #149)', () => {
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

  it('src/pages/index.astro is the search surface: one search control, empty phrases, tool links, freeze section', () => {
    const page = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'pages', 'index.astro'),
      'utf-8'
    );
    expect(page.match(/<input[^>]*type="search"/g)?.length ?? 0).toBe(1);
    expect(page).toContain('Buscar pessoa ou empresa');
    expect(page).toContain('no grafo apenas');
    expect(page).toContain('não está no arquivo');
    expect(page).toMatch(/href="\/metodologia\/?"/);
    expect(page).toMatch(/href="\/grafo\/?"/);
    expect(page).toContain("PageTools");
    expect(page).toMatch(/<h2[^>]*>Pessoas<\/h2>/);
    expect(page).not.toMatch(/ficha-card|featured-ficha/i);
    expect(page).not.toContain('money_economic');
    expect(page).not.toMatch(/Valor rank|ranking Valor/i);
    expect(page).not.toMatch(/\bUBO\b/i);
    expect(page).not.toMatch(/o bili?on[aá]rio/i);
    expect(page).not.toMatch(/\bdono\b/i);
  });

  it('does not ship src/pages/indice.astro as a second site', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'src', 'pages', 'indice.astro'))).toBe(false);
  });

  it('dist/index.html has one search control, metodologia + grafo tool links, freeze section, honest empty phrases', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const home = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    expect(home.match(/<input[^>]*type="search"/g)?.length ?? 0).toBe(1);
    expect(home).toContain('Buscar pessoa ou empresa');
    expect(home).toContain('no grafo apenas');
    expect(home).toContain('não está no arquivo');
    expect(home).toMatch(/href="\/metodologia\/?"/);
    expect(home).toMatch(/href="\/grafo\/?"/);
    expect(home).toContain('João Silva');
    expect(home).toContain('/pessoa/p1');
    expect(home).toContain('Maria Santos');
    expect(home).toContain('Ana Lima');
    expect(home).toMatch(/<h2[^>]*>Pessoas<\/h2>/);
    expect(home).toMatch(/register-page-tools/);
  });

  it('home HTML has no money_economic, Valor rank, featured-ficha cards, UBO, eleven-digit Cadastro, or o bilionário', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const home = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    expect(home).not.toContain('money_economic');
    expect(home).not.toMatch(/Valor rank|ranking Valor/i);
    expect(home).not.toMatch(/ficha-card|featured-ficha/i);
    expect(home).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
    expect(home).not.toMatch(/o bili?on[aá]rio/i);
    expect(home).not.toContain(`/pessoa/${IVAN_ID}`);
    expect(home).not.toContain(`/empresa/${ENERGISA_ID}`);
    expect(home).not.toContain('/empresa/record');
    const searchBlock = home.slice(
      home.indexOf('id="indice-search"'),
      home.indexOf('id="indice-search-empty"')
    );
    expect(searchBlock).not.toMatch(/\bUBO\b/i);
    expect(searchBlock).not.toMatch(/\bdono\b/i);
  });

  it('/indice/ redirects or aliases to / and is not a second ficha site', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const sitemap = fs.readFileSync(path.join(distPath, 'sitemap.xml'), 'utf-8');
    expect(sitemap).not.toMatch(/<loc>[^<]*\/indice\/?<\/loc>/);

    const indiceHtml = readIfExists(path.join(distPath, 'indice', 'index.html'));
    const redirects = readIfExists(path.join(distPath, '_redirects'));
    const config = fs.readFileSync(path.join(__dirname, '..', 'astro.config.mjs'), 'utf-8');

    const configRedirects = /indice/.test(config);
    const htmlRedirect =
      indiceHtml !== null &&
      (/http-equiv="refresh"/i.test(indiceHtml) ||
        /Redirecting to/.test(indiceHtml) ||
        /href="\/"/i.test(indiceHtml)) &&
      !/Buscar pessoa ou empresa/.test(indiceHtml);
    const fileRedirect = redirects !== null && /\/indice\/?\s+\/\s/.test(redirects);

    expect(
      configRedirects || htmlRedirect || fileRedirect || indiceHtml === null,
      '/indice/ must redirect/alias to / or not exist as a second page'
    ).toBe(true);

    if (indiceHtml) {
      expect(indiceHtml).not.toContain('IVAN MÜLLER BOTELHO');
      expect(indiceHtml).not.toContain('Buscar pessoa ou empresa');
    }
  });

  it('grafo.astro still has no /pessoa/ or /empresa/ links and no hash/query on tap', () => {
    const page = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'pages', 'grafo.astro'),
      'utf-8'
    );
    expect(page).not.toMatch(/\/pessoa\//);
    expect(page).not.toMatch(/\/empresa\//);
    expect(page).not.toMatch(/location\.hash/);
    expect(page).not.toMatch(/history\.(pushState|replaceState)/);
    expect(page).not.toMatch(/searchParams/);
    expect(page).toMatch(/searchGrafoNodes/);
    expect(page).not.toMatch(/classifyIndiceQuery|searchIndice/);
  });
});
