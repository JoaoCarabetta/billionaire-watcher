# billionaire-watcher
Arquivo cívico de poder econômico no Brasil — dossiês HTML gerados de dados públicos

## Commands

```sh
npm test        # Run tests
npm run build   # Build static site to ./dist/
```

## Agent Readiness

This site is designed to be readable by AI agents. After the first public deploy on Cloudflare Pages, rescan at https://is-agentic.com/ to verify agent-readiness score.

Features:
- Static HTML with content in initial response (no JS-only body)
- Semantic HTML with proper headings, lists, and tables
- `sitemap.xml` listing all routes
- `llms.txt` explaining archive structure and navigation
- Real 404 page (not soft-404 SPA)
- Visible citations in HTML text

### Continuous Validation

The [Is Agentic CI workflow](.github/workflows/is-agentic-ci.yml) runs automatically to verify agent-readiness on the deployed site at https://billionaire-watcher.pages.dev/

- **Triggers:** Push to main (site files) + weekday schedule
- **Command:** `npx is-agentic https://billionaire-watcher.pages.dev/ --json`
- **Failure Policy:** Fails only on Essential tier issues; Recommended API/OAuth/MCP gaps do not block
