#!/usr/bin/env python3
"""Land the raw inputs used by the fase 1 company size floors.

The downloader deliberately does not calculate a floor. It preserves source
fields in CSV files; dbt owns normalization, joins, source precedence, and
aggregation at CNPJ grain.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import json
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


B3_BASE_URL = (
    "https://sistemaswebb3-listados.b3.com.br/"
    "listedCompaniesProxy/CompanyCall"
)
B3_INITIAL_URL = f"{B3_BASE_URL}/GetInitialCompanies"
B3_SUPPLEMENT_URL = f"{B3_BASE_URL}/GetListedSupplementCompany"
COTAHIST_URL_TEMPLATE = (
    "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{year}.ZIP"
)
CVM_FCA_URL_TEMPLATE = (
    "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/"
    "fca_cia_aberta_{year}.zip"
)
IFDATA_BASE_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata"
)
SUSEP_RECEITAS_URL = (
    "https://dados.susep.gov.br/olinda/servico/"
    "receitasoperacionais/versao/v1/odata/ReceitasSeguros(Ano=@Ano)"
)

IFDATA_GRAIN = "prudencial"
IFDATA_TIPO_INSTITUICAO = 1
IFDATA_RELATORIO = "2"
IFDATA_CONTA = "140220"

B3_COMPANY_COLUMNS = (
    "codeCVM",
    "issuingCompany",
    "companyName",
    "tradingName",
    "cnpj",
    "type",
)
B3_SUPPLEMENT_COLUMNS = (
    "code",
    "codeCVM",
    "tradingName",
    "numberCommonShares",
    "numberPreferredShares",
    "totalNumberShares",
)
COTAHIST_COLUMNS = (
    "DATA_PREGAO",
    "CODBDI",
    "CODNEG",
    "TPMERC",
    "PREULT",
    "NUMNEG",
)
IFDATA_CADASTRO_COLUMNS = (
    "CodInst",
    "Data",
    "NomeInstituicao",
    "CodConglomeradoPrudencial",
    "CnpjInstituicaoLider",
    "Situacao",
)
IFDATA_VALORES_COLUMNS = (
    "TipoInstituicao",
    "CodInst",
    "AnoMes",
    "NumeroRelatorio",
    "Conta",
    "NomeColuna",
    "Saldo",
)
SUSEP_RECEITAS_COLUMNS = (
    "entnome",
    "cnpj",
    "mesreferencia",
    "grupo",
    "ramo",
    "valor",
)


def fetch_bytes(url: str, attempts: int = 4) -> bytes:
    request = Request(
        url,
        headers={
            "Accept": "application/json, text/xml, application/xml, */*",
            "User-Agent": "billionaire-watcher/1.0",
        },
    )
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=180) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError):
            if attempt == attempts - 1:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def fetch_json(url: str) -> Any:
    return json.loads(fetch_bytes(url))


def encoded_b3_url(endpoint: str, payload: dict[str, Any]) -> str:
    compact_json = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    token = base64.b64encode(compact_json.encode("utf-8")).decode("ascii")
    return f"{endpoint}/{token}"


def fetch_b3_companies() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_number = 1
    total_pages = 1
    while page_number <= total_pages:
        # The request is explicitly type=1 as required by the B3 listed-company
        # contract. The API currently returns other types too, so enforce type=1
        # again on the response before calling the supplement endpoint.
        payload = {
            "language": "pt-br",
            "pageNumber": page_number,
            "pageSize": 120,
            "company": "",
            "tradingName": "",
            "cnpj": "",
            "industry": "",
            "segment": "",
            "type": 1,
        }
        response = fetch_json(encoded_b3_url(B3_INITIAL_URL, payload))
        page = response.get("page") or {}
        page_rows = response.get("results")
        if not isinstance(page_rows, list):
            raise RuntimeError("B3 GetInitialCompanies response has no results array")
        rows.extend(row for row in page_rows if str(row.get("type")) == "1")
        total_pages = int(page.get("totalPages") or 1)
        page_number += 1

    by_cnpj: dict[str, dict[str, Any]] = {}
    for row in rows:
        cnpj = "".join(character for character in str(row.get("cnpj") or "") if character.isdigit())
        if not cnpj:
            continue
        normalized = dict(row)
        normalized["cnpj"] = cnpj.zfill(14)
        by_cnpj[normalized["cnpj"]] = normalized
    return sorted(by_cnpj.values(), key=lambda row: str(row["cnpj"]))


def fetch_b3_supplement(issuing_company: str) -> dict[str, Any] | None:
    payload = {"issuingCompany": issuing_company, "language": "pt-br"}
    response = fetch_json(encoded_b3_url(B3_SUPPLEMENT_URL, payload))
    if not isinstance(response, list) or not response:
        return None
    return response[0]


def fetch_b3_supplements(
    companies: list[dict[str, Any]], workers: int
) -> list[dict[str, Any]]:
    codes = sorted(
        {
            str(row.get("issuingCompany") or "").strip()
            for row in companies
            if str(row.get("issuingCompany") or "").strip()
        }
    )
    with ThreadPoolExecutor(max_workers=workers) as pool:
        rows = list(pool.map(fetch_b3_supplement, codes))
    return sorted(
        (row for row in rows if row is not None),
        key=lambda row: str(row.get("code") or ""),
    )


def cotahist_rows(archive: bytes) -> Iterable[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        members = [name for name in zipped.namelist() if name.upper().endswith(".TXT")]
        if len(members) != 1:
            raise RuntimeError(f"expected one COTAHIST TXT member, found {members}")
        with zipped.open(members[0]) as source:
            for raw_line in source:
                line = raw_line.decode("latin-1").rstrip("\r\n")
                if (
                    len(line) < 152
                    or line[0:2] != "01"
                    or line[10:12] != "02"
                    or line[24:27] != "010"
                ):
                    continue
                yield {
                    "DATA_PREGAO": line[2:10],
                    "CODBDI": line[10:12],
                    "CODNEG": line[12:24].strip(),
                    "TPMERC": line[24:27],
                    # Official close in integer cents. dbt divides by 100.
                    "PREULT": line[108:121],
                    "NUMNEG": line[147:152],
                }


def extract_fca_member(archive: bytes, year: int, destination: Path) -> None:
    member = f"fca_cia_aberta_valor_mobiliario_{year}.csv"
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        if member not in zipped.namelist():
            raise RuntimeError(f"CVM FCA archive has no {member}")
        destination.write_bytes(zipped.read(member))


def fetch_odata(url: str) -> list[dict[str, Any]]:
    response = fetch_json(url)
    rows = response.get("value") if isinstance(response, dict) else None
    if not isinstance(rows, list):
        raise RuntimeError(f"OData response has no value array: {url}")
    return rows


def write_csv(
    path: Path,
    rows: Iterable[dict[str, Any]],
    columns: tuple[str, ...],
) -> int:
    count = 0
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument(
        "--ifdata-period",
        type=int,
        default=202603,
        help="Available IF.data quarter in YYYYMM form (default: 202603).",
    )
    parser.add_argument("--b3-workers", type=int, default=6)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("landing/fase1/pisos"),
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    companies = fetch_b3_companies()
    supplements = fetch_b3_supplements(companies, args.b3_workers)

    paths = {
        "b3_companies": args.output_dir / "b3_listed_companies.csv",
        "b3_supplements": args.output_dir / "b3_listed_supplement.csv",
        "cotahist": args.output_dir / f"b3_cotahist_{args.year}.csv",
        "fca": args.output_dir / f"cvm_fca_valor_mobiliario_{args.year}.csv",
        "ifdata_cadastro": args.output_dir / "ifdata_cadastro.csv",
        "ifdata_valores": args.output_dir / "ifdata_ativo_total_prudencial.csv",
        "susep": args.output_dir / f"susep_receitas_seguros_{args.year}.csv",
    }

    row_counts: dict[str, int] = {}
    row_counts["b3_listed_companies"] = write_csv(
        paths["b3_companies"], companies, B3_COMPANY_COLUMNS
    )
    row_counts["b3_listed_supplement"] = write_csv(
        paths["b3_supplements"], supplements, B3_SUPPLEMENT_COLUMNS
    )
    row_counts[f"b3_cotahist_{args.year}"] = write_csv(
        paths["cotahist"],
        cotahist_rows(fetch_bytes(COTAHIST_URL_TEMPLATE.format(year=args.year))),
        COTAHIST_COLUMNS,
    )
    extract_fca_member(
        fetch_bytes(CVM_FCA_URL_TEMPLATE.format(year=args.year)),
        args.year,
        paths["fca"],
    )
    with paths["fca"].open(encoding="latin-1", newline="") as source:
        row_counts[f"cvm_fca_valor_mobiliario_{args.year}"] = (
            sum(1 for _ in source) - 1
        )

    cadastro_url = (
        f"{IFDATA_BASE_URL}/IfDataCadastro(AnoMes={args.ifdata_period})?"
        f"{urlencode({'$format': 'json'})}"
    )
    cadastro = fetch_odata(cadastro_url)
    row_counts["ifdata_cadastro"] = write_csv(
        paths["ifdata_cadastro"], cadastro, IFDATA_CADASTRO_COLUMNS
    )

    ifdata_url = (
        f"{IFDATA_BASE_URL}/IfDataValores("
        f"AnoMes={args.ifdata_period},"
        f"TipoInstituicao={IFDATA_TIPO_INSTITUICAO},"
        f"Relatorio='{IFDATA_RELATORIO}')?"
        f"{urlencode({'$format': 'json'})}"
    )
    ifdata_rows = [
        row
        for row in fetch_odata(ifdata_url)
        if str(row.get("Conta") or "") == IFDATA_CONTA
    ]
    if not ifdata_rows:
        raise RuntimeError(
            f"IF.data returned no {IFDATA_CONTA} rows for {args.ifdata_period}"
        )
    row_counts["ifdata_ativo_total_prudencial"] = write_csv(
        paths["ifdata_valores"], ifdata_rows, IFDATA_VALORES_COLUMNS
    )

    susep_url = f"{SUSEP_RECEITAS_URL}?{urlencode({'@Ano': repr(str(args.year)), '$format': 'json'})}"
    susep_rows = fetch_odata(susep_url)
    row_counts[f"susep_receitas_seguros_{args.year}"] = write_csv(
        paths["susep"], susep_rows, SUSEP_RECEITAS_COLUMNS
    )

    urls = {
        "b3_listed_companies": B3_INITIAL_URL,
        "b3_listed_supplement": B3_SUPPLEMENT_URL,
        "b3_cotahist": COTAHIST_URL_TEMPLATE.format(year=args.year),
        "cvm_fca": CVM_FCA_URL_TEMPLATE.format(year=args.year),
        "ifdata_cadastro": cadastro_url,
        "ifdata_ativo_total": ifdata_url,
        "susep_premios_emitidos": susep_url,
    }
    manifest = {
        "year": args.year,
        "ifdata": {
            "period": args.ifdata_period,
            "grain": IFDATA_GRAIN,
            "tipo_instituicao": IFDATA_TIPO_INSTITUICAO,
            "relatorio": IFDATA_RELATORIO,
            "conta": IFDATA_CONTA,
        },
        "row_counts": row_counts,
        "urls": urls,
        "files": {
            path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in paths.values()
        },
    }
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
