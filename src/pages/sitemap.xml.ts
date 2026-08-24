import type { APIRoute } from 'astro';
import { getFreeze } from '../utils/fixtures';

const site = 'https://billionaire-watcher.pages.dev';

export const GET: APIRoute = () => {
  const freezePersons = getFreeze();
  
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/metodologia/', priority: '0.9' },
    { loc: '/doacoes/', priority: '0.8' },
    ...freezePersons.map(person => ({
      loc: `/pessoa/${person.person_id}/`,
      priority: '0.7'
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, priority }) => `  <url>
    <loc>${site}${loc}</loc>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
