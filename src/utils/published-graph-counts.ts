/**
 * Live public graph size for machine-readable copy (/llms.txt).
 * Counts come from public/grafo-publico.json at build time so a later
 * publish cannot leave stale node/edge numbers in the text.
 */

import fs from 'node:fs';
import path from 'node:path';

export type PublishedGraphCounts = {
  nodeCount: number;
  edgeCount: number;
};

const DEFAULT_GRAPH_PATH = path.join(process.cwd(), 'public', 'grafo-publico.json');

export function getPublishedGraphCounts(
  graphPath: string = DEFAULT_GRAPH_PATH
): PublishedGraphCounts {
  const parsed = JSON.parse(fs.readFileSync(graphPath, 'utf-8')) as {
    nodes?: unknown;
    edges?: unknown;
  };

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`${graphPath} must have nodes and edges arrays`);
  }

  return {
    nodeCount: parsed.nodes.length,
    edgeCount: parsed.edges.length,
  };
}
