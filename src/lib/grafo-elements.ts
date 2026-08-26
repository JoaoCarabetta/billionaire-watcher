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
  pct_capital?: number | null;
  pct_votos?: number | null;
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
    let edgeLabel = '';
    
    const hasCapital = edge.pct_capital !== null && edge.pct_capital !== undefined;
    const hasVotos = edge.pct_votos !== null && edge.pct_votos !== undefined;
    
    if (hasCapital && hasVotos) {
      edgeLabel = `${edge.pct_capital}% capital, ${edge.pct_votos}% votos`;
    } else if (hasCapital) {
      edgeLabel = `${edge.pct_capital}%`;
    } else if (hasVotos) {
      edgeLabel = `${edge.pct_votos}% votos`;
    }

    elements.push({
      data: {
        id: `e${index}`,
        source: edge.from,
        target: edge.to,
        label: edgeLabel || undefined,
        kind: edge.kind
      }
    });
  });

  return elements;
}
