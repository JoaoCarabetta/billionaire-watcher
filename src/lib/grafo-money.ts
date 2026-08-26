/**
 * Lookup of cited person money from public/grafo-dinheiro.json.
 *
 * Returns the person-level last-hop totals as committed. Does not invent a
 * row, a percent, or a price. Does not read last_hops as the headline.
 */

export type GrafoMoneyPerson = {
  id: string;
  date: string;
  money_economic: number;
  money_control: number;
  sources: string[];
};

export type GrafoMoneyFile = {
  people?: GrafoMoneyPerson[];
};

export type PersonMoney = {
  money_economic: number;
  money_control: number;
  date: string;
  sources: string[];
};

export function lookupPersonMoney(
  money: GrafoMoneyFile | null | undefined,
  personId: string
): PersonMoney | null {
  if (!money || !Array.isArray(money.people) || typeof personId !== 'string' || personId === '') {
    return null;
  }

  const row = money.people.find((person) => person.id === personId);
  if (!row) {
    return null;
  }
  if (typeof row.money_economic !== 'number' || !Number.isFinite(row.money_economic)) {
    return null;
  }
  if (typeof row.money_control !== 'number' || !Number.isFinite(row.money_control)) {
    return null;
  }
  if (typeof row.date !== 'string' || row.date === '') {
    return null;
  }

  const sources = Array.isArray(row.sources)
    ? row.sources.filter((item): item is string => typeof item === 'string' && item !== '')
    : [];

  return {
    money_economic: row.money_economic,
    money_control: row.money_control,
    date: row.date,
    sources,
  };
}
