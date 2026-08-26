/**
 * Transforms grafo JSON (nodes + edges) to Cytoscape elements.
 * 
 * Edge IDs are unique (e0, e1, e2...) to handle multiple edges between same nodes.
 * Source/target are the JSON from/to node IDs.
 */

export interface GrafoNode {
  id: string;
  kind: 'person' | 'company';
  label: string;
}

export interface GrafoEdge {
  from: string;
  to: string;
  kind: string;
  pct_capital: number | null;
  source: string;
}

export interface GrafoData {
  nodes: GrafoNode[];
  edges: GrafoEdge[];
}

export interface CytoscapeElement {
  data: {
    id: string;
    label?: string;
    kind?: string;
    source?: string;
    target?: string;
  };
}

export function buildCytoscapeElements(data: GrafoData): CytoscapeElement[] {
  const elements: CytoscapeElement[] = [];

  // Add nodes
  data.nodes.forEach(node => {
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        kind: node.kind
      }
    });
  });

  // Add edges with unique IDs
  data.edges.forEach((edge, index) => {
    const edgeLabel = edge.pct_capital !== null && edge.pct_capital !== undefined
      ? `${edge.pct_capital}%`
      : '';

    elements.push({
      data: {
        id: `e${index}`,
        source: edge.from,
        target: edge.to,
        label: edgeLabel,
        kind: edge.kind
      }
    });
  });

  return elements;
}
