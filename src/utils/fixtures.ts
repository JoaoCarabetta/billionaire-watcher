import type { Fact, DerivedAssociation, Person, IdentityFact, RFPartnerEdge, CVMFREControl, Donation, Candidate } from '../types';
import factsData from '../../test/fixtures/facts.json';
import associationsData from '../../test/fixtures/derived-associations.json';
import identityFactsData from '../../test/fixtures/identity-facts.json';
import rfPartnerEdgesData from '../../test/fixtures/rf-partner-edges.json';
import cvmFreControlData from '../../test/fixtures/cvm-fre-control.json';
import donationsData from '../../test/fixtures/donations.json';
import candidatesData from '../../test/fixtures/candidates.json';
import methodologyFactsData from '../../test/fixtures/methodology-facts.json';
import fs from 'fs';
import path from 'path';
import { 
  shouldUsePublishedFacts, 
  getPublishedFactsFreeze,
  getPublishedFactsByPersonId,
  publishedFactToSource,
  loadPublishedFacts,
  type PublishedFact
} from './published-facts-loader';

// Re-export for components
export { shouldUsePublishedFacts };

export function getFacts(): Fact[] {
  return factsData.filter(fact => fact.source !== undefined);
}

export function getFactById(id: string): Fact | undefined {
  return factsData.find(fact => fact.id === id && fact.source !== undefined);
}

export function getDerivedAssociations(): DerivedAssociation[] {
  if (shouldUsePublishedFacts()) {
    return convertPublishedFactsToAssociations();
  }
  return associationsData.filter(assoc => 
    assoc.parent_donation_ids.length > 0 &&
    assoc.parent_donation_ids.every(donationId => {
      const donation = getDonations().find(d => d.id === donationId);
      return donation !== undefined;
    })
  );
}

/**
 * Convert published facts to DerivedAssociations format.
 * Real published facts use fact_kind='association' with supporting_fact_ids.
 */
export function convertPublishedFactsToAssociations(): DerivedAssociation[] {
  const facts = loadPublishedFacts();
  
  return facts
    .filter((fact: PublishedFact) => fact.fact_kind === 'association')
    .map((fact: PublishedFact) => {
      // Determine association type from value
      let type: 'politician' | 'freeze_person' = 'freeze_person';
      if (fact.value.includes('compartilham controle')) {
        type = 'freeze_person';
      } else if (fact.value.includes('doaram para')) {
        type = 'freeze_person';
      }
      
      // supporting_fact_ids is an array (string[]) in real published facts
      // Accept string for backwards compatibility
      const supportingIds = fact.supporting_fact_ids 
        ? (Array.isArray(fact.supporting_fact_ids)
            ? fact.supporting_fact_ids
            : fact.supporting_fact_ids.split(',').map((id: string) => id.trim()))
        : [];
      
      return {
        id: fact.fact_id,
        person_id: fact.person_id,
        association_type: type,
        description: fact.value,
        parent_donation_ids: supportingIds,
        source: publishedFactToSource(fact)
      };
    });
}

