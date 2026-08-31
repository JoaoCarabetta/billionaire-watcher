#!/usr/bin/env python3
"""Download the fase 1 company-door files.

Copies the three Valor 1000 lists from data/valor1000-2025/ and fetches
CVM, Unicad, and SUSEP. The script only lands files. dbt owns seed filters.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


CVM_URL = (
    "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/"
    "cad_cia_aberta.csv"
)
BCB_ENDPOINT = (
    "https://olinda.bcb.gov.br/olinda/servico/BcBase/versao/v2/odata/"
    "EntidadesSupervisionadas(dataBase=@dataBase)"
)
SUSEP_URL = (
    "https://dados.susep.gov.br/olinda/servico/empresas/versao/v1/odata/"
    "DadosCadastrais"
)

DEFAULT_BCB_DATE = "08-01-2026"
EXPECTED_SEDES_BANCO_COM_MULT_CE = 154

BCB_COLUMNS = (
    "database",
    "codigoCNPJ14",
    "codigoCNPJ8",
    "nomeEntidadeInteresse",
    "codigoTipoSituacaoPessoaJuridica",
    "codigoTipoEntidadeSupervisionada",
)
SUSEP_COLUMNS = ("mercodigo", "entnome", "entcgc")

# The BCB named check groups bank-seat subtypes before the final seed filter.
# Type 11 contributes to this check, then is explicitly excluded by dbt.
SEDES_BANCO_COM_MULT_CE_TYPES = {2, 4, 5, 6, 8, 11, 28}


def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "billionaire-watcher/1.0"})
    with urlopen(request, timeout=120) as response:
        return response.read()


def fetch_odata(url: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    next_url: str | None = url
    while next_url:
        payload = json.loads(fetch_bytes(next_url))
        page = payload.get("value")
        if not isinstance(page, list):
            raise RuntimeError(f"OData response has no value array: {next_url}")
        rows.extend(page)
        next_url = payload.get("@odata.nextLink") or payload.get("odata.nextLink")
    return rows


def write_csv(
    path: Path,
    rows: list[dict[str, Any]],
    columns: tuple[str, ...],
    sort_fields: tuple[str, ...],
) -> None:
    rows.sort(key=lambda row: tuple(str(row.get(field) or "") for field in sort_fields))
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def integer_code(row: dict[str, Any], field: str) -> int | None:
    value = row.get(field)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("landing/fase1"),
        help="Directory for raw files (default: landing/fase1).",
    )
    parser.add_argument(
        "--bcb-date",
        default=DEFAULT_BCB_DATE,
        help="BCB dataBase alias in MM-DD-YYYY format.",
    )
    args = parser.parse_args()

    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    repository_root = Path(__file__).resolve().parents[2]
    valor_dir = repository_root / "data" / "valor1000-2025"
    valor_outputs = []
    for name in ("ranking.csv", "bancos.csv", "seguradoras.csv"):
        source = valor_dir / name
        if not source.is_file():
            raise FileNotFoundError(f"Valor 1000 list missing: {source}")
        destination = output_dir / name
        shutil.copyfile(source, destination)
        valor_outputs.append(destination)

    cvm_output = output_dir / "cad_cia_aberta.csv"
    cvm_output.write_bytes(fetch_bytes(CVM_URL))

    bcb_url = f"{BCB_ENDPOINT}?{urlencode({'@dataBase': repr(args.bcb_date), '$format': 'json'})}"
    bcb_rows = fetch_odata(bcb_url)
    sedes_count = sum(
        integer_code(row, "codigoTipoSituacaoPessoaJuridica") == 3
        and integer_code(row, "codigoTipoEntidadeSupervisionada")
        in SEDES_BANCO_COM_MULT_CE_TYPES
        for row in bcb_rows
    )
    if sedes_count != EXPECTED_SEDES_BANCO_COM_MULT_CE:
        raise RuntimeError(
            "SedesBancoComMultCE failed: "
            f"expected {EXPECTED_SEDES_BANCO_COM_MULT_CE}, got {sedes_count} "
            f"for dataBase={args.bcb_date}"
        )
    bcb_output = output_dir / "bcb_entidades_supervisionadas.csv"
    write_csv(
        bcb_output,
        bcb_rows,
        BCB_COLUMNS,
        ("codigoCNPJ14", "nomeEntidadeInteresse"),
    )

    if "$top" in SUSEP_URL:
        raise RuntimeError("SUSEP full-dump URL must not contain $top")
    susep_rows = fetch_odata(f"{SUSEP_URL}?{urlencode({'$format': 'json'})}")
    susep_output = output_dir / "susep_dados_cadastrais.csv"
    write_csv(susep_output, susep_rows, SUSEP_COLUMNS, ("entcgc", "entnome"))

    outputs = (*valor_outputs, cvm_output, bcb_output, susep_output)
    manifest = {
        "bcb_date": args.bcb_date,
        "checks": {
            "SedesBancoComMultCE": {
                "actual": sedes_count,
                "expected": EXPECTED_SEDES_BANCO_COM_MULT_CE,
            }
        },
        "files": {
            path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in outputs
        },
        "row_counts": {
            "bcb_entidades_supervisionadas": len(bcb_rows),
            "susep_dados_cadastrais": len(susep_rows),
        },
        "urls": {"bcb": bcb_url, "cvm": CVM_URL, "susep": SUSEP_URL},
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
