# Published Facts Loader

This document describes how to build the Astro static site from published Facts on Google Cloud Storage.

## Overview

The site can be built from two sources:
1. **Git fixtures** (default) - for development and testing
2. **Published Facts** - for production builds from `gs://billionairewatcher-landing/publish/facts/latest/`

## Building with Published Facts

### Environment Variables

Set either:
- `PUBLISHED_FACTS_DIR=/path/to/facts` - points to a directory containing published facts JSON/JSONL files
- `USE_PUBLISHED_FACTS=true` - uses the git fixture at `test/fixtures/published-facts.json`

### Example: Production Build

```bash
# Fetch published facts from GCS
gsutil -m cp -r gs://billionairewatcher-landing/publish/facts/latest/ ./published-facts/

# Build the site
PUBLISHED_FACTS_DIR=./published-facts npm run build
```

### Example: Test Build

```bash
# Build with published facts fixture
USE_PUBLISHED_FACTS=true npm run build
```

## Published Facts Contract

The published facts schema (from `transform/models/facts/published_facts.sql`):

```sql
fact_id              string      -- Unique fact identifier
person_id            string      -- Person identifier (aliased from person_name)
fact_kind            string      -- Type of fact (nome, nacionalidade, rf_socio, etc.)
value                string      -- Fact value
source_publisher     string      -- Source publisher name
source_locator       string      -- Source URL
source_retrieved_at  string      -- Retrieval date (ISO format)
cpf_masked           string?     -- Masked CPF (***NNN***)
cnpj_basico          string?     -- CNPJ basic (8 digits)
group_name           string?     -- Company name for control edges
supporting_fact_ids  string[]?   -- Parent fact IDs for derived facts
```

### Freeze List

When using published facts, the freeze list (list of persons with dossiers) is derived from the facts themselves:
- One person per unique `person_id`
- Person name taken from the `nome` fact
- All persons with at least one fact get a dossier

### CPF Masking

CPF values are masked as `***NNN***` (three visible digits) in the published facts.
- Never render 11-digit CPF on any page
- Never render formatted CPF (`123.456.789-00`)
- Only render masked format when present in `cpf_masked` field

### Fact Kinds

Identity facts:
- `nome` - Full name
- `nacionalidade` - Nationality
- `data_nascimento` - Birth date
- `cpf` - CPF (always masked)

Control edge facts:
- `rf_socio` - RF partner edge (Receita Federal company partnership)

Donation facts:
- `donation_personal` - Personal political donation
- `donation_cnpj` - Company political donation

Association facts:
- `association_politician` - Association with politician (via donations)
- `association_freeze_person` - Association with another freeze person

## File Formats

The loader supports:
- `.json` - JSON array or single JSON object
- `.jsonl` - Newline-delimited JSON (one fact per line)

## Sitemap and SEO

The following routes automatically use the published facts freeze list:
- `/sitemap.xml` - Sitemap with all dossier URLs
- `/llms.txt` - LLM-friendly site description
- `/pessoa/{id}/` - HTML dossier page
- `/pessoa/{id}.md` - Markdown mirror of dossier

## Testing

Run tests with published facts:

```bash
# Unit tests for loader
npm test -- test/published-facts-loader.test.ts

# Integration tests for build
npm test -- test/published-facts-build.test.ts

# All tests
npm test
```

## Implementation Notes

### Adapter Layer

The `src/utils/fixtures.ts` file acts as an adapter:
- When `shouldUsePublishedFacts()` returns `true`, it converts published facts to the existing fixture format
- This ensures compatibility with existing Astro components
- No changes needed to `src/pages/` or `src/components/`

### Conversion Functions

- `convertPublishedFactsToIdentityFacts()` - Converts identity fact kinds to `IdentityFact[]`
- `convertPublishedFactsToRFPartnerEdges()` - Converts `rf_socio` facts to `RFPartnerEdge[]`
- `getPublishedFactsFreeze()` - Derives freeze list from published facts

### CNPJ Format

Published facts store `cnpj_basico` (8 digits). The loader reconstructs the full CNPJ format with placeholder suffix `/0001-99` for display purposes.

## Future Work

### Google Cloud Storage Integration

To fetch directly from GCS at build time:

```typescript
// src/utils/published-facts-loader.ts
import { Storage } from '@google-cloud/storage';

async function fetchFromGCS(): Promise<PublishedFact[]> {
  const storage = new Storage();
  const bucket = storage.bucket('billionairewatcher-landing');
  const [files] = await bucket.getFiles({ prefix: 'publish/facts/latest/' });
  
  const facts: PublishedFact[] = [];
  for (const file of files) {
    const [contents] = await file.download();
    const parsed = JSON.parse(contents.toString());
    facts.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  
  return facts;
}
```

This requires:
- Adding `@google-cloud/storage` dependency
- Setting up GCP credentials (service account key or Workload Identity)
- Making `loadPublishedFacts()` async

### Parquet Support

If published facts are stored as Parquet:

```bash
npm install parquetjs
```

```typescript
import { ParquetReader } from 'parquetjs';

async function loadFromParquet(filePath: string): Promise<PublishedFact[]> {
  const reader = await ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();
  const facts: PublishedFact[] = [];
  
  let record = null;
  while (record = await cursor.next()) {
    facts.push(record as PublishedFact);
  }
  
  await reader.close();
  return facts;
}
```
