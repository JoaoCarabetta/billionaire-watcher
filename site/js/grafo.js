import {
  entityHref,
  getEntity,
  isMissingShard,
  missingShardsHtml,
  parseHash,
  searchNames,
} from "./data.js";
import { createGraph } from "./graph.js";

const input = document.querySelector("#busca");
const hits = document.querySelector("#hits");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showHitsNotice(html) {
  hits.innerHTML = `<li>${html}</li>`;
}

const graph = createGraph(document.querySelector("#cy"), {
  onOpen: (kind, id) => {
    window.location.href = entityHref(kind, id);
  },
  onMissingShards: () => showHitsNotice(missingShardsHtml()),
});

async function plant(kind, id) {
  let entity;
  try {
    entity = await getEntity(kind, id);
  } catch (error) {
    showHitsNotice(
      isMissingShard(error)
        ? missingShardsHtml()
        : `<p class="empty">${escapeHtml(error.message)}</p>`,
    );
    return;
  }
  if (!entity) {
    showHitsNotice(
      `<p class="empty">Não achei ${escapeHtml(kind)} ${escapeHtml(id)}.</p>`,
    );
    return;
  }
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
  let rows;
  try {
    rows = await searchNames(query);
  } catch (error) {
    showHitsNotice(
      isMissingShard(error)
        ? missingShardsHtml()
        : `<p class="empty">${escapeHtml(error.message)}</p>`,
    );
    return;
  }
  hits.innerHTML = rows
    .map((row) => {
      const flag = row.e_oligarca ? ' <span class="badge clay">oligarca</span>' : "";
      const kind = encodeURIComponent(row.kind);
      const id = encodeURIComponent(row.id);
      return `<li><a href="#${kind}/${id}">${escapeHtml(row.nome)}${flag}</a></li>`;
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
