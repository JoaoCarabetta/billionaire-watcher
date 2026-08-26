#!/usr/bin/env node
/**
 * Run dinheiro sob controle (capital and votes).
 *
 *   npm run money -- public/grafo-publico.json
 *   npm run money -- public/grafo-publico.json --json
 *   npm run money -- public/grafo-publico.json --date 2025-05-16
 */

import {
  assertSafeMoneyOutput,
  computeMoneyUnderControl,
  formatMoneyReport,
  loadGraphFile,
} from './money.ts';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const positional = args.filter((arg) => !arg.startsWith('-'));
const fileArg = positional[0] ?? 'public/grafo-publico.json';

function flagValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return args[index + 1];
}

if (
  args.includes('--wealth') ||
  args.includes('--rank-rich') ||
  args.includes('--rank-people')
) {
  process.stderr.write('Wealth REFUSED. This archive does not rank people. Run without those flags.\n');
  process.exit(2);
}

const graph = loadGraphFile(fileArg);
const result = computeMoneyUnderControl(graph, {
  pricesPath: flagValue('--prices'),
  qtyPath: flagValue('--qty'),
  date: flagValue('--date'),
  allDates: args.includes('--all-dates'),
});
const report = formatMoneyReport(result);
assertSafeMoneyOutput(report);
const text = jsonMode ? JSON.stringify(result, null, 2) : report;
process.stdout.write(text.endsWith('\n') ? text : text + '\n');
