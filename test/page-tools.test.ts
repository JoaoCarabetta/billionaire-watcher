import { describe, it, expect, vi, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  bootPageTools,
  getMethodology,
  getPerson,
  PAGE_TOOL_NAMES,
  PAGE_TOOLS_ARCHIVE_ELEMENT_ID,
  searchArchive,
  type PageToolsHost,
} from '../src/lib/archive-tools';
import { buildPageToolsArchive, loadPageToolsArchive } from '../src/lib/page-tools-data';
import { loadPublicGrafo, loadPublicMoney, mintCitedPessoas } from '../src/lib/mint-pessoa';
import { getFreeze, getMethodologyFacts } from '../src/utils/fixtures';
import { pageToolsScriptSrcs, withoutJsonLdAndPageTools } from './page-tools-html';

const IVAN_ID = 'p-cdbc8c4e';
const EDUARDO_ID = 'p-e1365405';
const MUFFATO_ID = 'p-faf6d605';
const LAST_HOP_SLICE = 0.387;
const MONEY_ECONOMIC = 1300458655.36;
const MONEY_CONTROL = 2896272224.98;

function containsLiteralOrPtBr(text: string, raw: number): boolean {
  const [whole, cents] = raw.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return text.includes(String(raw)) || text.includes(`${grouped},${cents}`);
}

function payloadText(value: unknown): string {
  return JSON.stringify(value);
}

function assertNoForbiddenTokens(text: string, label: string): void {
  expect(text, `${label} must not contain eleven-digit Cadastro`).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
  expect(text, `${label} must not contain UBO`).not.toMatch(/\bUBO\b/i);
  expect(text, `${label} must not contain dono`).not.toMatch(/\bdono\b/i);
  expect(text, `${label} must not print 0.387`).not.toContain(String(LAST_HOP_SLICE));
}

