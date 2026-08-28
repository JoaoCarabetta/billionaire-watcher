import {
  entityHref,
  formatBrl,
  getEntity,
  grafoHref,
  parseHash,
} from "./data.js";
import { createGraph } from "./graph.js";

const ficha = document.querySelector("#ficha");
const grafoSec = document.querySelector("#grafo-sec");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fonteMarkup(fonte) {
  const text = escapeHtml(fonte);
  if (/^https?:\/\//i.test(fonte || "")) {
    return `<a class="fonte" href="${text}" rel="nofollow">${text}</a>`;
  }
  return `<span class="fonte">${text}</span>`;
}

function pct(value) {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function renderPessoa(entity) {
  const flag = entity.e_oligarca
    ? '<span class="badge clay">e_oligarca</span>'
    : '<span class="badge">não oligarca</span>';
  const incomplete = entity.fortuna_incompleta
    ? '<span class="badge gold">fortuna incompleta</span>'
    : "";
  const chains = (entity.percursos || [])
    .map((path) => {
      const steps = path.passos
        .map((step) => {
          const origHref = entityHref(step.origem_tipo, step.origem_id);
          const destHref = entityHref("empresa", step.destino_id);
          return `<li>
            <a href="${origHref}">${escapeHtml(step.origem_nome)}</a>
            →
            <a href="${destHref}">${escapeHtml(step.destino_nome)}</a>
            · ${escapeHtml(step.papel)}
            · ${escapeHtml(step.fonte)}
            · ON ${pct(step.percentual_on)}
            · total ${pct(step.percentual_total)}
            ${fonteMarkup(step.fonte_documento)}
          </li>`;
        })
        .join("");
      return `<article class="chain">
        <strong>Porta ${escapeHtml(path.semente_nome)}</strong>
        <span class="badge moss">${path.passos.length} passo${path.passos.length === 1 ? "" : "s"}</span>
        <ol>${steps}</ol>
      </article>`;
    })
    .join("");

  ficha.innerHTML = `
    <header class="ficha-head">
      <h2>${escapeHtml(entity.nome)} ${flag}</h2>
    </header>
    <div class="facts">
      <div>Fortuna citada: <strong>${formatBrl(entity.fortuna_valor)}</strong> ${incomplete}</div>
      <div><a href="${grafoHref("pessoa", entity.id)}">Abrir no grafo</a></div>
    </div>
    <h3>Percursos até a porta semente</h3>
    ${chains || '<p class="empty">Nenhum percurso armazenado para esta pessoa.</p>'}
  `;
}

function renderEmpresa(entity) {
  const seed = entity.motivo_entrada === "semente"
    ? '<span class="badge gold">semente</span>'
    : `<span class="badge moss">${escapeHtml(entity.motivo_entrada)}</span>`;
  ficha.innerHTML = `
    <header class="ficha-head">
      <h2>${escapeHtml(entity.nome)} ${seed}</h2>
    </header>
    <div class="facts">
      <div>CNPJ: ${entity.cnpj ? escapeHtml(entity.cnpj) : "—"}</div>
      <div>Piso: <strong>${formatBrl(entity.valor_do_piso)}</strong>
        ${entity.fonte_do_piso ? `(${escapeHtml(entity.fonte_do_piso)})` : ""}</div>
      <div><a href="${grafoHref("empresa", entity.id)}">Abrir no grafo</a></div>
    </div>
    <p class="lede">Sócios e holdings aparecem no grafo ao lado. Clique um nó para expandir.</p>
  `;
}

async function boot() {
  const parsed = parseHash(window.location.hash);
  if (!parsed) {
    ficha.innerHTML = '<p class="empty">Escolha uma pessoa na <a href="index.html">lista de oligarcas</a>.</p>';
    return;
  }
  const entity = await getEntity(parsed.kind, parsed.id);
  if (!entity) {
    ficha.innerHTML = `<p class="empty">Não achei ${escapeHtml(parsed.kind)} ${escapeHtml(parsed.id)}.</p>`;
    return;
  }
  document.title = `${entity.nome} — Billionaire Watcher`;
  if (entity.kind === "empresa") renderEmpresa(entity);
  else renderPessoa(entity);

  grafoSec.hidden = false;
  const graph = createGraph(document.querySelector("#cy"), {
    onOpen: (kind, id) => {
      window.location.href = entityHref(kind, id);
    },
  });
  graph.addEntity(entity, { x: 260, y: 200 });
  await graph.expand(entity.kind, entity.id);
}

window.addEventListener("hashchange", () => window.location.reload());
boot();