export function getDerivedAssociationsByPersonId(personId: string): DerivedAssociation[] {
  // When using published facts, use the association facts directly
  if (shouldUsePublishedFacts()) {
    const allAssociations = getDerivedAssociations();
    return allAssociations.filter(a => a.person_id === personId);
  }
  
  // Old fixture path: derive associations from donations
  const freeze = getFreeze();
  const person = freeze.find(p => p.person_id === personId);
  if (!person) return [];
  
  const donations = getDonationsByPersonId(personId);
  const candidates = getCandidates();
  const associations: DerivedAssociation[] = [];
  
  // Group donations by candidate
  const donationsByCandidate = new Map<string, Donation[]>();
  for (const donation of donations) {
    const candidateCpf = donation.candidate_cpf.replace(/\D/g, '');
    if (!donationsByCandidate.has(candidateCpf)) {
      donationsByCandidate.set(candidateCpf, []);
    }
    donationsByCandidate.get(candidateCpf)!.push(donation);
  }
  
  // Create politician associations (one per candidate donated to)
  for (const [candidateCpf, candidateDonations] of donationsByCandidate.entries()) {
    const candidate = candidates.find(c => c.cpf.replace(/\D/g, '') === candidateCpf);
    if (!candidate) continue;
    
    // Skip if candidate is in freeze (they should be in freeze-to-freeze associations instead)
    if (candidate.in_freeze) continue;
    
    const totalAmount = candidateDonations.reduce((sum, d) => sum + d.amount, 0);
    const years = [...new Set(candidateDonations.map(d => d.year))].sort();
    const yearText = years.length === 1 ? years[0].toString() : `${years[0]}-${years[years.length - 1]}`;
    
    // Use last 3 digits of CPF for ID (redacted form)
    const cpfLast3 = candidateCpf.slice(-3);
    
    associations.push({
      id: `assoc-politician-${personId}-${cpfLast3}`,
      person_id: personId,
      associated_candidate_cpf: candidate.cpf,
      association_type: 'politician',
      description: `Doou ${formatCurrency(totalAmount)} para ${redactCPF(candidate.name)} (${yearText})`,
      parent_donation_ids: candidateDonations.map(d => d.id)
    });
  }
  
  // Create freeze-to-freeze associations (co-donors)
  const allDonations = getDonations();
  const allFreeze = freeze.filter(p => p.person_id !== personId);
  
  for (const otherPerson of allFreeze) {
    const otherDonations = getDonationsByPersonId(otherPerson.person_id);
    
    // Find candidates both donated to
    const sharedCandidates = new Map<string, { myDonations: Donation[], theirDonations: Donation[] }>();
    
    for (const myDonation of donations) {
      const candidateCpf = myDonation.candidate_cpf.replace(/\D/g, '');
      const theirDonationsToSame = otherDonations.filter(d => 
        d.candidate_cpf.replace(/\D/g, '') === candidateCpf
      );
      
      if (theirDonationsToSame.length > 0) {
        if (!sharedCandidates.has(candidateCpf)) {
          sharedCandidates.set(candidateCpf, { myDonations: [], theirDonations: [] });
        }
        sharedCandidates.get(candidateCpf)!.myDonations.push(myDonation);
        sharedCandidates.get(candidateCpf)!.theirDonations.push(...theirDonationsToSame);
      }
    }
    
    if (sharedCandidates.size > 0) {
      // Get unique parent donation IDs (both my donations and their donations)
      const allParentDonationIds = new Set<string>();
      for (const { myDonations, theirDonations } of sharedCandidates.values()) {
        myDonations.forEach(d => allParentDonationIds.add(d.id));
        theirDonations.forEach(d => allParentDonationIds.add(d.id));
      }
      
      const candidateNames = Array.from(sharedCandidates.keys())
        .map(cpf => {
          const candidate = candidates.find(c => c.cpf.replace(/\D/g, '') === cpf);
          return candidate ? redactCPF(candidate.name) : 'candidato';
        })
        .slice(0, 2);
      
      const candidateText = candidateNames.length === 1 
        ? candidateNames[0]
        : `${candidateNames[0]} e outros`;
      
      associations.push({
        id: `assoc-freeze-${personId}-${otherPerson.person_id}`,
        person_id: personId,
        associated_person_id: otherPerson.person_id,
        association_type: 'freeze_person',
        description: `Co-doador com ${otherPerson.person_name} para ${candidateText}`,
        parent_donation_ids: Array.from(allParentDonationIds)
      });
    }
  }
  
  return associations;
}

export function redactCPF(text: string): string {
  // Replace formatted CPF (123.456.789-00) with ***NNN***
  // Extract last 3 digits from the 11-digit number
  text = text.replace(/\d{3}\.\d{3}\.(\d{3})-(\d{2})/g, (match, group3, group4) => {
    // Last 3 digits are: last digit of group3 + both digits of group4
    const last3 = group3.slice(-1) + group4;
    return `***${last3}***`;
  });
  
  // Replace 11-digit CPF with ***NNN***
  text = text.replace(/(\d{11})/g, (match) => {
    const last3 = match.slice(-3);
    return `***${last3}***`;
  });
  
  return text;
}

export function getFreeze(): Person[] {
  // Use published facts freeze if enabled
  if (shouldUsePublishedFacts()) {
    return getPublishedFactsFreeze();
  }
  
  // Production builds must not use old fixtures
  if (!process.env.ALLOW_OLD_FIXTURES && !process.env.NODE_ENV?.includes('test')) {
    throw new Error(
      'Production build requires published facts. ' +
      'Set PUBLISHED_FACTS_DIR or USE_PUBLISHED_FACTS environment variable. ' +
      'Old fixture builds (test/fixtures/freeze.csv) are disabled in production.'
    );
  }
  
  try {
    const freezePath = path.join(process.cwd(), 'test', 'fixtures', 'freeze.csv');
    const freezeContent = fs.readFileSync(freezePath, 'utf-8');
    const lines = freezeContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const person: Person = {
        person_id: values[0],
        person_name: values[1],
        group_name: values[2],
        role: values[3],
      };
      if (values[4]) {
        person.cpf = values[4];
      }
      return person;
    });
  } catch (error) {
    console.error('Error loading freeze CSV:', error);
    return [];
  }
}

