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
