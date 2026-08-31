#!/usr/bin/env python3
"""Generate colocated staging YAML from architecture CSVs."""

from __future__ import annotations

import csv
from pathlib import Path
from textwrap import indent

ROOT = Path(__file__).resolve().parents[1]
ARCH = ROOT / "architecture"
STAGING = ROOT / "models" / "staging"

RF_WHERE = "data = '{{ var('rf_partition_date') }}'"

MODELS: dict[str, dict] = {
    "stg_valor_empresa_inventario": {
        "org": "valor",
        "description": (
            "Valor 1000 walk inventory (seed A), typed and renamed. "
            "One row per inventory company. identificador is not unique: "
            "the sentinel vazio is shared by companies without a CNPJ, and a "
            "handful of names repeat. Hygiene only — no seed filter."
        ),
        "not_null": ["ano", "nome", "identificador"],
        "accepted": {
            "tipo_societario": [
                "sociedade anônima aberta",
                "sociedade anônima fechada",
                "desconhecido",
            ],
            "indicador_grafo": ["sim", "não"],
            "situacao_passeio": [
                "só inventário",
                "árvore no grafo",
                "pulada-já-semente",
                "grupo sem sócio",
                "buraco",
                "inventário-fechada-não-andar",
            ],
            "indicador_formulario": ["sim", "não", "buraco"],
        },
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "id_cnpj is 14 digits when the inventory key is a CNPJ. Canonical JBS is 02916265000160.",
            )
        ],
    },
    "stg_cvm_cia_aberta": {
        "org": "cvm",
        "description": (
            "CVM listed-company registry (cad_cia_aberta), typed and renamed. "
            "One row per issuer. SIT = ATIVO is the seed-B cut and is not applied here."
        ),
        "unique": ["id_cvm"],
        "not_null": ["ano", "id_cnpj", "id_cvm", "razao_social"],
        "accepted": {
            "tipo_controle_acionario": ["PRIVADO", "ESTATAL", "ESTRANGEIRO"],
        },
        "accepted_warn": True,
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Issuer CNPJ is 14 digits. Canonical JBS is 02916265000160.",
            )
        ],
    },
    "stg_cvm_fre_posicao_acionaria": {
        "org": "cvm",
        "description": (
            "FRE shareholder positions, typed and renamed. One row per "
            "(company, document, shareholder). Walk later keeps max(id_documento) "
            "per company. Controller / 10% ON cuts are not applied here."
        ),
        "unique_combo": ["id_cnpj", "data_referencia", "id_documento", "id_acionista"],
        "not_null": ["ano", "id_cnpj", "id_documento", "id_acionista"],
        "accepted": {
            "indicador_acionista_controlador": ["S", "N"],
            "indicador_participante_acordo_acionistas": ["S", "N"],
        },
        "accepted_warn": True,
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Issuer CNPJ is 14 digits.",
            ),
            (
                "proporcao_acao_ordinaria_circulacao is null or (proporcao_acao_ordinaria_circulacao >= 0 and proporcao_acao_ordinaria_circulacao <= 100)",
                "Ordinary-share percent is on the 0-100 scale.",
            ),
            (
                "proporcao_total_acao_circulacao is null or (proporcao_total_acao_circulacao >= 0 and proporcao_total_acao_circulacao <= 100)",
                "Total-share percent is on the 0-100 scale.",
            ),
        ],
        "relationships": [
            {
                "column": "id_cnpj",
                "to": "ref('stg_cvm_cia_aberta')",
                "field": "id_cnpj",
                "severity": "warn",
            }
        ],
    },
    "stg_cvm_fre_capital_social": {
        "org": "cvm",
        "description": (
            "FRE capital social (item 17.1), typed and renamed. "
            "Autorizado / Emitido / Subscrito / Integralizado are views, not addends."
        ),
        "unique_combo": ["id_cnpj", "id_documento", "tipo_capital", "id_capital_social"],
        "not_null": ["ano", "id_cnpj", "id_documento", "tipo_capital"],
        "accepted": {
            "tipo_capital": ["Autorizado", "Emitido", "Subscrito", "Integralizado"],
        },
        "accepted_warn": True,
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Issuer CNPJ is 14 digits.",
            )
        ],
    },
    "stg_cvm_fca_valor_mobiliario": {
        "org": "cvm",
        "description": (
            "FCA securities file used to map ticker to CNPJ. "
            "Bolsa / still-listed filters belong in the floor model, not here."
        ),
        "not_null": ["ano", "id_cnpj", "id_documento"],
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Issuer CNPJ is 14 digits.",
            )
        ],
        "relationships": [
            {
                "column": "ticker",
                "to": "ref('stg_b3_cotahist')",
                "field": "ticker",
                "severity": "warn",
            }
        ],
    },
    "stg_bcb_entidade_supervisionada": {
        "org": "bcb",
        "description": (
            "BCB Unicad supervised entities, typed and renamed. "
            "Seed-B tipo/situação/0001 filters are not applied here."
        ),
        "unique": ["id_cnpj"],
        "not_null": ["id_cnpj", "cnpj_basico"],
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Unicad line CNPJ is 14 digits.",
            ),
            (
                "cnpj_basico is null or length(cnpj_basico) = 8",
                "Institution CNPJ is 8 digits.",
            ),
        ],
    },
    "stg_bcb_ifdata_cadastro": {
        "org": "bcb",
        "description": (
            "IF.data quarter registry mapping reporter codes to the leading CNPJ8. "
            "Situacao = A is applied in the floor model."
        ),
        "unique": ["id_instituicao"],
        "not_null": ["id_instituicao"],
    },
    "stg_bcb_ifdata_ativo_total": {
        "org": "bcb",
        "description": (
            "IF.data Relatorio 2 Conta 140220 (Ativo Total), prudential grain. "
            "The landed extract is already TipoInstituicao=1."
        ),
        "unique_combo": ["tipo_instituicao", "id_instituicao", "ano_mes", "conta"],
        "not_null": ["id_instituicao", "ano_mes", "conta"],
    },
    "stg_susep_dado_cadastral": {
        "org": "susep",
        "description": (
            "SUSEP DadosCadastrais dump (no $top), typed and renamed. "
            "mercodigo in {1,2,3,4,6} is the seed-B cut and is not applied here."
        ),
        "unique": ["id_cnpj"],
        "not_null": ["ano", "id_cnpj", "nome"],
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Supervised-entity CNPJ is 14 digits.",
            )
        ],
    },
    "stg_susep_receita_seguro": {
        "org": "susep",
        "description": (
            "SUSEP ReceitasSeguros emitted premiums. Not SES premio_ganho. "
            "One row per insurer × month × group × ramo."
        ),
        "unique_combo": ["id_cnpj", "mes_referencia", "grupo", "ramo"],
        "not_null": ["ano", "id_cnpj"],
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Insurer CNPJ is 14 digits.",
            )
        ],
    },
    "stg_b3_empresa_listada": {
        "org": "b3",
        "description": (
            "B3 GetInitialCompanies rows. Landed extract is already type=1."
        ),
        "unique": ["id_cnpj"],
        "not_null": ["ano", "id_cnpj", "codigo_emissor"],
        "expressions": [
            (
                "id_cnpj is null or length(id_cnpj) = 14",
                "Listed-issuer CNPJ is 14 digits.",
            )
        ],
    },
    "stg_b3_empresa_listada_complemento": {
        "org": "b3",
        "description": (
            "B3 GetListedSupplementCompany share quantities. "
            "Brazilian thousands/decimal are parsed when present."
        ),
        "unique": ["codigo_emissor"],
        "not_null": ["ano", "codigo_emissor"],
    },
    "stg_b3_cotahist": {
        "org": "b3",
        "description": (
            "COTAHIST official close for vista lote-padrão (TPMERC=010, CODBDI=02). "
            "PREULT is integer cents in raw; preco_fechamento is BRL. "
            "This is not basedosdados.br_b3_cotacoes.cotacoes."
        ),
        "unique_combo": ["ticker", "data_pregao"],
        "not_null": ["ticker", "data_pregao", "preco_fechamento"],
        "expressions": [
            (
                "preco_fechamento is null or preco_fechamento >= 0",
                "Official close cannot be negative.",
            )
        ],
    },
    "stg_rf_socio": {
        "org": "rf",
        "description": (
            "Receita QSA partners at rf_partition_date, copied from "
            "basedosdados.br_me_cnpj.socios. One row per partner citation. "
            "No natural primary key. Ownership qualificacao filter is not applied."
        ),
        "not_null": ["data", "cnpj_basico"],
        "accepted": {"tipo": ["1", "2", "3"]},
        "where": RF_WHERE,
        "expressions": [
            (
                "cnpj_basico is null or length(cnpj_basico) = 8",
                "cnpj_basico is 8 digits.",
            )
        ],
    },
    "stg_rf_empresa": {
        "org": "rf",
        "description": (
            "Receita company registry at rf_partition_date, copied from "
            "basedosdados.br_me_cnpj.empresas. One row per cnpj_basico. "
            "natureza_juridica 2054 (SA fechada) stays in staging."
        ),
        "unique_combo": ["data", "cnpj_basico"],
        "not_null": ["data", "cnpj_basico"],
        "accepted": {"porte": ["00", "01", "03", "05"]},
        "accepted_warn": True,
        "where": RF_WHERE,
        "expressions": [
            (
                "cnpj_basico is null or length(cnpj_basico) = 8",
                "cnpj_basico is 8 digits.",
            )
        ],
    },
    "stg_rf_estabelecimento": {
        "org": "rf",
        "description": (
            "Receita establishments at rf_partition_date, copied from "
            "basedosdados.br_me_cnpj.estabelecimentos. One row per 14-digit cnpj."
        ),
        "unique_combo": ["data", "cnpj"],
        "not_null": ["data", "cnpj", "cnpj_basico"],
        "accepted": {"identificador_matriz_filial": ["1", "2"]},
        "accepted_warn": True,
        "where": RF_WHERE,
        "expressions": [
            (
                "cnpj is null or length(cnpj) = 14",
                "Establishment CNPJ is 14 digits.",
            )
        ],
    },
}


