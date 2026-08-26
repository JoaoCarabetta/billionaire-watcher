/** Shared HTML seam helpers for minted ficha resumo tests (issue #161). */

export function h1Text(html: string): string {
  const match = html.match(/<h1>([\s\S]*?)<\/h1>/);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

export function firstMainBlockText(html: string): string {
  const mainStart = html.indexOf('<main>');
  const mainEnd = html.indexOf('</main>');
  if (mainStart === -1 || mainEnd === -1 || mainEnd <= mainStart) {
    return '';
  }
  const inner = html.slice(mainStart + '<main>'.length, mainEnd).trim();
  const match = inner.match(/^<(section|p|div)(\s[^>]*)?>[\s\S]*?<\/\1>/);
  const block = match ? match[0] : inner;
  return block
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
