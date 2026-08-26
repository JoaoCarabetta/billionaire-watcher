import { pageToolsArchiveJson } from '../lib/page-tools-data';

export const GET = () => {
  return new Response(pageToolsArchiveJson(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