def load_architecture(name: str) -> list[dict[str, str]]:
    with (ARCH / f"{name}.csv").open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def yaml_escape(text: str) -> str:
    return text.replace(":", " ").replace("\n", " ")


def emit_column(col: dict[str, str], meta: dict) -> str:
    name = col["name"]
    desc = col["description"].replace("\n", " ")
    lines = [
        f"      - name: {name}",
        f"        data_type: {col['bigquery_type']}",
        f"        description: >",
        indent(desc, "          "),
    ]
    tests: list[str] = []
    where = meta.get("where")

    def with_where(test_name: str) -> list[str]:
        if not where:
            return [f"          - {test_name}"]
        return [
            f"          - {test_name}:",
            "              config:",
            f"                where: \"{where}\"",
        ]

    if name in meta.get("unique", []):
        tests.extend(with_where("unique"))
    if name in meta.get("not_null", []):
        tests.extend(with_where("not_null"))
    if name in meta.get("accepted", {}):
        values = meta["accepted"][name]
        quoted = ", ".join(f"'{v}'" for v in values)
        block = [
            "          - accepted_values:",
            "              arguments:",
            f"                values: [{quoted}]",
        ]
        if meta.get("accepted_warn") or where:
            block.append("              config:")
            if meta.get("accepted_warn"):
                block.append("                severity: warn")
            if where:
                block.append(f"                where: \"{where}\"")
        tests.extend(block)
    for rel in meta.get("relationships", []):
        if rel["column"] != name:
            continue
        tests.extend(
            [
                "          - relationships:",
                "              arguments:",
                f"                to: {rel['to']}",
                f"                field: {rel['field']}",
                "              config:",
                f"                severity: {rel['severity']}",
            ]
        )
    if tests:
        lines.append("        data_tests:")
        lines.extend(tests)
    return "\n".join(lines)


