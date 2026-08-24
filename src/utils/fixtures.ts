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

export function getFacts(): Fact[] {
  return factsData.filter(fact => fact.source !== undefined);
}

export function getFactById(id: string): Fact | undefined {
  return factsData.find(fact => fact.id === id && fact.source !== undefined);
}

export function getDerivedAssociations(): DerivedAssociation[] {
  return associationsData.filter(assoc => 
    assoc.parent_donation_ids.length > 0 &&
    assoc.parent_donation_ids.every(donationId => {
      const donation = getDonations().find(d => d.id === donationId);
      return donation !== undefined;
    })
  );
}

export function getDerivedAssociationsByPersonId(personId: string): DerivedAssociation[] {
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
    
    associations.push({
      id: `assoc-politician-${personId}-${candidateCpf}`,
      person_id: personId,
      associated_candidate_cpf: candidate.cpf,
      association_type: 'politician',
      description: `Doou ${formatCurrency(totalAmount)} para ${candidate.name} (${yearText})`,
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
  return text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF REDACTED]')
             .replace(/\d{11}/g, '[CPF REDACTED]');
}

export function getFreeze(): Person[] {
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
  return identityFactsData.filter(fact => fact.source !== undefined) as IdentityFact[];
}

export function getIdentityFactsByPersonId(personId: string): IdentityFact[] {
  return getIdentityFacts().filter(fact => fact.person_id === personId);
}

export function getRFPartnerEdges(): RFPartnerEdge[] {
  return rfPartnerEdgesData.filter(edge => edge.source !== undefined) as RFPartnerEdge[];
}

export function getRFPartnerEdgesByPersonId(personId: string): RFPartnerEdge[] {
  return getRFPartnerEdges().filter(edge => edge.person_id === personId);
}

export function getCVMFREControls(): CVMFREControl[] {
  return cvmFreControlData.filter(control => control.source !== undefined) as CVMFREControl[];
}

export function getCVMFREControlsByPersonId(personId: string): CVMFREControl[] {
  return getCVMFREControls().filter(control => control.person_id === personId);
}

export function getDonations(): Donation[] {
  return donationsData as Donation[];
}

export function getCandidates(): Candidate[] {
  return candidatesData as Candidate[];
}

export function getDonationsByPersonId(personId: string): Donation[] {
  const freeze = getFreeze();
  const person = freeze.find(p => p.person_id === personId);
  if (!person) return [];
  
  const personCpf = person.cpf?.replace(/\D/g, '');
  const donations = getDonations();
  
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
