import { entityHref, formatBrl, loadJson, normalizeName } from "./data.js";

const tbody = document.querySelector("#tabela tbody");
const filtro = document.querySelector("#filtro");
const contagem = document.querySelector("#contagem");
const headers = document.querySelectorAll("#tabela th[data-sort]");

let rows = [];
let sortKey = "fortuna_valor";
let sortDir = "desc";

function seedLabel(row) {
  return (row.sementes || []).map((seed) => seed.nome).join(", ");
}

function render(visible) {
  const html = visible
    .map((row) => {
      const incomplete = row.fortuna_incompleta
        ? '<span class="badge gold">incompleta</span>'
        : "";
      const seeds = (row.sementes || [])
        .map(
          (seed) =>
            `<a href="${entityHref("empresa", seed.id)}">${escapeHtml(seed.nome)}</a>`,
        )
        .join(", ");
      return `<tr>
        <td><a href="${entityHref("pessoa", row.id)}">${escapeHtml(row.nome)}</a></td>
        <td class="num">${formatBrl(row.fortuna_valor)}${incomplete}</td>
        <td class="num">${row.n_percursos ?? 0}</td>
        <td>${seeds || "—"}</td>
      </tr>`;
    })
    .join("");
  tbody.innerHTML = html;
  contagem.textContent = `${visible.length} de ${rows.length} oligarcas`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function apply() {
  const needle = normalizeName(filtro.value);
  let visible = rows;
  if (needle) {
    visible = rows.filter((row) => normalizeName(row.nome).includes(needle));
  }
  visible = visible.slice().sort((a, b) => {
    let av;
    let bv;
    if (sortKey === "semente") {
      av = seedLabel(a);
      bv = seedLabel(b);
    } else {
      av = a[sortKey];
      bv = b[sortKey];
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv), "pt")
      : String(bv).localeCompare(String(av), "pt");
  });
  headers.forEach((th) => {
    th.setAttribute(
      "aria-sort",
      th.dataset.sort === sortKey
        ? sortDir === "asc"
          ? "ascending"
          : "descending"
        : "none",
    );
  });
  render(visible);
}

filtro.addEventListener("input", apply);
headers.forEach((th) => {
  th.addEventListener("click", () => {
    if (sortKey === th.dataset.sort) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = th.dataset.sort;
      sortDir = th.dataset.sort === "nome" || th.dataset.sort === "semente" ? "asc" : "desc";
    }
    apply();
  });
});

try {
  rows = await loadJson("dados/oligarcas.json");
} catch (error) {
  contagem.textContent = error.message;
  rows = [];
}
if (!rows) {
  contagem.textContent =
    "Lista local ausente. Rode python3 scripts/export_site_data.py.";
} else {
  apply();
}
