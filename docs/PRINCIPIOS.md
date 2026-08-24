# Princípios — Billionaire Watcher

## 1. O leitor principal é o agente

Este arquivo é buscado **primeiro** por AI agents (ChatGPT, Claude, Google e equivalentes), depois por humanos. Tudo que for desenvolvido passa por isso.

- HTML estático com o fato no primeiro response (sem casca JS).
- Texto em ficha jornalística (`docs/REDACAO.md`): nexo + cifra + citação; sem biografia, sem prosa de IA.
- Índice máquina: `sitemap.xml`, `llms.txt`, headings reais.
- Dados: uma API pública **mínima**, só leitura, para um agente puxar o conjunto sem scrapar HTML.
- Score [is-agentic](https://is-agentic.com/) (Essential) é teste, não desculpa para inventar MCP/OpenAPI de fachada.
- Humano continua primeiro cidadão na página; o agente não ganha um dashboard paralelo. Ganha a *mesma* ficha, bem estruturada, e um GET JSON.

Se uma feature não ajuda um agente a achar, ler ou citar um fato com fonte, ela não entra no v1.