describe('Page tools (issue #157) — tool-function seam', () => {
  const grafo = loadPublicGrafo();
  const money = loadPublicMoney();
  const freeze = getFreeze().map((person) => ({
    person_id: person.person_id,
    person_name: person.person_name,
    group_name: person.group_name,
    role: person.role,
  }));
  const archive = buildPageToolsArchive({
    grafo,
    money,
    freeze,
    methodology: getMethodologyFacts(),
  });

  it('uses the committed mint helper — does not invent a second mint', () => {
    const minted = mintCitedPessoas(grafo);
    const fichaIds = new Set(archive.fichas.map((ficha) => ficha.id));
    for (const pessoa of minted) {
      expect(fichaIds.has(pessoa.id), `minted ${pessoa.id} must be a ficha`).toBe(true);
    }
    expect(fichaIds.has(MUFFATO_ID)).toBe(false);
    expect(fichaIds.has(EDUARDO_ID)).toBe(false);
  });

  it('search_archive("Ivan Müller Botelho") and Ivan return ficha /pessoa/p-cdbc8c4e/', () => {
    for (const query of ['Ivan Müller Botelho', 'Ivan']) {
      const result = searchArchive(archive, query);
      expect(result.status).toBe('ficha');
      expect(result.id).toBe(IVAN_ID);
      expect(result.url).toBe('/pessoa/p-cdbc8c4e/');
      expect(result.name).toMatch(/IVAN MÜLLER BOTELHO/);
    }
  });

  it('search_archive("Muffato") is grafo_only, with no ficha URL and no name slug', () => {
    const result = searchArchive(archive, 'Muffato');
    expect(result.status).toBe('grafo_only');
    expect(result.url).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/\/pessoa\//);
    expect(JSON.stringify(result)).not.toMatch(/EVERTON%20MUFFATO|EVERTON MUFFATO\//);
    expect(result.id).toBe(MUFFATO_ID);
  });

  it('search_archive of an unknown name is not_in_archive', () => {
    const result = searchArchive(archive, 'Pessoa Inexistente Zzzyx');
    expect(result).toEqual({ status: 'not_in_archive' });
  });

  it('get_person(p-cdbc8c4e) has Formulário 6.1, both money numbers, 16 May 2025, and not 0.387', () => {
    const result = getPerson(archive, IVAN_ID);
    expect(result.status).toBe('ficha');
    const text = payloadText(result);
    expect(text).toMatch(/Formul[aá]rio 6\.1/);
    expect(containsLiteralOrPtBr(text, MONEY_ECONOMIC)).toBe(true);
    expect(containsLiteralOrPtBr(text, MONEY_CONTROL)).toBe(true);
    expect(text).toMatch(/16 de maio de 2025|16 May 2025|2025-05-16/);
    expect(text).not.toContain(String(LAST_HOP_SLICE));
    if (result.status === 'ficha') {
      expect(result.note).toBe('Não é uma fortuna.');
      expect(result.money_economic).not.toBe('Não é uma fortuna.');
      expect(result.money_control).not.toBe('Não é uma fortuna.');
      expect(result.url).toBe('/pessoa/p-cdbc8c4e/');
    }
  });

  it('get_person for Eduardo and Muffato is grafo_only', () => {
    expect(getPerson(archive, EDUARDO_ID)).toEqual({ status: 'grafo_only' });
    expect(getPerson(archive, MUFFATO_ID)).toEqual({ status: 'grafo_only' });
  });

  it('search and get_person payloads have no eleven-digit Cadastro, UBO, or dono', () => {
    const payloads = [
      searchArchive(archive, 'Ivan Müller Botelho'),
      searchArchive(archive, 'Muffato'),
      searchArchive(archive, 'Pessoa Inexistente Zzzyx'),
      getPerson(archive, IVAN_ID),
      getPerson(archive, EDUARDO_ID),
      getPerson(archive, MUFFATO_ID),
      getPerson(archive, 'p1'),
    ];
    for (const payload of payloads) {
      assertNoForbiddenTokens(payloadText(payload), JSON.stringify(payload));
    }
  });

  it('get_methodology returns public methods facts already on /metodologia/', () => {
    const result = getMethodology(archive);
    expect(result.url).toBe('/metodologia/');
    expect(result.facts.length).toBeGreaterThan(0);
    const text = payloadText(result);
    expect(text).toMatch(/Valor 1000/);
    expect(text).toMatch(/6\.404|Art\. 116/);
    expect(text).toMatch(/Formul[aá]rio de Referência|FRE/);
    expect(text).not.toMatch(/\/empresa\//);
    expect(text).not.toMatch(/\bUBO\b/i);
    expect(text).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
    expect(text).not.toContain(String(LAST_HOP_SLICE));
  });

  it('money fields exist only when money_economic / money_control exist', () => {
    const joaquim = archive.fichas.find((ficha) => ficha.id === 'p-da3e3836');
    expect(joaquim).toBeDefined();
    expect(joaquim!.money_economic).toBeUndefined();
    expect(joaquim!.money_control).toBeUndefined();
    const person = getPerson(archive, 'p-da3e3836');
    if (person.status === 'ficha') {
      expect(person.money_economic).toBeUndefined();
      expect(person.money_control).toBeUndefined();
    }
  });

  it('bootPageTools no-ops when document.modelContext is missing (no banner, no console)', () => {
    const registerTool = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    bootPageTools({});
    bootPageTools({ modelContext: undefined });
    expect(registerTool).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();

    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
    info.mockRestore();
    debug.mockRestore();
  });

  it('bootPageTools registers three read-only tools when modelContext exists', () => {
    const registerTool = vi.fn();
    const host: PageToolsHost = {
      modelContext: { registerTool },
      getElementById: () => ({ textContent: JSON.stringify(archive) }),
    };
    bootPageTools(host);
    expect(registerTool).toHaveBeenCalledTimes(3);
    const names = registerTool.mock.calls.map((call) => call[0].name);
    expect(names).toEqual([...PAGE_TOOL_NAMES]);
    for (const call of registerTool.mock.calls) {
      const tool = call[0];
      expect(tool.name).toMatch(/^[a-z0-9_.-]{1,128}$/);
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it('public/register-page-tools.js no-ops without modelContext and registers from the archive payload', async () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'register-page-tools.js'),
      'utf-8'
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(document, 'modelContext', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const run = new Function(src);
    run();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      value: { registerTool },
      configurable: true,
      writable: true,
    });
    let payload = document.getElementById(PAGE_TOOLS_ARCHIVE_ELEMENT_ID);
    if (!payload) {
      payload = document.createElement('script');
      payload.id = PAGE_TOOLS_ARCHIVE_ELEMENT_ID;
      payload.setAttribute('type', 'application/json');
      document.body.appendChild(payload);
    }
    payload.textContent = JSON.stringify(archive);
    run();

    expect(registerTool).toHaveBeenCalledTimes(3);
    const byName = Object.fromEntries(
      registerTool.mock.calls.map((call) => [call[0].name, call[0]])
    );
    expect(byName.search_archive.annotations.readOnlyHint).toBe(true);
    expect(byName.get_person.annotations.readOnlyHint).toBe(true);
    expect(byName.get_methodology.annotations.readOnlyHint).toBe(true);
    expect(await byName.search_archive.execute({ query: 'Ivan' })).toMatchObject({
      status: 'ficha',
      url: '/pessoa/p-cdbc8c4e/',
    });
    expect(await byName.search_archive.execute({ query: 'Muffato' })).toMatchObject({
      status: 'grafo_only',
    });
    expect((await byName.get_person.execute({ id: IVAN_ID })).source).toMatch(/Formul[aá]rio 6\.1/);
    expect(await byName.get_person.execute({ id: MUFFATO_ID })).toEqual({ status: 'grafo_only' });
    expect((await byName.get_methodology.execute({})).url).toBe('/metodologia/');

    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('Built pages include the registrar (issue #157)', () => {
  const ROOT = path.join(__dirname, '..');
  let distPath: string;
  let buildFailed = false;
  let buildError = '';

  beforeAll(() => {
    try {
      execSync('npm run build', {
        cwd: ROOT,
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
    distPath = path.join(ROOT, 'dist');
  });

  const publishedPages = [
    'index.html',
    path.join('metodologia', 'index.html'),
    path.join('doacoes', 'index.html'),
    path.join('grafo', 'index.html'),
    path.join('pessoa', 'p1', 'index.html'),
    path.join('pessoa', IVAN_ID, 'index.html'),
    '404.html',
  ];

  it('includes the registrar script on published pages without inlining the archive', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    for (const rel of publishedPages) {
      const htmlPath = path.join(distPath, rel);
      expect(fs.existsSync(htmlPath), htmlPath).toBe(true);
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html, rel).toContain('/register-page-tools.js');
      expect(html, rel).not.toContain(`id="${PAGE_TOOLS_ARCHIVE_ELEMENT_ID}"`);
      const srcs = pageToolsScriptSrcs(html);
      expect(srcs.length, `${rel} should load register-page-tools.js`).toBeGreaterThan(0);
    }
  });

  it('built registrar contains the modelContext guard and three tool names', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const registrarPath = path.join(distPath, 'register-page-tools.js');
    expect(fs.existsSync(registrarPath)).toBe(true);
    const bundled = fs.readFileSync(registrarPath, 'utf-8');
    expect(bundled).toMatch(/modelContext/);
    expect(bundled).toContain('search_archive');
    expect(bundled).toContain('get_person');
    expect(bundled).toContain('get_methodology');
    expect(bundled).toMatch(/readOnlyHint/);
    expect(bundled).toMatch(/if\s*\(\s*!document\.modelContext\s*\)/);
  });

  it('built tools archive JSON has Ivan money, no eleven-digit Cadastro, no UBO, no raw 0.387', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const archivePath = path.join(distPath, 'page-tools-archive.json');
    expect(fs.existsSync(archivePath)).toBe(true);
    const archiveText = fs.readFileSync(archivePath, 'utf-8');
    expect(archiveText).toContain(IVAN_ID);
    expect(archiveText).toMatch(/Formul[aá]rio 6\.1/);
    expect(archiveText).not.toMatch(/(?<!\d)\d{11}(?!\d)/);
    expect(archiveText).not.toMatch(/\bUBO\b/i);
    expect(archiveText).not.toContain(String(LAST_HOP_SLICE));
    expect(archiveText).not.toMatch(/\/empresa\//);
    const ivanHtml = fs.readFileSync(path.join(distPath, 'pessoa', IVAN_ID, 'index.html'), 'utf-8');
    expect(ivanHtml).toContain('/register-page-tools.js');
    expect(ivanHtml).not.toContain('/empresa/');
  });

  it('does not add graph hash/query or /empresa/ routes', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const grafoSrc = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'grafo.astro'), 'utf-8');
    expect(grafoSrc).not.toMatch(/location\.hash/);
    expect(grafoSrc).not.toMatch(/history\.(pushState|replaceState)/);
    expect(grafoSrc).not.toMatch(/searchParams/);
    expect(fs.existsSync(path.join(distPath, 'empresa'))).toBe(false);
    const llms = fs.readFileSync(path.join(distPath, 'llms.txt'), 'utf-8');
    expect(llms).toMatch(/\/metodologia\//);
    expect(llms).toMatch(/\/grafo\//);
    expect(llms).not.toMatch(/\/empresa\//);
  });

  it('home keeps freeze-elite list and does not grow cytoscape', () => {
    if (buildFailed) throw new Error(`Build failed: ${buildError}`);
    const home = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    expect(home).not.toContain('/pessoa/p-cdbc8c4e');
    expect(home).not.toMatch(/cytoscape/i);
    const leftover = withoutJsonLdAndPageTools(home);
    expect(leftover).not.toMatch(/<script/);
  });

  it('loadPageToolsArchive matches the mint helper on this checkout', () => {
    const loaded = loadPageToolsArchive();
    expect(loaded.fichas.some((ficha) => ficha.id === IVAN_ID)).toBe(true);
    expect(loaded.fichas.some((ficha) => ficha.id === MUFFATO_ID)).toBe(false);
  });
});
