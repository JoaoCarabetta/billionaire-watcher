import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getPublishedGraphCounts } from '../src/utils/published-graph-counts';

const ROOT = path.join(__dirname, '..');
const LIVE_GRAPH_PATH = path.join(ROOT, 'public', 'grafo-publico.json');
const LLMS_SRC_PATH = path.join(ROOT, 'src', 'pages', 'llms.txt.ts');

function loadLiveGraphSize(): { nodeCount: number; edgeCount: number } {
  const graph = JSON.parse(fs.readFileSync(LIVE_GRAPH_PATH, 'utf-8')) as {
    nodes: unknown[];
    edges: unknown[];
  };
  return { nodeCount: graph.nodes.length, edgeCount: graph.edges.length };
}

describe('Published graph counts helper (issue #151)', () => {
  it('reads node and edge counts from a graph file, not a frozen size', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-graph-counts-'));
    const tmpPath = path.join(tmpDir, 'grafo.json');
    fs.writeFileSync(
      tmpPath,
      JSON.stringify({
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        edges: [{ from: 'a', to: 'b' }],
      })
    );

    try {
      expect(getPublishedGraphCounts(tmpPath)).toEqual({
        nodeCount: 3,
        edgeCount: 1,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('matches public/grafo-publico.json length on this checkout', () => {
    const live = loadLiveGraphSize();
    expect(getPublishedGraphCounts(LIVE_GRAPH_PATH)).toEqual(live);
    expect(live.nodeCount).not.toBe(89);
    expect(live.edgeCount).not.toBe(44);
    expect(live.nodeCount).toBeGreaterThan(100);
    expect(live.edgeCount).toBeGreaterThan(100);
  });
});

describe('Built /llms.txt graph size (issue #151)', () => {
  let distPath: string;
  let buildFailed = false;
  let buildError = '';
  let content = '';

  beforeAll(() => {
    distPath = path.join(ROOT, 'dist');

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

    const llmsPath = path.join(distPath, 'llms.txt');
    if (fs.existsSync(llmsPath)) {
      content = fs.readFileSync(llmsPath, 'utf-8');
    }
  });

  it('builds llms.txt', () => {
    if (buildFailed) {
      throw new Error(`Build failed: ${buildError}`);
    }
    expect(fs.existsSync(path.join(distPath, 'llms.txt'))).toBe(true);
    expect(content.length).toBeGreaterThan(0);
  });

  it('does not hardcode graph size in src/pages/llms.txt.ts', () => {
    const src = fs.readFileSync(LLMS_SRC_PATH, 'utf-8');
    expect(src).not.toMatch(/\d+\s+nós/);
    expect(src).not.toMatch(/\d+\s+arestas/);
  });

  it('does not claim 89 nodes or 44 edges as the graph size', () => {
    if (buildFailed) {
      throw new Error(`Build failed: ${buildError}`);
    }

    const graphSize = content.match(/(\d+)\s+nós,\s+(\d+)\s+arestas/);
    expect(graphSize, 'llms.txt must state graph size as N nós, M arestas').toBeTruthy();
    expect(Number(graphSize![1])).not.toBe(89);
    expect(Number(graphSize![2])).not.toBe(44);
    expect(content).not.toMatch(/(?<!\d)89\s+nós/);
    expect(content).not.toMatch(/(?<!\d)44\s+arestas/);
  });

  it('contains the live node and edge counts from grafo-publico.json', () => {
    if (buildFailed) {
      throw new Error(`Build failed: ${buildError}`);
    }

    const live = loadLiveGraphSize();
    expect(content).toContain(`${live.nodeCount} nós`);
    expect(content).toContain(`${live.edgeCount} arestas`);
  });

  it('still lists /metodologia/ and /grafo/', () => {
    if (buildFailed) {
      throw new Error(`Build failed: ${buildError}`);
    }

    expect(content).toMatch(/\/metodologia\//);
    expect(content).toMatch(/\/grafo\//);
  });

  it('keeps existing listed paths; /empresa/ fichas come from #148, not llms.txt', () => {
    if (buildFailed) {
      throw new Error(`Build failed: ${buildError}`);
    }

    expect(content).toMatch(/\/doacoes\//);
    expect(content).toMatch(/\/pessoa\//);
    expect(content).toMatch(/grafo-publico\.json/);
    expect(content).not.toMatch(/\/empresa\//);
    expect(fs.existsSync(path.join(distPath, 'empresa', '00864214000106', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(distPath, 'empresa', 'record', 'index.html'))).toBe(true);
  });

  it('has no freeze jargon, UBO, o bilionário, or eleven-digit Cadastro', () => {
    if (buildFailed) {
      throw new Error(`Build failed: ${buildError}`);
    }

    expect(content).not.toMatch(/\bfreeze\b/i);
    expect(content).not.toMatch(/\bUBO\b/);
    expect(content).not.toMatch(/o bilionário/i);
    expect(content).not.toMatch(/\d{11}/);
  });
});
