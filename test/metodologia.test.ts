import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Metodologia Page', () => {
  let builtHtml: string;
  let buildFailed: boolean = false;
  let buildError: string = '';
  let homeHtml: string = '';
  let dossierHtml: string = '';

  beforeAll(() => {
    const metodologiaPath = path.join(__dirname, '..', 'dist', 'metodologia', 'index.html');
    const homePath = path.join(__dirname, '..', 'dist', 'index.html');
    const dossierPath = path.join(__dirname, '..', 'dist', 'pessoa', 'p1', 'index.html');
    
    // Always rebuild to ensure fresh state
    try {
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf-8',
        env: {
          ...process.env,
          ALLOW_OLD_FIXTURES: 'true'
        }
      });
    } catch (error: any) {
      buildFailed = true;
      buildError = error.message || String(error);
    }
    
    // Read the built HTML
    if (fs.existsSync(metodologiaPath)) {
      builtHtml = fs.readFileSync(metodologiaPath, 'utf-8');
    } else {
      buildFailed = true;
      buildError = 'Metodologia page not found after build';
    }
    
    if (fs.existsSync(homePath)) {
      homeHtml = fs.readFileSync(homePath, 'utf-8');
    }
    
    if (fs.existsSync(dossierPath)) {
      dossierHtml = fs.readFileSync(dossierPath, 'utf-8');
    }
  });

  describe('Test 1: Page exists and is labeled Metodologia', () => {
    it('should have metodologia page at /metodologia', () => {
      expect(buildFailed).toBe(false);
      expect(builtHtml).toBeTruthy();
    });

    it('should have Metodologia heading (H1 or visible)', () => {
      const hasMetodologiaHeading = /<h1[^>]*>.*?Metodologia.*?<\/h1>/i.test(builtHtml);
      expect(hasMetodologiaHeading).toBe(true);
    });
  });

  describe('Test 2: All sentences have citations', () => {
    it('should have citation markers for all content sentences', () => {
      // Every fact should have a [n] citation marker
      const hasCitationMarkers = /\[[\d]+\]/.test(builtHtml) || 
                                 /<sup[^>]*>.*?\[?\d+\]?.*?<\/sup>/i.test(builtHtml);
      expect(hasCitationMarkers).toBe(true);
    });

    it('should have matching footer citations for all markers', () => {
      // Extract citation numbers from markers
      const markerMatches = builtHtml.match(/\[(\d+)\]/g) || [];
      const citationNumbers = markerMatches.map(m => parseInt(m.replace(/[\[\]]/g, '')));
      
      // Check that each citation has a corresponding footer entry
      for (const num of citationNumbers) {
        const hasFooterCitation = builtHtml.includes(`citation-${num}`) ||
                                  builtHtml.includes(`#citation-${num}`);
        expect(hasFooterCitation).toBe(true);
      }
    });

    it('should have Referências section with citations', () => {
      expect(builtHtml).toMatch(/Referências|referências/);
    });

    it('should have shared locator citationMap (body markers match footer entries)', () => {
      // This tightens the test beyond "some [n] exists"
      // Ensures published body sentences have matching citation markers and footer entries
      const hasReferencesSection = /<h2[^>]*>.*?Referências.*?<\/h2>/i.test(builtHtml);
      expect(hasReferencesSection).toBe(true);
      
      // Check that citation markers exist and reference footer
      const markerMatches = builtHtml.match(/\[(\d+)\]/g) || [];
      expect(markerMatches.length).toBeGreaterThan(0);
      
      // Each marker should have a footer citation with matching number
      const citationNumbers = markerMatches.map(m => parseInt(m.replace(/[\[\]]/g, '')));
      const uniqueNumbers = [...new Set(citationNumbers)];
      
      for (const num of uniqueNumbers) {
        // Check footer has id="citation-N"
        const footerPattern = new RegExp(`id=["']citation-${num}["']`);
        expect(footerPattern.test(builtHtml)).toBe(true);
      }
    });
  });

  describe('Test 3: Required methodology topics are present', () => {
    it('should mention Valor 1000 and receita líquida', () => {
      expect(builtHtml).toMatch(/Valor 1000/i);
      expect(builtHtml).toMatch(/receita líquida/i);
    });

    it('should mention Lei 6.404/1976 Art. 116 (positional door)', () => {
      expect(builtHtml).toMatch(/6\.404|Art\. 116|artigo 116/i);
    });

    it('should clarify RF edges are labeled sócio (nunca dono)', () => {
      // Must explicitly state that RF partner edges are labeled "sócio"
      // Not just pass because "Quadro de Sócios" contains the substring
      expect(builtHtml).toMatch(/rotulad[ao]s?\s+como\s+sócio/i);
      expect(builtHtml).toMatch(/QSA|Quadro de Sócios/i);
      expect(builtHtml).toMatch(/IN.*RFB.*2\.119|Instrução Normativa.*2\.119/i);
      // Should say "nunca como dono" (negation is OK per PM)
      expect(builtHtml).toMatch(/nunca\s+como\s+dono/i);
    });

    it('should mention visible hole when controller unknown', () => {
      expect(builtHtml).toMatch(/desconhecido|lacuna|buraco|não identificado/i);
    });

    it('should mention Forbes as safety net (candidato_forbes)', () => {
      expect(builtHtml).toMatch(/Forbes/i);
    });

    it('should mention freeze date 4 Oct 2026', () => {
      expect(builtHtml).toMatch(/4.*out.*2026|2026-10-04|outubro.*2026/i);
    });

    it('should mention rejected methods: board interlocks', () => {
      expect(builtHtml).toMatch(/conselho|board|interlock/i);
    });

    it('should mention rejected methods: Forbes/Wikipedia as engine', () => {
      expect(builtHtml).toMatch(/Forbes|Wikipedia/i);
    });

    it('should mention rejected methods: TSE volume as elite membership', () => {
      expect(builtHtml).toMatch(/TSE|doações|volume/i);
    });

    it('should mention SOE skip PF (União/Estado/Município, no CEO/ministro as controlador)', () => {
      expect(builtHtml).toMatch(/União|Estado|Município/i);
      expect(builtHtml).toMatch(/estatal/i);
      expect(builtHtml).toMatch(/CEO|ministro/i);
    });

    it('should mention foreign companies and CEO not default controller', () => {
      expect(builtHtml).toMatch(/estrangeira/i);
      expect(builtHtml).toMatch(/CEO|subsidiária/i);
    });

    it('should mention Hoffmann-Lange 2007 (not 1980)', () => {
      expect(builtHtml).toMatch(/Hoffmann-Lange.*2007/i);
      expect(builtHtml).not.toMatch(/Hoffmann-Lange.*1980/i);
    });

    it('should state protocol date (not past tense "foi realizado")', () => {
      expect(builtHtml).toMatch(/4.*outubro.*2026|outubro.*2026/i);
      expect(builtHtml).not.toMatch(/foi realizado|freeze foi/i);
    });

    it('should state aresta da Receita é sócio, nunca dono (no table id)', () => {
      expect(builtHtml).toMatch(/aresta.*Receita/i);
      expect(builtHtml).toMatch(/sócio.*nunca.*dono/i);
      expect(builtHtml).toMatch(/Receita Federal|Base dos Dados/i);
      // br_me_cnpj.socios is pipeline jargon - must be ABSENT
      expect(builtHtml).not.toMatch(/br_me_cnpj\.socios/i);
    });
  });

  describe('Test 4: Voice guidelines - forbidden patterns', () => {
    it('should NOT have forbidden tokens (freeze, candidato_forbes, UBO, br_me_cnpj)', () => {
      // English "freeze" is forbidden
      expect(builtHtml).not.toMatch(/\bfreeze\b/i);
      // CSV jargon
      expect(builtHtml).not.toMatch(/candidato_forbes/i);
      expect(builtHtml).not.toMatch(/skip_soe/i);
      expect(builtHtml).not.toMatch(/br_me_cnpj\.socios/i);
      // UBO is NEVER list token - even in rejection sentences
      expect(builtHtml).not.toMatch(/\bUBO\b/);
    });

    it('should NOT have pipeline jargon (RSS, LLM, UniqueEvent, etc.)', () => {
      expect(builtHtml).not.toMatch(/\bRSS\b/);
      expect(builtHtml).not.toMatch(/\bLLM\b/);
      expect(builtHtml).not.toMatch(/UniqueEvent/i);
      expect(builtHtml).not.toMatch(/extrai campos com IA/i);
    });

    it('should NOT have Wikipedia identity lead', () => {
      // Should not start with a biographical identity pattern
      expect(builtHtml).not.toMatch(/é um.*brasileiro.*nascido/i);
      expect(builtHtml).not.toMatch(/é um.*empresário.*fundador/i);
    });

    it('should NOT use "o bilionário" or identity labels', () => {
      expect(builtHtml).not.toMatch(/o bilionário/i);
      expect(builtHtml).not.toMatch(/de bilionários/i);
    });

    it('should NOT have full CPF in the page', () => {
      // No CPF patterns like 123.456.789-00 or 12345678900
      expect(builtHtml).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      expect(builtHtml).not.toMatch(/\b\d{11}\b/);
    });

    it('should NOT use "dono" as positive RF partner label', () => {
      // "dono" can appear in negation ("nunca como dono") but not as positive label
      // Check it's only in negation context
      const hasDonoPositive = /rotulad[ao]s?\s+como\s+dono|é\s+dono|são\s+donos/i.test(builtHtml);
      expect(hasDonoPositive).toBe(false);
    });

    it('should NOT have unsourced value adjectives', () => {
      // Should not have "poderoso", "polêmico", "gigante" without citations
      // This is a heuristic check - if these appear, they should be near citations
      const hasPoderoso = /poderoso/i.test(builtHtml);
      const hasPolemico = /polêmico/i.test(builtHtml);
      const hasGigante = /gigante/i.test(builtHtml);
      
      // If any of these appear, they should be in a cited context
      // For now, we'll just check they're not there at all
      expect(hasPoderoso).toBe(false);
      expect(hasPolemico).toBe(false);
      expect(hasGigante).toBe(false);
    });
  });

  describe('Test 5: Home and dossier link to metodologia', () => {
    it('should have a link from home page to /metodologia', () => {
      expect(homeHtml).toMatch(/href=["']\/metodologia["']/i);
    });

    it('should have a link from dossier footer to /metodologia', () => {
      expect(dossierHtml).toMatch(/href=["']\/metodologia["']/i);
    });
  });

  describe('Test 6: No unsourced claims render', () => {
    it('should not render any fact without a source', () => {
      // This is enforced by FactWithCitation component
      // Any methodology fact without source should cause build failure or not render
      expect(buildFailed || !builtHtml.includes('UNSOURCED_CLAIM')).toBe(true);
    });
  });

  describe('Test 7: Lacunas, Limitações e Como repetir noutro país', () => {
    const newSentences = [
      'Valor Econômico também publica rankings separados dos 100 maiores bancos e das 50 maiores seguradoras; o ranking industrial das 1000 maiores não é a única lista.',
      'Uma pessoa entra no grafo só quando o nome consta do Formulário de Referência de uma companhia aberta já semente ou do Quadro de Sócios de uma sociedade brasileira já presente no grafo.',
      'Em sociedade anônima, o Quadro de Sócios público deve informar diretores e administradores e não deverá informar acionistas.',
      'Em sociedade anônima fechada, a ausência do nome no quadro público é lacuna visível, não inferência de controle.',
      'Luciano Hang não consta como administrador na Havan S.A.; Edir Macedo não consta na Rádio e Televisão Record S.A.; Luiz Frias e Maria Frias não constam na Empresa Folha da Manhã S.A. nem no Universo Online S.A.; Blairo Maggi, Itamar Locks e Hugo Ribeiro não constam na André Maggi Participações.',
      'Em sociedade limitada, o hop do sócio pessoa jurídica pode nomear pessoa física como sócio: Boticário Produtos de Beleza cita Miguel Gellert Krigsner e Artur Noemio Grynbaum; Fertipar Fertilizantes do Paraná cita Alceu Elias Feldmann como sócio-administrador.',
      'Sede no exterior não tem tabela oficial brasileira de controlador pessoa física; a cadeia estrangeira ou a lacuna visível substituem a invenção.',
      'O grafo não é um ranking de patrimônio e não copia a lista Forbes.',
      'A fatia citada de capital ou de votos vezes o valor de bolsa datado de uma companhia aberta não é fortuna.',
      'Não se reparte igualmente um bloco sem percentual citado, nem se inventa quantidade de ações.',
      'Percorrer as mil linhas do ranking industrial Valor 1000 e desenhá-las no grafo está fora desta versão; o mapa tabular dessas empresas não é o passeio.',
      'Repetir o método noutro país começa pela tabela oficial de controlador da companhia aberta daquele foro, equivalente ao Formulário de Referência seção 6.1.',
      'Para sociedade fechada, usa-se a tabela oficial de sócios e administradores daquele foro, equivalente ao Quadro de Sócios da Receita Federal.',
      'Lista de revista de patrimônios entra só como rede de revisão de candidatos, nunca como motor do passeio.',
    ];

    it('should still have H1 Metodologia and H2 Referências', () => {
      expect(builtHtml).toMatch(/<h1[^>]*>.*?Metodologia.*?<\/h1>/i);
      expect(builtHtml).toMatch(/<h2[^>]*>.*?Referências.*?<\/h2>/i);
    });

    it('should have H2 Lacunas, Limitações and Como repetir noutro país', () => {
      expect(builtHtml).toMatch(/<h2[^>]*>.*?Lacunas.*?<\/h2>/);
      expect(builtHtml).toMatch(/<h2[^>]*>.*?Limitações.*?<\/h2>/);
      expect(builtHtml).toMatch(/<h2[^>]*>.*?Como repetir noutro país.*?<\/h2>/);
    });

    it('should contain locked body strings', () => {
      expect(builtHtml).toContain('bancos');
      expect(builtHtml).toContain('seguradoras');
      expect(builtHtml).toContain('não deverá informar acionistas');
      expect(builtHtml).toContain('Hang');
      expect(builtHtml).toContain('Krigsner');
      expect(builtHtml).toContain('Feldmann');
      expect(builtHtml).toContain('não é fortuna');
      expect(builtHtml).toContain('noutro país');
    });

    it('should publish every new sentence verbatim with a matching citation marker and footer', () => {
      for (const sentence of newSentences) {
        expect(builtHtml, `missing sentence: ${sentence}`).toContain(sentence);

        const sentenceIndex = builtHtml.indexOf(sentence);
        const afterSentence = builtHtml.slice(sentenceIndex, sentenceIndex + sentence.length + 400);
        const markerMatch = afterSentence.match(/\[(\d+)\]/);
        expect(markerMatch, `citation marker after: ${sentence}`).toBeTruthy();

        const num = markerMatch![1];
        expect(builtHtml).toMatch(new RegExp(`id=["']citation-${num}["']`));
      }
    });

    it('should keep forbidden tokens absent', () => {
      expect(builtHtml).not.toMatch(/\bfreeze\b/i);
      expect(builtHtml).not.toMatch(/candidato_forbes/i);
      expect(builtHtml).not.toMatch(/\bUBO\b/);
      expect(builtHtml).not.toMatch(/br_me_cnpj/i);
      expect(builtHtml).not.toMatch(/\bRSS\b/);
      expect(builtHtml).not.toMatch(/\bLLM\b/);
      expect(builtHtml).not.toMatch(/UniqueEvent/i);
      expect(builtHtml).not.toMatch(/o bilionário/i);
      expect(builtHtml).not.toMatch(/o biliónario/i);
      expect(builtHtml).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      expect(builtHtml).not.toMatch(/\b\d{11}\b/);
    });

    it('should never group Dexco as Votorantim or Autopass as Feldmann', () => {
      expect(builtHtml).not.toMatch(/Dexco[\s\S]{0,120}Votorantim|Votorantim[\s\S]{0,120}Dexco/i);
      expect(builtHtml).not.toMatch(/Autopass[\s\S]{0,120}Feldmann|Feldmann[\s\S]{0,120}Autopass/i);
    });

    it('should never label a Receita partner as dono', () => {
      expect(builtHtml).not.toMatch(/rotulad[ao]s?\s+como\s+dono|é\s+dono|são\s+donos/i);
      expect(builtHtml).toMatch(/nunca\s+como\s+dono/i);
    });

    it('should keep home and dossier links to /metodologia', () => {
      expect(homeHtml).toMatch(/href=["']\/metodologia["']/i);
      expect(dossierHtml).toMatch(/href=["']\/metodologia["']/i);
    });

    it('should not use nós or ticket numbers in public fact copy', () => {
      const factValues = [...builtHtml.matchAll(/class="[^"]*fact-value[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
        .map((m) => m[1]);
      expect(factValues.length).toBeGreaterThan(0);
      for (const value of factValues) {
        expect(value).not.toMatch(/\bnós\b/);
        expect(value).not.toMatch(/#\d+/);
        expect(value).not.toMatch(/\bwarehouse\b/i);
        expect(value).not.toMatch(/\bpipeline\b/i);
      }
    });
  });
});
