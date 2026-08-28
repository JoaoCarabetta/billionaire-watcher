#!/usr/bin/env python3
"""Export fase-1 warehouse tables to static JSON shards for site/.

Never selects cpf, filiacao, or data_nascimento. RF edges stay papel=socio
as stored in vinculos; this script does not invent roles.

Usage:
  GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \\
    python3 scripts/export_site_data.py --out site/dados
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

FORBIDDEN_COLUMNS = ("cpf", "filiacao", "data_nascimento")
FORBIDDEN_SQL = re.compile(
    r"\b(cpf|filiacao|data_nascimento)\b", re.IGNORECASE
)
CPF_11 = re.compile(r"(?<!\d)\d{11}(?!\d)")
PUBLIC_TEXT_KEYS = frozenset(
    {
        "nome",
        "origem_nome",
        "destino_nome",
        "semente_nome",
        "fonte_documento",
        "fonte_do_piso",
        "papel",
        "fonte",
        "regra_do_passo",
        "motivo_entrada",
    }
)
BUCKETS = 512
MAX_CHAINS_PER_PERSON = 50
PROJECT = "billionairewatcher"
DATASET = "billionaire_watcher"


def bucket_id(entity_id: str, buckets: int = BUCKETS) -> str:
    """FNV-1a 32-bit over UTF-16 code units, matching site/js/data.js."""
    h = 2166136261
    for ch in entity_id:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return f"{h % buckets:03x}"


def normalize_name(name: str) -> str:
    stripped = unicodedata.normalize("NFKD", name or "")
    ascii_only = "".join(ch for ch in stripped if not unicodedata.combining(ch))
    return "".join(ch for ch in ascii_only.upper() if ch.isalnum())


def search_prefix(name: str) -> str:
    key = normalize_name(name)
    return key[:2] if len(key) >= 2 else (key or "_")


def public_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = CPF_11.sub("", value)
    return re.sub(r"\s+", " ", cleaned).strip()


def redact_public_fields(payload):
    """Strip 11-digit tokens from public text keys before any shard is written."""
    if isinstance(payload, dict):
        out = {}
        for key, value in payload.items():
            if key in PUBLIC_TEXT_KEYS and isinstance(value, str):
                out[key] = public_text(value)
            else:
                out[key] = redact_public_fields(value)
        return out
    if isinstance(payload, list):
        return [redact_public_fields(item) for item in payload]
    return payload


def _assert_safe_sql(sql: str) -> None:
    if FORBIDDEN_SQL.search(sql):
        raise SystemExit(
            "export SQL must not mention cpf, filiacao, or data_nascimento"
        )


def _client():
    from google.cloud import bigquery
    from google.oauth2 import service_account

    key = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key and Path(key).is_file():
        creds = service_account.Credentials.from_service_account_file(key)
        return bigquery.Client(credentials=creds, project=PROJECT)
    return bigquery.Client(project=PROJECT)


def _table(name: str) -> str:
    return f"`{PROJECT}.{DATASET}.{name}`"


def _query(client, sql: str):
    _assert_safe_sql(sql)
    return client.query(sql).result()


def _num(value):
    if value is None:
        return None
    return float(value)


def export(out_dir: Path) -> None:
    client = _client()
    pessoas: dict[str, dict] = {}
    empresas: dict[str, dict] = {}

    print("query pessoas", file=sys.stderr)
    for row in _query(
        client,
        f"""
        SELECT
          pessoa_id,
          nome,
          e_oligarca,
          CAST(fortuna_valor AS FLOAT64) AS fortuna_valor,
          fortuna_incompleta
        FROM {_table("pessoas")}
        """,
    ):
        pessoas[row.pessoa_id] = {
            "id": row.pessoa_id,
            "kind": "pessoa",
            "nome": public_text(row.nome),
            "e_oligarca": bool(row.e_oligarca),
            "fortuna_valor": _num(row.fortuna_valor),
            "fortuna_incompleta": bool(row.fortuna_incompleta),
        }

    print(f"  {len(pessoas)} pessoas", file=sys.stderr)

    print("query empresas", file=sys.stderr)
    for row in _query(
        client,
        f"""
        SELECT
          empresa_id,
          cnpj,
          razao_social,
          motivo_entrada,
          em_semente_a,
          CAST(valor_do_piso AS FLOAT64) AS valor_do_piso,
          fonte_do_piso,
          tem_piso
        FROM {_table("empresas")}
        """,
    ):
        empresas[row.empresa_id] = {
            "id": row.empresa_id,
            "kind": "empresa",
            "nome": public_text(row.razao_social),
            "cnpj": row.cnpj,
            "motivo_entrada": public_text(row.motivo_entrada),
            "em_semente_a": bool(row.em_semente_a),
            "valor_do_piso": _num(row.valor_do_piso),
            "fonte_do_piso": public_text(row.fonte_do_piso),
            "tem_piso": bool(row.tem_piso),
        }

    print(f"  {len(empresas)} empresas", file=sys.stderr)

    print("query oligarch path stats", file=sys.stderr)
    stats: dict[str, dict] = {}
    for row in _query(
        client,
        f"""
        SELECT
          pessoa_id,
          COUNT(DISTINCT percurso_id) AS n_percursos,
          ARRAY_AGG(DISTINCT empresa_semente_id ORDER BY empresa_semente_id LIMIT 12)
            AS sementes
        FROM {_table("percursos")}
        GROUP BY pessoa_id
        """,
    ):
        stats[row.pessoa_id] = {
            "n_percursos": int(row.n_percursos),
            "sementes": list(row.sementes or []),
        }

    oligarcas = []
    for person in pessoas.values():
        if not person["e_oligarca"]:
            continue
        extra = stats.get(person["id"], {"n_percursos": 0, "sementes": []})
        seed_names = []
        for seed_id in extra["sementes"]:
            company = empresas.get(seed_id)
            seed_names.append(
                {
                    "id": seed_id,
                    "nome": public_text(company["nome"] if company else seed_id),
                }
            )
        oligarcas.append(
            {
                "id": person["id"],
                "nome": person["nome"],
                "fortuna_valor": person["fortuna_valor"],
                "fortuna_incompleta": person["fortuna_incompleta"],
                "n_percursos": extra["n_percursos"],
                "sementes": seed_names,
            }
        )
    oligarcas.sort(
        key=lambda row: (
            -(row["fortuna_valor"] or -1),
            row["nome"],
        )
    )

    print("query capped percursos", file=sys.stderr)
    chains: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for row in _query(
        client,
        f"""
        WITH lengths AS (
          SELECT
            pessoa_id,
            percurso_id,
            MAX(passo) AS n_passos
          FROM {_table("percursos")}
          GROUP BY pessoa_id, percurso_id
        ),
        kept AS (
          SELECT pessoa_id, percurso_id
          FROM lengths
          QUALIFY ROW_NUMBER() OVER (
            PARTITION BY pessoa_id
            ORDER BY n_passos, percurso_id
          ) <= {MAX_CHAINS_PER_PERSON}
        )
        SELECT
          pe.pessoa_id,
          pe.empresa_semente_id,
          pe.percurso_id,
          pe.passo,
          pe.origem_tipo,
          pe.origem_pessoa_id,
          pe.origem_empresa_id,
          pe.destino_empresa_id,
          pe.papel,
          pe.fonte,
          CAST(pe.percentual_on AS FLOAT64) AS percentual_on,
          CAST(pe.percentual_total AS FLOAT64) AS percentual_total,
          pe.regra_do_passo,
          pe.fonte_documento
        FROM {_table("percursos")} AS pe
        INNER JOIN kept
          ON pe.pessoa_id = kept.pessoa_id
          AND pe.percurso_id = kept.percurso_id
        ORDER BY pe.pessoa_id, pe.percurso_id, pe.passo
        """,
    ):
        step = {
            "passo": int(row.passo),
            "origem_tipo": row.origem_tipo,
            "origem_id": row.origem_pessoa_id or row.origem_empresa_id,
            "destino_id": row.destino_empresa_id,
            "papel": public_text(row.papel),
            "fonte": public_text(row.fonte),
            "percentual_on": _num(row.percentual_on),
            "percentual_total": _num(row.percentual_total),
            "regra_do_passo": public_text(row.regra_do_passo),
            "fonte_documento": public_text(row.fonte_documento),
        }
        dest = empresas.get(row.destino_empresa_id)
        orig = None
        if row.origem_tipo == "pessoa":
            orig = pessoas.get(row.origem_pessoa_id)
        else:
            orig = empresas.get(row.origem_empresa_id)
        step["origem_nome"] = public_text(orig["nome"] if orig else step["origem_id"])
        step["destino_nome"] = public_text(
            dest["nome"] if dest else row.destino_empresa_id
        )
        seed = empresas.get(row.empresa_semente_id)
        chains[row.pessoa_id][row.percurso_id].append(
            {
                "empresa_semente_id": row.empresa_semente_id,
                "semente_nome": public_text(
                    seed["nome"] if seed else row.empresa_semente_id
                ),
                **step,
            }
        )

    for person_id, by_path in chains.items():
        packed = []
        for percurso_id, steps in by_path.items():
            steps.sort(key=lambda item: item["passo"])
            packed.append(
                {
                    "percurso_id": percurso_id,
                    "empresa_semente_id": steps[-1]["empresa_semente_id"],
                    "semente_nome": steps[-1]["semente_nome"],
                    "passos": [
                        {
                            key: step[key]
                            for key in (
                                "passo",
                                "origem_tipo",
                                "origem_id",
                                "origem_nome",
                                "destino_id",
                                "destino_nome",
                                "papel",
                                "fonte",
                                "percentual_on",
                                "percentual_total",
                                "regra_do_passo",
                                "fonte_documento",
                            )
                        }
                        for step in steps
                    ],
                }
            )
        packed.sort(key=lambda item: (len(item["passos"]), item["percurso_id"]))
        if person_id in pessoas:
            pessoas[person_id]["percursos"] = packed

    print("query vinculos", file=sys.stderr)
    adj: dict[str, list] = defaultdict(list)
    seen_adj: set[tuple] = set()
    for row in _query(
        client,
        f"""
        SELECT
          origem_tipo,
          origem_pessoa_id,
          origem_empresa_id,
          destino_empresa_id,
          papel,
          fonte,
          CAST(percentual_on AS FLOAT64) AS percentual_on,
          CAST(percentual_total AS FLOAT64) AS percentual_total
        FROM {_table("vinculos")}
        """,
    ):
        origin_id = row.origem_pessoa_id or row.origem_empresa_id
        dest_id = row.destino_empresa_id
        origin_kind = row.origem_tipo
        dest_kind = "empresa"
        origin_nome = (
            pessoas[origin_id]["nome"]
            if origin_kind == "pessoa" and origin_id in pessoas
            else empresas.get(origin_id, {}).get("nome", origin_id)
        )
        dest_nome = empresas.get(dest_id, {}).get("nome", dest_id)
        edge = {
            "papel": public_text(row.papel),
            "fonte": public_text(row.fonte),
            "percentual_on": _num(row.percentual_on),
            "percentual_total": _num(row.percentual_total),
        }
        forward = (origin_kind, origin_id, dest_kind, dest_id, "out")
        back = (dest_kind, dest_id, origin_kind, origin_id, "in")
        if forward not in seen_adj:
            seen_adj.add(forward)
            adj[_node_key(origin_kind, origin_id)].append(
                {
                    "id": dest_id,
                    "kind": dest_kind,
                    "nome": dest_nome,
                    "dir": "out",
                    **edge,
                }
            )
        if back not in seen_adj:
            seen_adj.add(back)
            adj[_node_key(dest_kind, dest_id)].append(
                {
                    "id": origin_id,
                    "kind": origin_kind,
                    "nome": origin_nome,
                    "dir": "in",
                    **edge,
                }
            )

    print("write shards", file=sys.stderr)
    e_dir = out_dir / "e"
    adj_dir = out_dir / "adj"
    busca_dir = out_dir / "busca"
    for folder in (e_dir, adj_dir, busca_dir):
        folder.mkdir(parents=True, exist_ok=True)
        for stale in folder.glob("*.json"):
            stale.unlink()

    e_buckets: dict[str, dict] = defaultdict(dict)
    for person in pessoas.values():
        e_buckets[bucket_id(person["id"])][_node_key("pessoa", person["id"])] = person
    for company in empresas.values():
        e_buckets[bucket_id(company["id"])][_node_key("empresa", company["id"])] = (
            company
        )

    adj_buckets: dict[str, dict] = defaultdict(dict)
    for key, neighbors in adj.items():
        kind, entity_id = key.split(":", 1)
        adj_buckets[bucket_id(entity_id)][key] = neighbors

    busca_buckets: dict[str, list] = defaultdict(list)
    for person in pessoas.values():
        busca_buckets[search_prefix(person["nome"])].append(
            {
                "id": person["id"],
                "kind": "pessoa",
                "nome": person["nome"],
                "e_oligarca": person["e_oligarca"],
            }
        )
    for company in empresas.values():
        busca_buckets[search_prefix(company["nome"])].append(
            {
                "id": company["id"],
                "kind": "empresa",
                "nome": company["nome"],
            }
        )

    def write_json(path: Path, payload) -> None:
        payload = redact_public_fields(payload)
        leak = _public_text_cpf(payload)
        if leak:
            raise SystemExit(f"refusing to write 11-digit sequence in {path}: {leak}")
        path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

    write_json(out_dir / "oligarcas.json", oligarcas)
    for name, payload in e_buckets.items():
        write_json(e_dir / f"{name}.json", payload)
    for name, payload in adj_buckets.items():
        write_json(adj_dir / f"{name}.json", payload)
    for name, payload in busca_buckets.items():
        payload.sort(key=lambda item: item["nome"])
        write_json(busca_dir / f"{name}.json", payload)

    meta = {
        "pessoas": len(pessoas),
        "empresas": len(empresas),
        "oligarcas": len(oligarcas),
        "e_shards": len(e_buckets),
        "adj_shards": len(adj_buckets),
        "busca_shards": len(busca_buckets),
        "max_chains_per_person": MAX_CHAINS_PER_PERSON,
    }
    write_json(out_dir / "meta.json", meta)
    print(json.dumps(meta, indent=2))


def _public_text_cpf(payload) -> str | None:
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in PUBLIC_TEXT_KEYS and isinstance(value, str) and CPF_11.search(value):
                return value
            found = _public_text_cpf(value)
            if found:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = _public_text_cpf(item)
            if found:
                return found
    return None


def _node_key(kind: str, entity_id: str) -> str:
    return f"{kind}:{entity_id}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("site/dados"),
        help="directory for JSON shards",
    )
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    export(args.out)


if __name__ == "__main__":
    main()
