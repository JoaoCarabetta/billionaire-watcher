import type { APIRoute } from 'astro';
import { 
  getFreeze, 
  getIdentityFactsByPersonId,
  getRFPartnerEdgesByPersonId,
  getCVMFREControlsByPersonId,
  getDonationsByPersonId,
  getCandidateByCpf,
  formatCurrency,
  redactCPF
} from '../../utils/fixtures';

export async function getStaticPaths() {
  const freezePersons = getFreeze();
  
  return freezePersons.map(person => ({
    params: { id: person.person_id },
    props: { person }
  }));
}

export const GET: APIRoute = ({ props }: any) => {
  const { person } = props;
  const identityFacts = getIdentityFactsByPersonId(person.person_id);
  const rfPartnerEdges = getRFPartnerEdgesByPersonId(person.person_id);
  const cvmFreControls = getCVMFREControlsByPersonId(person.person_id);
  const donations = getDonationsByPersonId(person.person_id);

  // Find name fact for title, or fallback to freeze CSV name
  const nameFact = identityFacts.find(f => f.field === 'nome');
  const pageTitle = nameFact ? nameFact.value : person.person_name;

  // Build citation map
  const citationMap = new Map<string, number>();
  let nextCitationNumber = 1;
  
  const allSources = [
    ...identityFacts.filter(f => f.source).map(f => f.source!),
    ...rfPartnerEdges.filter(e => e.source).map(e => e.source),
    ...cvmFreControls.filter(c => c.source).map(c => c.source),
    ...donations.map(d => d.source)
  ];
  
  for (const source of allSources) {
    if (!citationMap.has(source.locator)) {
      citationMap.set(source.locator, nextCitationNumber++);
    }
  }

  const getCitationNumber = (source: any) => citationMap.get(source.locator);

  // Build markdown
  let markdown = `# ${pageTitle}\n\n`;
  
  // Identity facts
  if (identityFacts.length > 0) {
    markdown += `## Dados de Identidade\n\n`;
    for (const fact of identityFacts) {
      const citationNum = getCitationNumber(fact.source);
      markdown += `- ${fact.value} [${citationNum}]\n`;
    }
    markdown += `\n`;
  }
  
  // RF Partner edges
  if (rfPartnerEdges.length > 0) {
    markdown += `## Empresas e Sócios\n\n`;
    for (const edge of rfPartnerEdges) {
      const citationNum = getCitationNumber(edge.source);
      markdown += `- ${edge.company_name}: ${edge.relationship} [${citationNum}]\n`;
    }
    markdown += `\n`;
  }
  
  // CVM FRE controls
  if (cvmFreControls.length > 0) {
    markdown += `## Controle Acionário (CVM)\n\n`;
    for (const control of cvmFreControls) {
      const citationNum = getCitationNumber(control.source);
      markdown += `- ${control.company_name}: ${control.control_description} [${citationNum}]\n`;
    }
    markdown += `\n`;
  }
  
  // Donations
  if (donations.length > 0) {
    markdown += `## Doações Políticas\n\n`;
    for (const donation of donations) {
      const candidate = getCandidateByCpf(donation.candidate_cpf);
      const citationNum = getCitationNumber(donation.source);
      const candidateName = redactCPF(donation.candidate_name);
      
      if (donation.donor_type === 'cnpj') {
        markdown += `- Via ${donation.donor_name}: ${formatCurrency(donation.amount)} para ${candidateName} (${donation.cycle}) [${citationNum}]\n`;
      } else {
        markdown += `- ${formatCurrency(donation.amount)} para ${candidateName} (${donation.cycle}) [${citationNum}]\n`;
      }
    }
    markdown += `\n`;
  }
  
  // References
  markdown += `## Referências\n\n`;
  const uniqueSources = Array.from(citationMap.entries())
    .map(([locator, num]) => {
      const source = allSources.find(s => s.locator === locator);
      return { num, source };
    })
    .sort((a, b) => a.num - b.num);
  
  for (const { num, source } of uniqueSources) {
    if (source) {
      markdown += `${num}. **${source.publisher}** — ${source.locator} (recuperado em ${source.retrieved_at})\n`;
    }
  }

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  });
};