export function getIdentityFacts(): IdentityFact[] {
  if (shouldUsePublishedFacts()) {
    return convertPublishedFactsToIdentityFacts();
  }
  return identityFactsData.filter(fact => fact.source !== undefined) as IdentityFact[];
}

export function getIdentityFactsByPersonId(personId: string): IdentityFact[] {
  return getIdentityFacts().filter(fact => fact.person_id === personId);
}

/**
 * Convert published facts to identity facts format.
 * Real published facts use fact_kind='identity' with value as raw field (name, role, group_name).
 */
function convertPublishedFactsToIdentityFacts(): IdentityFact[] {
  const facts = loadPublishedFacts();
  
  const result: IdentityFact[] = [];
  const personsWithCpf = new Set<string>();
  
  for (const fact of facts) {
    if (fact.fact_kind === 'identity') {
      // Infer field type from fact_id pattern (identity_{cnpj}_{person}_{field})
      let field = 'unknown';
      if (fact.fact_id.includes('_name')) {
        field = 'nome';
      } else if (fact.fact_id.includes('_role')) {
        field = 'role';
      } else if (fact.fact_id.includes('_group')) {
        field = 'group_name';
      }
      
      result.push({
        id: fact.fact_id,
        person_id: fact.person_id,
        field: field,
        value: fact.value,
        source: publishedFactToSource(fact),
        cpf: fact.cpf_masked || undefined
      });
    }
  }
  
  return result;
}

export function getRFPartnerEdges(): RFPartnerEdge[] {
  if (shouldUsePublishedFacts()) {
    return convertPublishedFactsToRFPartnerEdges();
  }
  return rfPartnerEdgesData.filter(edge => edge.source !== undefined) as RFPartnerEdge[];
}

export function getRFPartnerEdgesByPersonId(personId: string): RFPartnerEdge[] {
  return getRFPartnerEdges().filter(edge => edge.person_id === personId);
}

/**
 * Convert published facts to RF partner edges format.
 * Real published facts use fact_kind='control_edge' with value as complete sentence.
 * Extract company name and relationship from sentence and cnpj_basico/group_name fields.
 */
function convertPublishedFactsToRFPartnerEdges(): RFPartnerEdge[] {
  const facts = loadPublishedFacts();
  
  return facts
    .filter((fact: PublishedFact) => fact.fact_kind === 'control_edge' && fact.cnpj_basico && fact.group_name)
    .map((fact: PublishedFact) => {
      // Extract relationship from sentence (e.g., "João Silva é sócio de...")
      let relationship = 'sócio'; // default
      if (fact.value.includes('é acionista controlador')) {
        relationship = 'acionista controlador';
      } else if (fact.value.includes('é administrador')) {
        relationship = 'administrador';
      } else if (fact.value.includes('é sócio')) {
        relationship = 'sócio';
      }
      
      // Use cnpj_basico as is (8 digits), don't invent suffixes
      const cnpjFormatted = fact.cnpj_basico!;
      
      return {
        id: fact.fact_id,
        person_id: fact.person_id,
        company_cnpj: cnpjFormatted,
        company_name: fact.group_name!,
        relationship: relationship,
        source: publishedFactToSource(fact)
      };
    });
}

export function getCVMFREControls(): CVMFREControl[] {
  if (shouldUsePublishedFacts()) {
    // Map control_edge facts to CVM control objects
    return convertPublishedFactsToCVMControls();
  }
  return cvmFreControlData.filter(control => control.source !== undefined) as CVMFREControl[];
}

/**
 * Convert control_edge facts to CVM FRE control format.
 */
