import type { APIRoute } from 'astro';
import { getFreeze } from '../utils/fixtures';

export const GET: APIRoute = () => {
  const freezePersons = getFreeze();
  
  const text = `# Billionaire Watcher

Arquivo cívico de poder econômico no Brasil. Dossiês HTML gerados de dados públicos.

## Estrutura

- / — índice de pessoas
- /metodologia/ — métodos e fontes
- /doacoes/ — tabela de doações políticas (TSE)
- /pessoa/{id}/ — dossiê individual com fatos documentados e citações
- /grafo/ — visualização de grafo de controle corporativo (Cytoscape.js)
- /grafo-publico.json — dados do grafo (89 nós, 44 arestas) em JSON estático

Pessoas no índice atual: ${freezePersons.length}

## Princípios

Fatos citados com fontes públicas (Receita Federal, CVM, TSE). Sem narrativa especulativa.
Voz: notícia de arquivo cívico, não biografia.

## Exemplos de rotas

${freezePersons.slice(0, 3).map(p => `/pessoa/${p.person_id}/`).join('\n')}

Dados estruturados: cada dossiê contém seções (Identidade, Empresas, Controle, Doações) com citações numeradas.

## Fatos Publicados

Índice de fatos estruturados:
https://billionaire-watcher.pages.dev/api/facts/latest/index.json

Arquivos por pessoa:
https://billionaire-watcher.pages.dev/api/facts/latest/{slug}.json
https://billionaire-watcher.pages.dev/api/facts/latest/{slug}.jsonl
`;

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
