# Valor 1000 2025 - Source Documentation

## Edition Information

- **Edition**: 25th edition
- **Publication Date**: September 16, 2025
- **Financial Year**: FY 2024 (receita líquida)
- **Retrieved**: 2026-08-24

## Source URLs

- **Ranking Page**: https://infograficos.valor.globo.com/valor1000/rankings/ranking-das-1000-maiores/2025
- **JSON Data**: https://infovalorbucket.s3.amazonaws.com/arquivos/valor-1000/2025/ranking-das-1000-maiores/RankingValor10002025.json

## Data Files

- `ranking.csv` - All 1000 companies in the Valor 1000 2025 ranking
- `top50.csv` - Top 50 companies from the ranking (used for freeze ranking input, see issue #23)
- `bancos.csv` - Valor 1000 2025 banks ranking (100 rows). Public JSON `Bancos2025.json` (same S3 bucket as the industrial ranking; not a paywall scrape). Retrieved 2026-08-26.
- `seguradoras.csv` - Valor 1000 2025 insurers ranking, ramos gerais (50 rows). Public JSON `Seguros2025.json`. Retrieved 2026-08-26.

## Financial ranking URLs (2026-08-26)

- **Banks page**: https://infograficos.valor.globo.com/valor1000/rankings/os-100-maiores-bancos/2025
- **Banks JSON**: https://infovalorbucket.s3.amazonaws.com/arquivos/valor-1000/2025/os-100-maiores-bancos/Bancos2025.json
- **Insurers page**: https://infograficos.valor.globo.com/valor1000/rankings/as-50-maiores-seguradoras-ramos-gerais/2025
- **Insurers JSON**: https://infovalorbucket.s3.amazonaws.com/arquivos/valor-1000/2025/as-50-maiores-seguradoras-ramos-gerais/Seguros2025.json

Issue #140 inventory uses industrial ranks 1–500 plus these two financial files. Industrial 501–1000 stay out of that universe.

## Notes

- The freeze dataset at `test/fixtures/freeze.csv` is a separate HTML contract fixture (João Silva) and is **not** derived from this Valor 1000 data.
- The `top50.csv` file contains only the top 50 companies and is intended as the freeze ranking input for issue #23.
- All HTML tags (including `<br>` and `<i class="tooltipster">` elements) have been stripped from company names and other fields.
- Numeric values use Brazilian formatting (comma as decimal separator, period as thousands separator).

## Data Quality

- Total companies: 1,000
- Ranks: 1 through 1,000 (no gaps)
- Top company (Rank 1): Petrobras - R$ 490.829,0 milhões
- Rank 50: Grupo Mateus - R$ 32.085,4 milhões  
- Bottom company (Rank 1000): CCA - R$ 799,8 milhões (Valor cutoff)
