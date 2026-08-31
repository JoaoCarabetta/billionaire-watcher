#!/usr/bin/env python3
"""Load landed source files and the Receita partition into billionairewatcher.raw.

dbt does not transform these tables. Every CSV column is loaded as STRING so
CNPJ and CPF keep leading zeros. The Receita snapshot is a copy of one
Base dos Dados partition, not a live query.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from google.cloud import bigquery, storage
from google.oauth2 import service_account


PROJECT = "billionairewatcher"
DATASET = "raw"
LOCATION = "US"
BUCKET = "billionairewatcher-landing"
RF_PROJECT = "basedosdados"
RF_DATASET = "br_me_cnpj"
DEFAULT_RF_PARTITION = "2026-01-11"


@dataclass(frozen=True)
class CsvSource:
    table: str
    origin: str
    gcs_path: str
    encoding: str
    field_delimiter: str
    source_url: str
    as_of_date: str


CSV_SOURCES: tuple[CsvSource, ...] = (
    CsvSource(
        table="valor_ranking_2025",
        origin="valor",
        gcs_path="raw/valor/2025/ranking.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url="repository:data/valor1000-2025/ranking.csv",
        as_of_date="2025",
    ),
    CsvSource(
        table="valor_bancos_2025",
        origin="valor",
        gcs_path="raw/valor/2025/bancos.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url="repository:data/valor1000-2025/bancos.csv",
        as_of_date="2025",
    ),
    CsvSource(
        table="valor_seguradoras_2025",
        origin="valor",
        gcs_path="raw/valor/2025/seguradoras.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url="repository:data/valor1000-2025/seguradoras.csv",
        as_of_date="2025",
    ),
    CsvSource(
        table="valor_controle_empresas_walk",
        origin="valor",
        gcs_path="raw/fase1/controle-empresas-walk.csv",
        encoding="utf-8",
        field_delimiter=";",
        source_url="repository:data/controle-empresas-walk.csv",
        as_of_date="2025",
    ),
    CsvSource(
        table="cvm_cad_cia_aberta",
        origin="cvm",
        gcs_path="raw/cvm/fre/2026/cad_cia_aberta.csv",
        encoding="iso-8859-1",
        field_delimiter=";",
        source_url="https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv",
        as_of_date="2026",
    ),
    CsvSource(
        table="cvm_fre_posicao_acionaria_2026",
        origin="cvm",
        gcs_path="raw/cvm/fre/2026/fre_cia_aberta_posicao_acionaria_2026.csv",
        encoding="iso-8859-1",
        field_delimiter=";",
        source_url="https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre",
        as_of_date="2026",
    ),
    CsvSource(
        table="cvm_fre_capital_social_2026",
        origin="cvm",
        gcs_path="raw/cvm/fre/2026/fre_cia_aberta_capital_social_2026.csv",
        encoding="iso-8859-1",
        field_delimiter=";",
        source_url="https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre",
        as_of_date="2026",
    ),
    CsvSource(
        table="cvm_fca_valor_mobiliario_2026",
        origin="cvm",
        gcs_path="raw/fase1/pisos/cvm_fca_valor_mobiliario_2026.csv",
        encoding="iso-8859-1",
        field_delimiter=";",
        source_url="https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca",
        as_of_date="2026",
    ),
    CsvSource(
        table="bcb_entidades_supervisionadas",
        origin="bcb",
        gcs_path="raw/fase1/bcb_entidades_supervisionadas.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://olinda.bcb.gov.br/olinda/servico/BcBase/versao/v2/odata/"
            "EntidadesSupervisionadas(dataBase=@dataBase)"
        ),
        as_of_date="2026-08-01",
    ),
    CsvSource(
        table="bcb_ifdata_cadastro",
        origin="bcb",
        gcs_path="raw/fase1/pisos/ifdata_cadastro.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/"
            "IfDataCadastro"
        ),
        as_of_date="2026-03",
    ),
    CsvSource(
        table="bcb_ifdata_ativo_total_prudencial",
        origin="bcb",
        gcs_path="raw/fase1/pisos/ifdata_ativo_total_prudencial.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/"
            "IfDataValores"
        ),
        as_of_date="2026-03",
    ),
    CsvSource(
        table="susep_dados_cadastrais",
        origin="susep",
        gcs_path="raw/fase1/susep_dados_cadastrais.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://dados.susep.gov.br/olinda/servico/empresas/versao/v1/"
            "odata/DadosCadastrais"
        ),
        as_of_date="2026",
    ),
    CsvSource(
        table="susep_receitas_seguros_2026",
        origin="susep",
        gcs_path="raw/fase1/pisos/susep_receitas_seguros_2026.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://dados.susep.gov.br/olinda/servico/receitasoperacionais/"
            "versao/v1/odata/ReceitasSeguros(Ano=@Ano)"
        ),
        as_of_date="2026",
    ),
    CsvSource(
        table="b3_listed_companies",
        origin="b3",
        gcs_path="raw/fase1/pisos/b3_listed_companies.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/"
            "CompanyCall/GetInitialCompanies"
        ),
        as_of_date="2026",
    ),
    CsvSource(
        table="b3_listed_supplement",
        origin="b3",
        gcs_path="raw/fase1/pisos/b3_listed_supplement.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url=(
            "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/"
            "CompanyCall/GetListedSupplementCompany"
        ),
        as_of_date="2026",
    ),
    CsvSource(
        table="b3_cotahist_2026",
        origin="b3",
        gcs_path="raw/fase1/pisos/b3_cotahist_2026.csv",
        encoding="utf-8",
        field_delimiter=",",
        source_url="https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A2026.ZIP",
        as_of_date="2026",
    ),
)

RF_TABLES: tuple[tuple[str, str], ...] = (
    ("rf_socios", "socios"),
    ("rf_empresas", "empresas"),
    ("rf_estabelecimentos", "estabelecimentos"),
)


def credentials_from_args(key_file: str | None) -> Any:
    if key_file:
        return service_account.Credentials.from_service_account_file(key_file)
    return None


def clients(project: str, creds: Any) -> tuple[bigquery.Client, storage.Client]:
    return (
        bigquery.Client(project=project, credentials=creds, location=LOCATION),
        storage.Client(project=project, credentials=creds),
    )


def ensure_dataset(bq: bigquery.Client, project: str, dataset_id: str) -> None:
    dataset_ref = bigquery.Dataset(f"{project}.{dataset_id}")
    dataset_ref.location = LOCATION
    bq.create_dataset(dataset_ref, exists_ok=True)


def header_and_sha256(blob: storage.Blob, encoding: str, delimiter: str) -> tuple[list[str], str]:
    payload = blob.download_as_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    text = payload.decode(encoding)
    if text.startswith("\ufeff"):
        text = text.lstrip("\ufeff")
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration as exc:
        raise RuntimeError(f"{blob.name} has no header row") from exc
    columns = [column.strip() or f"_col_{index}" for index, column in enumerate(header)]
    if not columns:
        raise RuntimeError(f"{blob.name} header is empty")
    return columns, digest


def load_csv(
    bq: bigquery.Client,
    gcs: storage.Client,
    source: CsvSource,
    project: str,
    dataset: str,
) -> dict[str, Any]:
    blob = gcs.bucket(BUCKET).blob(source.gcs_path)
    if not blob.exists():
        raise FileNotFoundError(f"gs://{BUCKET}/{source.gcs_path}")
    columns, digest = header_and_sha256(blob, source.encoding, source.field_delimiter)
    table_id = f"{project}.{dataset}.{source.table}"
    job_config = bigquery.LoadJobConfig(
        schema=[bigquery.SchemaField(column, "STRING") for column in columns],
        source_format=bigquery.SourceFormat.CSV,
        skip_leading_rows=1,
        field_delimiter=source.field_delimiter,
        encoding="ISO-8859-1" if source.encoding.lower() in {"iso-8859-1", "latin-1"} else "UTF-8",
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        allow_quoted_newlines=True,
        allow_jagged_rows=True,
    )
    uri = f"gs://{BUCKET}/{source.gcs_path}"
    bq.load_table_from_uri(uri, table_id, job_config=job_config).result()
    table = bq.get_table(table_id)
    return {
        "table_name": source.table,
        "origin": source.origin,
        "source_url": source.source_url,
        "as_of_date": source.as_of_date,
        "gcs_uri": uri,
        "sha256": digest,
        "row_count": table.num_rows,
    }


def copy_rf_partition(
    bq: bigquery.Client,
    project: str,
    dataset: str,
    dest_table: str,
    source_table: str,
    partition_date: str,
) -> dict[str, Any]:
    table_id = f"{project}.{dataset}.{dest_table}"
    source_id = f"{RF_PROJECT}.{RF_DATASET}.{source_table}"
    sql = f"""
    create or replace table `{table_id}`
    as
    select *
    from `{source_id}`
    where data = date '{partition_date}'
    """
    bq.query(sql).result()
    table = bq.get_table(table_id)
    return {
        "table_name": dest_table,
        "origin": "rf",
        "source_url": f"bigquery://{source_id}",
        "as_of_date": partition_date,
        "gcs_uri": None,
        "sha256": None,
        "row_count": table.num_rows,
    }


def write_manifest(
    bq: bigquery.Client,
    project: str,
    dataset: str,
    rows: list[dict[str, Any]],
    loaded_at: datetime,
) -> None:
    table_id = f"{project}.{dataset}._manifest"
    job_config = bigquery.LoadJobConfig(
        schema=[
            bigquery.SchemaField("table_name", "STRING"),
            bigquery.SchemaField("origin", "STRING"),
            bigquery.SchemaField("source_url", "STRING"),
            bigquery.SchemaField("as_of_date", "STRING"),
            bigquery.SchemaField("gcs_uri", "STRING"),
            bigquery.SchemaField("sha256", "STRING"),
            bigquery.SchemaField("row_count", "INT64"),
            bigquery.SchemaField("loaded_at", "TIMESTAMP"),
        ],
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    payload = [
        {**row, "loaded_at": loaded_at.isoformat().replace("+00:00", "Z")}
        for row in rows
    ]
    bq.load_table_from_json(payload, table_id, job_config=job_config).result()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=PROJECT)
    parser.add_argument("--dataset", default=DATASET)
    parser.add_argument("--rf-partition-date", default=DEFAULT_RF_PARTITION)
    parser.add_argument("--credentials", help="Service account JSON path.")
    parser.add_argument("--skip-csv", action="store_true")
    parser.add_argument("--skip-rf", action="store_true")
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Rewrite _manifest from tables already in raw; do not reload sources.",
    )
    args = parser.parse_args()

    creds = credentials_from_args(args.credentials)
    bq, gcs = clients(args.project, creds)
    ensure_dataset(bq, args.project, args.dataset)
    loaded_at = datetime.now(timezone.utc)
    rows: list[dict[str, Any]] = []

    if args.manifest_only:
        for source in CSV_SOURCES:
            table = bq.get_table(f"{args.project}.{args.dataset}.{source.table}")
            blob = gcs.bucket(BUCKET).blob(source.gcs_path)
            _columns, digest = header_and_sha256(
                blob, source.encoding, source.field_delimiter
            )
            rows.append(
                {
                    "table_name": source.table,
                    "origin": source.origin,
                    "source_url": source.source_url,
                    "as_of_date": source.as_of_date,
                    "gcs_uri": f"gs://{BUCKET}/{source.gcs_path}",
                    "sha256": digest,
                    "row_count": table.num_rows,
                }
            )
        for dest_table, source_table in RF_TABLES:
            table = bq.get_table(f"{args.project}.{args.dataset}.{dest_table}")
            rows.append(
                {
                    "table_name": dest_table,
                    "origin": "rf",
                    "source_url": f"bigquery://{RF_PROJECT}.{RF_DATASET}.{source_table}",
                    "as_of_date": args.rf_partition_date,
                    "gcs_uri": None,
                    "sha256": None,
                    "row_count": table.num_rows,
                }
            )
    else:
        if not args.skip_csv:
            for source in CSV_SOURCES:
                print(f"loading {source.table} from gs://{BUCKET}/{source.gcs_path}")
                rows.append(load_csv(bq, gcs, source, args.project, args.dataset))

        if not args.skip_rf:
            for dest_table, source_table in RF_TABLES:
                print(
                    f"copying {dest_table} from "
                    f"{RF_PROJECT}.{RF_DATASET}.{source_table} "
                    f"data={args.rf_partition_date}"
                )
                rows.append(
                    copy_rf_partition(
                        bq,
                        args.project,
                        args.dataset,
                        dest_table,
                        source_table,
                        args.rf_partition_date,
                    )
                )

    write_manifest(bq, args.project, args.dataset, rows, loaded_at)
    print(json.dumps(rows, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
