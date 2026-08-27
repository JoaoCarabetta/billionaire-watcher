#!/usr/bin/env node
/**
 * Write public/grafo-quantidades.json from committed CSV + Energisa fixture + B3 prices.
 *
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning metrics/write-listed-quantities.ts
 */

import { writeListedQuantitiesSidecar } from '../src/lib/listed-quantities.ts';

const outPath = writeListedQuantitiesSidecar();
process.stdout.write(`${outPath}\n`);
