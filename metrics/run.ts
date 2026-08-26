#!/usr/bin/env node
/**
 * Run civic ownership-graph relevance metrics.
 *
 *   npm run metrics -- public/grafo-publico.json
 *   npm run metrics -- public/grafo-publico.json --json
 */

import { computeMetrics, formatReport, loadGraphFile, outputContainsCpf } from './compute.ts';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const fileArg = args.find((arg) => !arg.startsWith('-')) ?? 'public/grafo-publico.json';

if (args.includes('--wealth') || args.includes('--rank-rich') || args.includes('--fortuna')) {
  process.stderr.write(
    'REFUSED: this archive cannot rank wealth, fortuna, or who is richest. Run without those flags.\n'
  );
  process.exit(2);
}

const graph = loadGraphFile(fileArg);
const result = computeMetrics(graph);
const text = jsonMode ? JSON.stringify(result, null, 2) : formatReport(result);

if (outputContainsCpf(text)) {
  throw new Error('refusing to print Cadastro de Pessoas Físicas');
}

process.stdout.write(text.endsWith('\n') ? text : text + '\n');
