import {
  entityHref,
  getEntity,
  parseHash,
  searchNames,
} from "./data.js";
import { createGraph } from "./graph.js";

const input = document.querySelector("#busca");
const hits = document.querySelector("#hits");
const graph = createGraph(document.querySelector("#cy"), {
  onOpen: (kind, id) => {
    window.location.href = entityHref(kind, id);
  },
});

async function plant(kind, id) {
  const entity = await getEntity(kind, id);
  if (!entity) return;
  graph.addEntity(entity);
  await graph.expand(kind, id);
  hits.innerHTML = "";
  input.value = entity.nome;
}

input.addEventListener("input", async () => {
  const query = input.value.trim();
  if (query.length < 2) {
    hits.innerHTML = "";
    return;
  }
  const rows = await searchNames(query);
  hits.innerHTML = rows
    .map((row) => {
      const flag = row.e_oligarca ? ' <span class="badge clay">oligarca</span>' : "";
      return `<li><a href="#${row.kind}/${encodeURIComponent(row.id)}">${row.nome}${flag}</a></li>`;
    })
    .join("");
});

hits.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  event.preventDefault();
  window.location.hash = link.getAttribute("href").replace(/^#/, "");
});

async function fromHash() {
  const parsed = parseHash(window.location.hash);
  if (parsed) await plant(parsed.kind, parsed.id);
}

window.addEventListener("hashchange", fromHash);
fromHash();
