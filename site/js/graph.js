import {
  entityHref,
  getAdj,
  isMissingShard,
  nodeKey,
  parseNodeKey,
} from "./data.js";

const STYLE = [
  {
    selector: "node",
    style: {
      label: "data(nome)",
      "font-family": "IBM Plex Sans, Helvetica, sans-serif",
      "font-size": 11,
      "text-wrap": "wrap",
      "text-max-width": 140,
      "text-valign": "center",
      color: "#1c1916",
      "background-color": "#d8cfc4",
      "border-width": 1,
      "border-color": "#1c1916",
      width: 18,
      height: 18,
    },
  },
  {
    selector: "node[kind = 'pessoa']",
    style: { "background-color": "#b4532a", color: "#1c1916" },
  },
  {
    selector: "node[e_oligarca]",
    style: { "border-width": 3, "border-color": "#8a2f12" },
  },
  {
    selector: "node[kind = 'empresa']",
    style: { "background-color": "#2f4a44", color: "#1c1916" },
  },
  {
    selector: "node[motivo = 'semente']",
    style: { "border-width": 3, "border-color": "#c4a35a" },
  },
  {
    selector: "edge",
    style: {
      width: 1.2,
      "line-color": "#8a8178",
      "target-arrow-color": "#8a8178",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 0.7,
    },
  },
];

export function createGraph(container, { onOpen, onMissingShards } = {}) {
  const cy = window.cytoscape({
    container,
    style: STYLE,
    layout: { name: "preset" },
    minZoom: 0.2,
    maxZoom: 2.5,
    wheelSensitivity: 0.3,
  });

  const expanded = new Set();

  function addEntity(entity, position) {
    const id = nodeKey(entity.kind, entity.id);
    if (cy.getElementById(id).length) return id;
    cy.add({
      group: "nodes",
      data: {
        id,
        nome: entity.nome,
        kind: entity.kind,
        e_oligarca: Boolean(entity.e_oligarca),
        motivo: entity.motivo_entrada || "",
      },
      position: position || {
        x: 240 + Math.random() * 80,
        y: 200 + Math.random() * 80,
      },
    });
    return id;
  }

  async function expand(kind, id) {
    const sourceKey = nodeKey(kind, id);
    let neighbors;
    try {
      neighbors = await getAdj(kind, id);
    } catch (error) {
      if (isMissingShard(error)) {
        if (onMissingShards) onMissingShards(error);
        return;
      }
      throw error;
    }
    const origin = cy.getElementById(sourceKey);
    const ox = origin.length ? origin.position("x") : 240;
    const oy = origin.length ? origin.position("y") : 200;
    neighbors.forEach((neighbor, index) => {
      const angle = (index / Math.max(neighbors.length, 1)) * Math.PI * 2;
      const nid = addEntity(
        { kind: neighbor.kind, id: neighbor.id, nome: neighbor.nome },
        {
          x: ox + Math.cos(angle) * 140,
          y: oy + Math.sin(angle) * 140,
        },
      );
      const edgeId =
        neighbor.dir === "out"
          ? `${sourceKey}->${nid}`
          : `${nid}->${sourceKey}`;
      if (!cy.getElementById(edgeId).length) {
        cy.add({
          group: "edges",
          data: {
            id: edgeId,
            source: neighbor.dir === "out" ? sourceKey : nid,
            target: neighbor.dir === "out" ? nid : sourceKey,
            papel: neighbor.papel,
          },
        });
      }
    });
    expanded.add(sourceKey);
    cy.layout({ name: "cose", animate: false, padding: 24, nodeRepulsion: 6000 }).run();
  }

  cy.on("tap", "node", async (event) => {
    const node = event.target;
    const { kind, id } = parseNodeKey(node.id());
    if (expanded.has(node.id())) {
      if (onOpen) onOpen(kind, id);
      else window.location.href = entityHref(kind, id);
      return;
    }
    await expand(kind, id);
  });

  return { cy, addEntity, expand };
}
