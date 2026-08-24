# ADR-0004: Presentation (Astro)

## Status

Accepted

## Date

2026-08-24

## Context

The billionaire-watcher project publishes dossiers as **static HTML**. The HTML must:
- Be generated from structured Facts (JSONL), not manually authored Markdown
- Display visible citations for every claim, tracing back to public sources
- Be fast, accessible, and indexable by search engines
- Support multiple output formats: HTML, JSON-LD, Markdown, and machine-readable indexes

Static site generators (SSGs) vary in flexibility, developer experience, and ecosystem support. Key considerations:
- **Output mode**: Static (`output: 'static'`) vs. hybrid/server-rendered
- **Interactivity**: Zero JavaScript by default vs. islands/hydration
- **Citations**: How to render structured `Source` objects as visible references
- **Semantic markup**: JSON-LD for structured data
- **Alternative formats**: Markdown mirrors, `llms.txt`, XML sitemap
- **URL structure**: Dossier pages for freeze persons vs. "palco" (stage) pages for companies/funds
- **Testing**: Minimal test surface (Fact→HTML citation rendering)

## Decision

### Astro with static output

**Framework**: [Astro](https://astro.build) with `output: 'static'`.

**Rationale**:
- Astro excels at static sites generated from structured data (vs. authored Markdown)
- Content Collections can ingest JSONL from R2 at build time
- Zero JavaScript by default (ships only HTML/CSS)
- Excellent developer experience and fast builds
- Strong TypeScript support for typed Facts/Sources

### Zero islands / no client JS by default

**Decision**: No client-side JavaScript frameworks (React, Vue, Svelte) are used by default. The HTML is plain semantic markup with CSS.

**Exception**: If a future feature requires interactivity (e.g., an interactive graph visualization), Astro islands can be added incrementally. v1 does not need them.

**Rationale**:
- Wikipedia-style dossiers are primarily text and citations; they do not require interactivity
- Zero JS improves performance, accessibility, and privacy
- Search engines index plain HTML more reliably

### Wikipedia-style visible citations

Every fact presented in the HTML includes a **visible citation** in the text or footnotes:

**Example**:
> João Silva holds 15% of Empresa XYZ Ltda (CNPJ 12345678).¹
>
> ¹ Source: Receita Federal, CNPJ dump 2024-06-30, retrieved 2026-08-15

**Source object structure** (from Facts JSONL):
```json
{
  "publisher": "Receita Federal",
  "locator": "CNPJ dump 2024-06-30",
  "retrieved_at": "2026-08-15"
}
```

**Derived associations**: If a fact is derived (e.g., "João indirectly controls Empresa ABC via Empresa XYZ"), the citation references the **parent Facts** that establish the chain.

**Implementation**: Astro components render `Source` objects as footnotes or inline citations. Facts without sources are rejected at the dbt test stage (see ADR-0003).

### Also emit

In addition to HTML dossiers, the Astro build generates:

1. **XML sitemap** (`sitemap.xml`): All dossier URLs for search engine indexing
2. **JSON-LD** (embedded in HTML `<script type="application/ld+json">`): Structured `Person` or `Organization` objects with the same claims as the visible HTML
3. **Markdown mirror** per dossier (`/{person}.md`): Plain Markdown version of the dossier for offline reading or archival
4. **`/llms.txt`**: Machine-readable index listing all freeze persons with links to their dossiers (for LLM discovery)

**Rationale**:
- Sitemap and JSON-LD improve SEO and semantic understanding
- Markdown mirrors support archival and non-browser use cases
- `llms.txt` enables LLMs to discover and cite dossiers

### Dossier URLs only for freeze persons

**URL structure**:
- Freeze persons (manually curated list): `/{person-slug}` → full dossier
- Companies and funds: `/{company-slug}` → "palco" (stage) page showing who controls them, but no standalone dossier

**Rationale**:
- The freeze list defines the scope; companies are context, not the subject
- Prevents scope creep: every CNPJ in Brazil would require a page otherwise

### v1 test seam: Fact→HTML citation

The only v1 automated test is the **Fact→HTML citation** seam:
- Input: Test fixtures (Facts JSONL) stored in git (`tests/fixtures/facts/`)
- Output: Rendered HTML with visible citations
- Assertion: HTML includes the correct `Source.publisher`, `Source.locator`, and `Source.retrieved_at`

**Rationale**:
- Citation rendering is the core contract between the pipeline (Facts) and the site (HTML)
- Testing end-to-end (BQ → R2 → HTML) is expensive and brittle; testing one seam is sufficient for v1
- Production Facts live on R2 (not in git), so test fixtures are minimal synthetic examples

**Out of scope for v1**:
- Pipeline tests (covered by dbt tests in ADR-0003)
- Visual regression tests
- Accessibility audits (manual for v1)

## Consequences

### Positive

- Astro's static output and zero-JS default are fast, accessible, and SEO-friendly
- Wikipedia-style citations maintain credibility and verifiability
- Multiple output formats (HTML, JSON-LD, Markdown, `llms.txt`) serve diverse use cases
- Test seam (Fact→HTML) is narrow and stable
- Palco pages for companies keep scope manageable

### Negative

- Astro requires learning a new framework (but its model is simpler than Next.js/Gatsby)
- Zero-JS constraint may require rethinking features that traditionally use client JS (e.g., graphs)
- Test coverage is minimal in v1; expanding tests will require infrastructure (fixtures, snapshots)

### Neutral

- JSON-LD and Markdown mirrors add build complexity but are valuable for discoverability
- Future: if interactivity is needed (e.g., graph zoom), Astro islands provide an escape hatch

## Rejected Alternatives

### Custom Jinja2-only (Python)

**Rejected**: Jinja2 is excellent for templating, but lacks Astro's Content Collections, build tooling, and TypeScript support. A custom Python SSG would require reinventing features Astro provides.

### 11ty (Eleventy)

**Rejected**: 11ty is lightweight and flexible, but less opinionated than Astro. Astro's Content Collections and TypeScript support make it better suited for structured data (Facts JSONL).

### MkDocs / Sphinx / Quarto

**Rejected**: These are documentation generators optimized for authored Markdown, not for generating pages from structured data. They would require heavy customization.

### MediaWiki / Wiki.js

**Rejected**: Wiki software is designed for collaborative editing, not static site generation from structured data. MediaWiki is PHP-based and over-engineered for this use case.

### Dashboards (Streamlit, Dash, Observable)

**Rejected**: Dashboards are interactive and server-rendered, not static. They require a running server and are unsuitable for Cloudflare Pages. Static HTML is more durable and accessible.

### Use client-side JS for citations (e.g., React tooltips)

**Rejected**: Would require shipping a JS framework for a feature (visible citations) that works perfectly in plain HTML. Violates the zero-JS default.

### Test the full pipeline (BQ → R2 → HTML)

**Rejected**: End-to-end tests are slow, brittle, and require BigQuery credentials in CI. Testing the Fact→HTML seam in isolation is faster and sufficient for v1. dbt tests cover the pipeline (ADR-0003).
