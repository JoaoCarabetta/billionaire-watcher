# Published Facts Loader

This document describes how to build the Astro static site from published Facts on Google Cloud Storage.

## Overview

The site MUST be built from published Facts for production:
- **Production**: `PUBLISHED_FACTS_DIR` pointing to `gs://billionairewatcher-landing/publish/facts/latest/`
- **Tests**: `USE_PUBLISHED_FACTS=true` uses git fixture at `test/fixtures/published-facts.json`
- **Old fixtures**: `ALLOW_OLD_FIXTURES=true` for legacy tests (not for production)

## Building with Published Facts

### Production Build (Required)

Production builds **require** `PUBLISHED_FACTS_DIR` to point to a non-empty directory containing published facts. The build will fail if:
- `PUBLISHED_FACTS_DIR` is not set
- `PUBLISHED_FACTS_DIR` points to a non-existent directory
- `PUBLISHED_FACTS_DIR` points to an empty directory
- `USE_PUBLISHED_FACTS` is used instead (test-only)

```bash
# Fetch published facts from GCS
gsutil -m cp -r gs://billionairewatcher-landing/publish/facts/latest/ ./published-facts/

# Build the site (will fail if directory is empty)
PUBLISHED_FACTS_DIR=./published-facts npm run build
```

### Test Build

```bash
# Build with published facts fixture (test-only)
USE_PUBLISHED_FACTS=true npm run build
```

**Important**: `USE_PUBLISHED_FACTS` is test-only and will fail in `NODE_ENV=production`.

## Published Facts Contract

The published facts schema (from `transform/models/facts/published_facts.sql`):

```sql
fact_id              string      -- Unique fact identifier
person_id            string      -- Person name (used as identifier)
fact_kind            string      -- One of: identity, control_edge, donation, association
value                string      -- Fact value (raw field for identity, full sentence for others)
source_publisher     string      -- Source publisher name
source_locator       string      -- Source document/URL
source_retrieved_at  string?     -- Retrieval date (ISO format, optional)
cpf_masked           string?     -- Masked CPF (***NNN***) - only when present in source
cnpj_basico          string?     -- CNPJ basic (8 digits)
group_name           string?     -- Company name for control edges
supporting_fact_ids  string[]?   -- Array of fact IDs for associations
```

### The Four Fact Kinds

Published facts use exactly four `fact_kind` values:

#### 1. `identity`
Raw identity fields (name, role, group_name). The `value` is the raw field, not a sentence.

Example:
```json
{
  "fact_id": "identity_12345678_João Silva_name",
  "person_id": "João Silva",
  "fact_kind": "identity",
  "value": "João Silva",
  "source_publisher": "Receita Federal do Brasil",
  "source_locator": "Receita Federal QSA",
  "cpf_masked": "***000***",
  "cnpj_basico": "12345678",
  "group_name": "Empresa XYZ Ltda."
}
```

#### 2. `control_edge`
Pre-written sentences about company control relationships.

Example:
```json
{
  "fact_id": "control_edge_12345678_João Silva_socio",
  "person_id": "João Silva",
  "fact_kind": "control_edge",
  "value": "João Silva é sócio de Empresa XYZ Ltda. (CNPJ 12345678)",
  "source_publisher": "Receita Federal do Brasil",
  "source_locator": "Receita Federal QSA",
  "cnpj_basico": "12345678",
  "group_name": "Empresa XYZ Ltda."
}
```

#### 3. `donation`
Political donation records with full sentence in `value`.

Example:
```json
{
  "fact_id": "donation_recibo-2020-001_João Silva",
  "person_id": "João Silva",
  "fact_kind": "donation",
  "value": "João Silva doou R$ 100000 para Fernanda Almeida em 2020 (recibo recibo-2020-001)",
  "source_publisher": "Tribunal Superior Eleitoral",
  "source_locator": "TSE Receitas Candidato 2020 recibo recibo-2020-001"
}
```

#### 4. `association`
Derived associations between people with supporting fact IDs (array of fact_id strings).

Example:
```json
{
  "fact_id": "association_cross_investment_João Silva_Maria Santos",
  "person_id": "João Silva",
  "fact_kind": "association",
  "value": "Relação entre João Silva e Maria Santos através de investimentos cruzados",
  "source_publisher": "Receita Federal do Brasil",
  "source_locator": "Receita Federal QSA análise consolidada",
  "supporting_fact_ids": ["control_edge_12345678_João Silva_socio", "control_edge_11222333_Maria Santos_socio"]
}
```

### Freeze List

When using published facts, the freeze list is derived from the facts themselves:
- One person per unique `person_id` (person_id IS the person name)
- Only persons with `freeze_status=in` in the SQL model
- All persons in published facts get a dossier

### CPF Masking

Cadastro de Pessoas Físicas (CPF) appears only as `***NNN***` (three visible digits):
- Never render 11-digit CPF on any page
- Never render formatted CPF (`123.456.789-00`)
- Only render masked format when present in `cpf_masked` field of a fact
- Do not invent CPF facts or borrow sources from other facts

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

- `convertPublishedFactsToIdentityFacts()` - Converts `identity` facts to `IdentityFact[]`
- `convertPublishedFactsToRFPartnerEdges()` - Converts `control_edge` facts to `RFPartnerEdge[]`
- `convertPublishedFactsToDonations()` - Converts `donation` facts to `Donation[]`
- `convertPublishedFactsToAssociations()` - Converts `association` facts to `DerivedAssociation[]`
- `getPublishedFactsFreeze()` - Derives freeze list from published facts

### CNPJ Format

Published facts store `cnpj_basico` (8 digits). Use this value as-is. Do not invent CNPJ suffixes.

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
