export interface Source {
  publisher: string;
  locator: string;
  retrieved_at: string;
}

export interface Fact {
  id: string;
  value: string;
  source?: Source;
  cpf?: string;
}

export interface DerivedAssociation {
  id: string;
  description: string;
  parent_facts: string[];
}

export interface Person {
  person_id: string;
  person_name: string;
  group_name: string;
  role: string;
  cpf?: string;
}

export interface IdentityFact extends Fact {
  person_id: string;
  field: string;
}

export interface RFPartnerEdge {
  id: string;
  person_id: string;
  company_cnpj: string;
  company_name: string;
  relationship: string;
  source: Source;
}

export interface CVMFREControl {
  id: string;
  person_id: string;
  company_name: string;
  control_type: string;
  control_description: string;
  source: Source;
}

export interface Donation {
  id: string;
  donor_type: 'person' | 'cnpj';
  donor_cpf?: string;
  donor_cnpj?: string;
  donor_name: string;
  candidate_cpf: string;
  candidate_name: string;
  candidate_numero: string;
  amount: number;
  year: number;
  cycle: string;
  source: Source;
}

export interface Candidate {
  cpf: string;
  name: string;
  numero: string | null;
  in_freeze: boolean;
  person_id?: string;
  wikipedia_url?: string;
  tse_url?: string;
}
