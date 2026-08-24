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