function convertPublishedFactsToCVMControls(): CVMFREControl[] {
  const facts = loadPublishedFacts();
  
  return facts
    .filter((fact: PublishedFact) => fact.fact_kind === 'control_edge')
    .map((fact: PublishedFact) => {
      // Extract company name and relationship from the control_edge value
      // Format: "João Silva é sócio de Empresa XYZ Ltda. (CNPJ 12345678)"
      const companyMatch = fact.value.match(/de\s+(.+?)\s+\(CNPJ/);
      const relationshipMatch = fact.value.match(/é\s+(\w+)\s+de/);
      
      const companyName = companyMatch ? companyMatch[1] : fact.group_name || '';
      const relationship = relationshipMatch ? relationshipMatch[1] : 'sócio';
      
      return {
        id: fact.fact_id,
        person_id: fact.person_id,
        company_name: companyName,
        control_type: relationship,
        control_description: fact.value,
        source: publishedFactToSource(fact)
      };
    });
}

export function getCVMFREControlsByPersonId(personId: string): CVMFREControl[] {
  return getCVMFREControls().filter(control => control.person_id === personId);
}

export function getDonations(): Donation[] {
  if (shouldUsePublishedFacts()) {
    return convertPublishedFactsToDonations();
  }
  return donationsData as Donation[];
}

/**
 * Convert published facts to Donations format.
 * Real published facts use fact_kind='donation' with value as complete sentence.
 * Extract donation details from sentence.
 */
function convertPublishedFactsToDonations(): Donation[] {
  const facts = loadPublishedFacts();
  
  return facts
    .filter((fact: PublishedFact) => fact.fact_kind === 'donation')
    .map((fact: PublishedFact) => {
      // Parse sentence: "João Silva doou R$ 100000 para Fernanda Almeida em 2020 (recibo recibo-2020-001)"
      const amountMatch = fact.value.match(/R\$\s*([\d]+)/);
      // Fix regex: capture everything between "para" and "em", non-greedy
      const candidateMatch = fact.value.match(/para\s+(.+?)\s+em/);
      const yearMatch = fact.value.match(/em\s+(\d{4})/);
      
      const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
      const candidateName = candidateMatch ? candidateMatch[1].trim() : '';
      const year = yearMatch ? parseInt(yearMatch[1]) : 0;
      
      // Use source_locator as cycle (don't invent text)
      const cycle = fact.source_locator || '';
      
      return {
        id: fact.fact_id,
        donor_type: 'person' as const,
        donor_cpf: fact.cpf_masked,
        donor_name: fact.person_id,
        candidate_cpf: '', // Not available in published facts
        candidate_name: candidateName,
        candidate_numero: '',
        amount: amount,
        year: year,
        cycle: cycle,
        source: publishedFactToSource(fact)
      };
    });
}

export function getCandidates(): Candidate[] {
  return candidatesData as Candidate[];
}

export function getDonationsByPersonId(personId: string): Donation[] {
  const donations = getDonations();
  
  // When using published facts, donations are already person-specific
  if (shouldUsePublishedFacts()) {
    return donations.filter(d => d.donor_name === personId);
  }
  
  // Old fixture logic
  const freeze = getFreeze();
  const person = freeze.find(p => p.person_id === personId);
  if (!person) return [];
  
  const personCpf = person.cpf?.replace(/\D/g, '');
  
  // Get CNPJs from RF partner edges (existing #3 control chain)
  const rfPartnerEdges = getRFPartnerEdgesByPersonId(personId);
  const controlledCnpjs = rfPartnerEdges.map(edge => edge.company_cnpj.replace(/\D/g, ''));
  
  // Find donations from person's CPF or controlled CNPJs
  return donations.filter(donation => {
    // Personal donation
    if (donation.donor_cpf && personCpf) {
      const donorCpf = donation.donor_cpf.replace(/\D/g, '');
      if (donorCpf === personCpf) return true;
    }
    
    // CNPJ donation from controlled entity (palco)
    if (donation.donor_cnpj) {
      const donorCnpj = donation.donor_cnpj.replace(/\D/g, '');
      if (controlledCnpjs.includes(donorCnpj)) return true;
    }
    
    return false;
  });
}

export function getCandidateByCpf(cpf: string): Candidate | undefined {
  const candidates = getCandidates();
  const cleanCpf = cpf.replace(/\D/g, '');
  return candidates.find(c => c.cpf.replace(/\D/g, '') === cleanCpf);
}

export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  // Replace non-breaking spaces with regular spaces for consistent testing
  return formatted.replace(/\u00A0/g, ' ');
}

export function getMethodologyFacts(): Fact[] {
  return methodologyFactsData.filter(fact => fact.source !== undefined);
}
