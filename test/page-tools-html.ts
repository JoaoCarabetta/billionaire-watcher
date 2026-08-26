/** Shared HTML stripping for the in-page tools registrar (issue #157). */

export const PAGE_TOOLS_ARCHIVE_ID = 'page-tools-archive';

export function withoutJsonLdAndPageTools(html: string): string {
  return html
    .replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*id="page-tools-archive"[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*id="indice-minted"[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*src="\/register-page-tools\.js"[^>]*>\s*<\/script>/gi, '')
    .replace(/<script[^>]*type="module"[^>]*src="[^"]+"[^>]*>\s*<\/script>/gi, '')
    .replace(/<script[^>]*src="[^"]+"[^>]*type="module"[^>]*>\s*<\/script>/gi, '');
}

export function pageToolsScriptSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<script[^>]*src="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    srcs.push(match[1]);
  }
  return srcs.filter((src) => src.includes('register-page-tools'));
}
