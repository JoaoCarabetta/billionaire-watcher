"""Wipe Memgraph and load marts.empresas / pessoas / vinculos.

Two graphs, same warehouse path:

- complete (default): one edge per vinculos row.
- simplified: reserved. Collapse identical FRE repeats later.

Does not write CPF. Edges carry a readable `name` (papel, fonte, percentual).
"""

from __future__ import annotations

import argparse
import os
from datetime import date, datetime
from pathlib import Path

from google.cloud import bigquery
from neo4j import GraphDatabase
from neo4j.exceptions import ClientError

PROJECT = "billionairewatcher"
BATCH = 400
KEYFILE = Path(__file__).resolve().parents[1] / "service_accounts" / "billionairewatcher-02991eea6f80.json"

# Named checks from seed A (warehouse CNPJs, not the CVM fixture 33000167000158).
JBS = "02916265000160"
PETROBRAS = "33000167000101"
ITAU = "60872504000123"
ITAUSA = "61532644000115"


def chunks(rows: list[dict], size: int = BATCH):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def _plain(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def fetch_rows(client: bigquery.Client, sql: str) -> list[dict]:
    return [{k: _plain(v) for k, v in dict(row).items()} for row in client.query(sql).result()]


def edge_name(row: dict) -> str:
    papel = {
        "acionista_controlador": "controlador",
        "acionista": "acionista",
        "socio": "sócio",
    }.get(row["papel"], row["papel"])
    fonte = "FRE" if row["fonte"] == "fre" else "QSA"
    on = row.get("percentual_on")
    total = row.get("percentual_total")
    bits = [papel, fonte]
    if on is not None:
        bits.append(f"{on:g}% ON")
    elif total is not None:
        bits.append(f"{total:g}% total")
    elif row["fonte"] == "qsa":
        bits.append("sem %")
    return " · ".join(bits)


def rel_type(papel: str) -> str:
    return {
        "acionista_controlador": "CONTROLADOR",
        "acionista": "ACIONISTA",
        "socio": "SOCIO",
    }.get(papel, "VINCULO")


def node_label(origem_tipo: str) -> str:
    return {
        "pessoa": "Pessoa",
        "empresa": "Empresa",
        "estado": "Estado",
    }.get(origem_tipo, "Parada")


def ensure_index(session, label: str) -> None:
    try:
        session.run(f"CREATE INDEX ON :{label}(id)")
    except ClientError as exc:
        if "already" not in str(exc).lower() and "exists" not in str(exc).lower():
            raise


def load(uri: str, credentials: Path | None = None, graph: str = "complete") -> dict:
    if graph != "complete":
        raise NotImplementedError(
            "simplified graph is reserved; load --graph complete for now"
        )
    key = credentials or (KEYFILE if KEYFILE.exists() else None)
    if key:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(key)

    bq = bigquery.Client(project=PROJECT)
    empresas = fetch_rows(bq, "select * from `billionairewatcher.marts.empresas`")
    pessoas = fetch_rows(bq, "select pessoa_id, nome from `billionairewatcher.marts.pessoas`")
    vinculos = fetch_rows(bq, "select * from `billionairewatcher.marts.vinculos`")

    driver = GraphDatabase.driver(uri, auth=None)
    driver.verify_connectivity()
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
        for label in ("Pessoa", "Empresa", "Estado", "Parada"):
            ensure_index(session, label)

        for batch in chunks(
            [
                {
                    "id": r["cnpj"],
                    "name": r["razao_social"],
                    "motivo": r["motivo_entrada_categoria"],
                    "motivo_descricao": r["motivo_entrada_descricao"],
                }
                for r in empresas
            ]
        ):
            session.run(
                """
                UNWIND $rows AS row
                MERGE (n:Empresa {id: row.id})
                SET n.name = row.name,
                    n.label = row.name,
                    n.motivo = row.motivo,
                    n.motivo_descricao = row.motivo_descricao
                """,
                rows=batch,
            )

        for batch in chunks(
            [{"id": r["pessoa_id"], "name": r["nome"]} for r in pessoas]
        ):
            session.run(
                """
                UNWIND $rows AS row
                MERGE (n:Pessoa {id: row.id})
                SET n.name = row.name, n.label = row.name
                """,
                rows=batch,
            )

        extra_nodes: dict[tuple[str, str], dict] = {}
        rels: list[dict] = []
        empresa_ids = {r["cnpj"] for r in empresas}
        pessoa_ids = {r["pessoa_id"] for r in pessoas}
        for row in vinculos:
            tipo = row["origem_tipo"]
            oid = row["origem_id"]
            if tipo == "empresa" and oid not in empresa_ids:
                extra_nodes[("Empresa", oid)] = {
                    "label": "Empresa",
                    "id": oid,
                    "name": row["origem_nome"],
                    "tipo": tipo,
                }
                empresa_ids.add(oid)
            elif tipo == "pessoa" and oid not in pessoa_ids:
                extra_nodes[("Pessoa", oid)] = {
                    "label": "Pessoa",
                    "id": oid,
                    "name": row["origem_nome"],
                    "tipo": tipo,
                }
                pessoa_ids.add(oid)
            elif tipo not in {"empresa", "pessoa"}:
                extra_nodes[(node_label(tipo), oid)] = {
                    "label": node_label(tipo),
                    "id": oid,
                    "name": row["origem_nome"],
                    "tipo": tipo,
                }
            rels.append(
                {
                    "from": oid,
                    "to": row["cnpj"],
                    "rel": rel_type(row["papel"]),
                    "name": edge_name(row),
                    "papel": row["papel"],
                    "fonte": row["fonte"],
                    "percentual_on": row.get("percentual_on"),
                    "percentual_total": row.get("percentual_total"),
                    "qualificacao": row.get("qualificacao"),
                    "fonte_documento": row.get("fonte_documento"),
                    "data_referencia": row.get("data_referencia"),
                    "tem_informacao_de_controle": row.get("tem_informacao_de_controle"),
                }
            )

        for batch in chunks(list(extra_nodes.values())):
            session.run(
                """
                UNWIND $rows AS row
                FOREACH (_ IN CASE WHEN row.label = 'Empresa' THEN [1] ELSE [] END |
                    MERGE (n:Empresa {id: row.id}) SET n.name = coalesce(n.name, row.name), n.label = coalesce(n.label, row.name)
                )
                FOREACH (_ IN CASE WHEN row.label = 'Pessoa' THEN [1] ELSE [] END |
                    MERGE (n:Pessoa {id: row.id}) SET n.name = coalesce(n.name, row.name), n.label = coalesce(n.label, row.name)
                )
                FOREACH (_ IN CASE WHEN row.label = 'Estado' THEN [1] ELSE [] END |
                    MERGE (n:Estado {id: row.id}) SET n.name = row.name, n.label = row.name, n.tipo = row.tipo
                )
                FOREACH (_ IN CASE WHEN row.label = 'Parada' THEN [1] ELSE [] END |
                    MERGE (n:Parada {id: row.id}) SET n.name = row.name, n.label = row.name, n.tipo = row.tipo
                )
                """,
                rows=batch,
            )

        for rel, cypher_type in (
            ("CONTROLADOR", "CONTROLADOR"),
            ("ACIONISTA", "ACIONISTA"),
            ("SOCIO", "SOCIO"),
        ):
            typed = [r for r in rels if r["rel"] == rel]
            for batch in chunks(typed):
                session.run(
                    f"""
                    UNWIND $rows AS row
                    MATCH (a {{id: row.from}})
                    MATCH (b:Empresa {{id: row.to}})
                    CREATE (a)-[r:{cypher_type}]->(b)
                    SET r.name = row.name,
                        r.label = row.name,
                        r.papel = row.papel,
                        r.fonte = row.fonte,
                        r.percentual_on = row.percentual_on,
                        r.percentual_total = row.percentual_total,
                        r.qualificacao = row.qualificacao,
                        r.fonte_documento = row.fonte_documento,
                        r.data_referencia = row.data_referencia,
                        r.tem_informacao_de_controle = row.tem_informacao_de_controle
                    """,
                    rows=batch,
                )

        counts = session.run(
            """
            MATCH (n)
            WITH count(n) AS nodes
            MATCH ()-[r]->()
            RETURN nodes, count(r) AS edges
            """
        ).single()

    driver.close()
    print(
        f"loaded marts ({graph}): {len(empresas)} empresas, {len(pessoas)} pessoas, "
        f"{len(vinculos)} vinculos → graph {counts['nodes']} nodes, {counts['edges']} edges"
    )
    return {
        "empresas": len(empresas),
        "pessoas": len(pessoas),
        "vinculos": len(vinculos),
        "nodes": counts["nodes"],
        "edges": counts["edges"],
    }


def check(uri: str, expected_edges: int | None = None) -> int:
    """Return the number of failed assertions."""
    driver = GraphDatabase.driver(uri, auth=None)
    failed = 0

    def q(cypher: str, **params):
        with driver.session() as session:
            return list(session.run(cypher, **params))

    def scalar(cypher: str, key: str, default=0, **params):
        rows = q(cypher, **params)
        return rows[0][key] if rows else default

    def ok(cond: bool, msg: str) -> None:
        nonlocal failed
        mark = "ok" if cond else "FAIL"
        if not cond:
            failed += 1
        print(f"  [{mark}] {msg}")

    labels = {
        rec["label"]: rec["n"]
        for rec in q("MATCH (n) RETURN labels(n)[0] AS label, count(n) AS n")
    }
    rels = {
        rec["t"]: rec["n"]
        for rec in q("MATCH ()-[r]->() RETURN type(r) AS t, count(r) AS n")
    }
    print("labels", labels)
    print("rels", rels)

    ok(labels.get("Pessoa", 0) > 0, f"{labels.get('Pessoa', 0)} Pessoa nodes")
    ok(labels.get("Empresa", 0) > 0, f"{labels.get('Empresa', 0)} Empresa nodes")
    ok(labels.get("Estado", 0) > 0, f"{labels.get('Estado', 0)} Estado nodes")
    ok("CONTROLADOR" in rels, "CONTROLADOR edges exist")
    ok("SOCIO" in rels, "SOCIO edges exist (QSA kept)")
    if expected_edges is not None:
        got = sum(rels.values())
        ok(got == expected_edges, f"edges {got} match marts.vinculos {expected_edges}")

    uniao_as_person = q(
        """
        MATCH (p:Pessoa)
        WHERE toUpper(p.name) CONTAINS 'UNIÃO' OR toUpper(p.name) CONTAINS 'UNIAO'
        RETURN p.name AS name
        """
    )
    ok(len(uniao_as_person) == 0, "União is not a Pessoa")

    estado_names = [r["name"] for r in q("MATCH (e:Estado) RETURN e.name AS name ORDER BY e.name")]
    ok(
        any("UNIÃO" in (n or "").upper() or "UNIAO" in (n or "").upper() for n in estado_names),
        f"Estado nodes include União ({len(estado_names)} estados)",
    )

    qsa_with_pct = scalar(
        """
        MATCH ()-[r:SOCIO]->()
        WHERE r.fonte = 'qsa' AND r.percentual_on IS NOT NULL
        RETURN count(r) AS n
        """,
        "n",
    )
    ok(qsa_with_pct == 0, "QSA SOCIO edges have no invented percentual_on")

    qsa_ctrl = scalar(
        """
        MATCH ()-[r:SOCIO]->()
        WHERE r.fonte = 'qsa' AND r.papel = 'acionista_controlador'
        RETURN count(r) AS n
        """,
        "n",
    )
    ok(qsa_ctrl == 0, "QSA never emits papel acionista_controlador")

    def show_owners(cnpj: str, title: str) -> list:
        rows = q(
            """
            MATCH (e:Empresa {id: $cnpj})
            OPTIONAL MATCH (o)-[r]->(e)
            RETURN e.name AS empresa, e.motivo AS motivo,
                   labels(o)[0] AS origem, o.name AS titular,
                   type(r) AS rel, r.name AS descricao, r.fonte AS fonte,
                   r.percentual_on AS on
            ORDER BY rel, coalesce(r.percentual_on, -1) DESC, titular
            """,
            cnpj=cnpj,
        )
        if not rows or rows[0]["empresa"] is None:
            ok(False, f"{title} {cnpj} missing")
            return []
        owners = [r for r in rows if r["titular"] is not None]
        print(f"\n  {title}: {rows[0]['empresa']} ({rows[0]['motivo']}), {len(owners)} incoming")
        for r in owners[:14]:
            print(f"    {r['origem']:8} {r['rel']:12} {r['descricao']:32} {r['titular']}")
        if len(owners) > 14:
            print(f"    … {len(owners) - 14} more")
        ok(len(owners) > 0, f"{title} has owners")
        return owners

    def walk_past(cnpj: str, title: str) -> None:
        path = q(
            """
            MATCH path = (stop)-[:CONTROLADOR*1..6]->(e:Empresa {id: $cnpj})
            WHERE stop:Pessoa OR stop:Estado
            RETURN labels(stop)[0] AS origem, stop.name AS titular, length(path) AS hops
            ORDER BY hops
            LIMIT 6
            """,
            cnpj=cnpj,
        )
        if path:
            print(f"    CONTROLADOR path to person/state:")
            for r in path:
                print(f"      {r['hops']} hop(s) → {r['origem']} {r['titular']}")
            ok(True, f"{title} walk reaches a person or the state")
            return
        ok(False, f"{title} CONTROLADOR path does not reach a person or the state")

    jbs = show_owners(JBS, "JBS")
    walk_past(JBS, "JBS")
    if jbs:
        ok(
            any(r["origem"] == "Empresa" and "J&F" in (r["titular"] or "").upper() for r in jbs),
            "JBS is not treated as a stop: J&F is on the graph",
        )

    petro = show_owners(PETROBRAS, "Petrobras")
    ok(
        any(r["origem"] == "Estado" and "UNI" in (r["titular"] or "").upper() for r in petro),
        "Petrobras controlador is Estado (União), not Pessoa",
    )

    itau = show_owners(ITAU, "Itaú")
    bruno_itau = [
        r
        for r in itau
        if r["titular"] and "BRUNO RIZZO SETUBAL" in r["titular"].upper()
    ]
    ok(len(bruno_itau) == 0, "Bruno is not a direct owner of Itaú Holding")
    itausa = show_owners(ITAUSA, "Itaúsa")
    walk_past(ITAU, "Itaú")
    if itausa:
        ok(
            any(r["origem"] == "Pessoa" for r in itausa),
            "Itaúsa has a natural-person controlador",
        )

    edges = scalar("MATCH ()-[r]->() RETURN count(r) AS n", "n")
    ok(edges > 0, f"{edges} edges point at an Empresa")

    seed_without_owner = scalar(
        """
        MATCH (e:Empresa {motivo: 'semente'})
        WHERE NOT ()-->(e)
        RETURN count(e) AS n
        """,
        "n",
    )
    print(f"  seed empresas with no incoming owner: {seed_without_owner}")
    if seed_without_owner > 100:
        print(
            "  note: expected for closed firms without FRE. Their RF QSA rows are "
            "directors (qualificacao 05/08/10/16), which the walk correctly drops."
        )

    driver.close()
    print(f"\n{failed} check(s) failed" if failed else "\nall graph checks passed")
    return failed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uri", default="bolt://localhost:7687")
    parser.add_argument("--credentials", type=Path, default=None)
    parser.add_argument(
        "--graph",
        choices=("complete", "simplified"),
        default="complete",
        help="complete = one edge per vinculos path row. simplified is not built yet.",
    )
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    expected = None
    if not args.check_only:
        expected = load(args.uri, credentials=args.credentials, graph=args.graph)[
            "vinculos"
        ]
    raise SystemExit(check(args.uri, expected_edges=expected))


if __name__ == "__main__":
    main()
