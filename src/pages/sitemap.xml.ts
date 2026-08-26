import type { APIRoute } from 'astro';
import { getFreeze } from '../utils/fixtures';
import { mintCitedEmpresas } from '../lib/mint-empresa';
import { loadPublicGrafo, mintCitedPessoas } from '../lib/mint-pessoa';

export const GET: APIRoute = () => {
  const freezePersons = getFreeze();
  const grafo = loadPublicGrafo();
  const minted = mintCitedPessoas(grafo);
  const mintedEmpresas = mintCitedEmpresas(grafo);
  const freezeIds = new Set(freezePersons.map(person => person.person_id));
  
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/metodologia/', priority: '0.9' },
    { loc: '/doacoes/', priority: '0.8' },
    { loc: '/grafo/', priority: '0.8' },
    { loc: '/grafo-publico.json', priority: '0.7' },
    ...freezePersons.map(person => ({
      loc: `/pessoa/${person.person_id}/`,
      priority: '0.7'
    })),
    ...minted
      .filter(pessoa => !freezeIds.has(pessoa.id))
      .map(pessoa => ({
        loc: `/pessoa/${pessoa.id}/`,
        priority: '0.7'
      })),
    ...mintedEmpresas.map(empresa => ({
      loc: `/empresa/${empresa.id}/`,
      priority: '0.7'
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, priority }) => `  <url>
    <loc>${loc}</loc>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