def emit_model(name: str, meta: dict) -> str:
    cols = load_architecture(name)
    parts = [
        f"  - name: {name}",
        "    description: >",
        indent(meta["description"], "      "),
        "    config:",
        "      contract:",
        "        enforced: true",
    ]
    table_tests: list[str] = []
    if meta.get("unique_combo"):
        combo = meta["unique_combo"]
        where = meta.get("where")
        table_tests.extend(
            [
                "      - dbt_utils.unique_combination_of_columns:",
                "          arguments:",
                "            combination_of_columns:",
            ]
        )
        table_tests.extend(f"              - {c}" for c in combo)
        if where:
            table_tests.append("          config:")
            table_tests.append(f"            where: \"{where}\"")
    for expr, desc in meta.get("expressions", []):
        where = meta.get("where")
        table_tests.extend(
            [
                "      - dbt_utils.expression_is_true:",
                "          arguments:",
                f"            expression: \"{expr}\"",
                "          description: >",
                indent(desc, "            "),
            ]
        )
        if where:
            table_tests.append("          config:")
            table_tests.append(f"            where: \"{where}\"")
    if table_tests:
        parts.append("    data_tests:")
        parts.extend(table_tests)
    parts.append("    columns:")
    parts.extend(emit_column(col, meta) for col in cols)
    return "\n".join(parts)


def main() -> None:
    by_org: dict[str, list[str]] = {}
    for name, meta in MODELS.items():
        by_org.setdefault(meta["org"], []).append(name)

    for org, names in by_org.items():
        path = STAGING / org / f"_stg_{org}.yml"
        body = ["version: 2", "", "models:"]
        body.extend(emit_model(name, MODELS[name]) for name in names)
        path.write_text("\n".join(body) + "\n", encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
