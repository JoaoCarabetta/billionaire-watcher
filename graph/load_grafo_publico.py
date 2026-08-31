"""Load graph/grafo-publico.json into a running Memgraph (Bolt)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from neo4j import GraphDatabase
from neo4j.exceptions import ClientError

GRAPH_DIR = Path(__file__).resolve().parent
DEFAULT_JSON = GRAPH_DIR / "grafo-publico.json"
BATCH = 500


def chunks(rows: list[dict], size: int = BATCH):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def node_row(node: dict) -> dict:
    name = node["label"]
    return {"id": node["id"], "kind": node["kind"], "label": name, "name": name}


def edge_name(edge: dict) -> str:
    kind = edge.get("kind") or "owns"
    who = "pessoa" if kind == "person_owns" else "empresa" if kind == "company_owns" else kind
    votos = edge.get("pct_votos")
    if votos is None:
        return who
    return f"{who} {votos:g}%"


def edge_row(edge: dict) -> dict:
    return {
        "from": edge["from"],
        "to": edge["to"],
        "kind": edge.get("kind"),
        "source": edge.get("source"),
        "pct_capital": edge.get("pct_capital"),
        "pct_votos": edge.get("pct_votos"),
        "name": edge_name(edge),
    }


def load(uri: str, json_path: Path) -> None:
    graph = json.loads(json_path.read_text())
    nodes = graph["nodes"]
    edges = graph["edges"]
    persons = [node_row(n) for n in nodes if n.get("kind") == "person"]
    companies = [node_row(n) for n in nodes if n.get("kind") != "person"]
    rels = [edge_row(e) for e in edges]

    driver = GraphDatabase.driver(uri, auth=None)
    driver.verify_connectivity()
    with driver.session() as session:
        for label in ("Pessoa", "Empresa"):
            try:
                session.run(f"CREATE INDEX ON :{label}(id)")
            except ClientError as exc:
                if "already" not in str(exc).lower() and "exists" not in str(exc).lower():
                    raise
        for batch in chunks(persons):
            session.run(
                """
                UNWIND $rows AS row
                MERGE (n:Pessoa {id: row.id})
                SET n.name = row.name, n.label = row.label, n.kind = row.kind
                """,
                rows=batch,
            )
        for batch in chunks(companies):
            session.run(
                """
                UNWIND $rows AS row
                MERGE (n:Empresa {id: row.id})
                SET n.name = row.name, n.label = row.label, n.kind = row.kind
                """,
                rows=batch,
            )
        for batch in chunks(rels):
            session.run(
                """
                UNWIND $rows AS row
                MATCH (a {id: row.from})
                MATCH (b {id: row.to})
                MERGE (a)-[r:OWNS]->(b)
                SET r.name = row.name,
                    r.label = row.name,
                    r.kind = row.kind,
                    r.source = row.source,
                    r.pct_capital = row.pct_capital,
                    r.pct_votos = row.pct_votos
                """,
                rows=batch,
            )
        counts = session.run(
            """
            MATCH (n)
            WITH count(n) AS nodes
            MATCH ()-[r:OWNS]->()
            RETURN nodes, count(r) AS edges
            """
        ).single()
    driver.close()
    print(f"loaded {json_path.name}: {counts['nodes']} nodes, {counts['edges']} edges")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uri", default="bolt://localhost:7687")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    args = parser.parse_args()
    load(args.uri, args.json.resolve())


if __name__ == "__main__":
    main()
