#!/usr/bin/env python3
"""Write BD-style architecture CSVs and the unified dicionario seed.

Run from transform/: python3 scripts/_write_architecture.py
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCH = ROOT / "architecture"
SEED = ROOT / "seeds" / "dicionario.csv"

HEADER = [
    "original_name",
    "name",
    "bigquery_type",
    "description",
    "temporal_coverage",
    "covered_by_dictionary",
    "directory_column",
    "measurement_unit",
    "observations",
]


def row(
    original: str,
    name: str,
    bq_type: str,
    description: str,
    coverage: str = "(1)",
    dictionary: str = "no",
    directory: str = "",
    unit: str = "",
    observations: str = "",
) -> dict[str, str]:
    return {
        "original_name": original,
        "name": name,
        "bigquery_type": bq_type,
        "description": description,
        "temporal_coverage": coverage,
        "covered_by_dictionary": dictionary,
        "directory_column": directory,
        "measurement_unit": unit,
        "observations": observations,
    }


TABLES: dict[str, list[dict[str, str]]] = {}

TABLES["stg_valor_empresa_inventario"] = [
    row("", "ano", "int64", "Vintage of the Valor 1000 inventory used as seed A.", "2025(1)2025", observations="Added in staging; not in the CSV."),
    row("identificador", "identificador", "string", "Source inventory key: 14-digit CNPJ, closed-group slug (folha/globo/havan/record), or the sentinel vazio when the magazine row has no CNPJ.", dictionary="yes", observations="Not unique. Hundreds of rows share vazio."),
    row("identificador", "id_cnpj", "string", "14-digit CNPJ when identificador is digits-only; null for slugs and vazio.", observations="Never invent a /0001 suffix."),
    row("nome", "nome", "string", "Display name as published in the walk inventory (razão-ish, not a legal name key)."),
    row("tipo_societario", "tipo_societario", "string", "Legal form as classified in the inventory.", dictionary="yes"),
    row("no_grafo", "indicador_grafo", "string", "Whether the company already sits on the frozen v0 public graph.", dictionary="yes"),
    row("porque", "motivo", "string", "Free-text reason the row is in the inventory (rank family, extra, skip)."),
    row("situacao_do_passeio", "situacao_passeio", "string", "Walk status assigned when the inventory was built.", dictionary="yes"),
    row("no_formulario", "indicador_formulario", "string", "Whether a Formulário de Referência shareholder file was found.", dictionary="yes"),
    row("notas", "notas", "string", "Operator notes; mostly empty."),
]

TABLES["stg_cvm_cia_aberta"] = [
    row("", "ano", "int64", "Reference year of the landed cadastro extract.", "2026(1)2026", observations="Added in staging."),
    row("CNPJ_CIA", "id_cnpj", "string", "Issuer CNPJ, digits only, padded to 14."),
    row("CD_CVM", "id_cvm", "string", "CVM issuer code. STRING so leading zeros are not lost."),
    row("DENOM_SOCIAL", "razao_social", "string", "Registered legal name (denominação social)."),
    row("DENOM_COMERC", "nome_comercial", "string", "Trade name."),
    row("DT_REG", "data_registro", "date", "CVM registration date."),
    row("DT_CONST", "data_constituicao", "date", "Incorporation date."),
    row("DT_CANCEL", "data_cancelamento", "date", "Registration cancellation date."),
    row("MOTIVO_CANCEL", "motivo_cancelamento", "string", "Cancellation motive when SIT is not ATIVO."),
    row("SIT", "situacao", "string", "Registration situation. Seed B later keeps ATIVO only.", dictionary="yes"),
    row("DT_INI_SIT", "data_inicio_situacao", "date", "Date the current SIT started."),
    row("SETOR_ATIV", "setor_atividade", "string", "Activity sector as coded by CVM."),
    row("TP_MERC", "tipo_mercado", "string", "Market type (Bolsa / Balcão)."),
    row("CATEG_REG", "categoria_registro", "string", "Registration category (A/B)."),
    row("DT_INI_CATEG", "data_inicio_categoria", "date", "Date the registration category started."),
    row("SIT_EMISSOR", "situacao_emissor", "string", "Issuer situation distinct from SIT."),
    row("DT_INI_SIT_EMISSOR", "data_inicio_situacao_emissor", "date", "Date the issuer situation started."),
    row("CONTROLE_ACIONARIO", "tipo_controle_acionario", "string", "Control type (PRIVADO/ESTATAL/ESTRANGEIRO). Not the controlling person.", dictionary="yes"),
    row("TP_ENDER", "tipo_endereco", "string", "Address type of the issuer headquarters."),
    row("LOGRADOURO", "logradouro", "string", "Street of the issuer headquarters."),
    row("COMPL", "complemento", "string", "Address complement."),
    row("BAIRRO", "bairro", "string", "Neighborhood."),
    row("MUN", "nome_municipio", "string", "Municipality name as written by CVM. Not an IBGE id."),
    row("UF", "sigla_uf", "string", "Federation unit of the headquarters.", directory="br_bd_diretorios_brasil.uf:sigla_uf"),
    row("PAIS", "nome_pais", "string", "Country name."),
    row("CEP", "cep", "string", "Postal code. STRING, never INT64."),
    row("DDD_TEL", "ddd", "string", "Telephone area code."),
    row("TEL", "telefone", "string", "Telephone number."),
    row("DDD_FAX", "ddd_fax", "string", "Fax area code."),
    row("FAX", "fax", "string", "Fax number."),
    row("EMAIL", "email", "string", "Issuer email."),
    row("TP_RESP", "tipo_responsavel", "string", "Role of the named responsible person."),
    row("RESP", "nome_responsavel", "string", "Name of the responsible person."),
    row("DT_INI_RESP", "data_inicio_responsavel", "date", "Date the responsible person started."),
    row("LOGRADOURO_RESP", "logradouro_responsavel", "string", "Street of the responsible person."),
    row("COMPL_RESP", "complemento_responsavel", "string", "Complement of the responsible person."),
    row("BAIRRO_RESP", "bairro_responsavel", "string", "Neighborhood of the responsible person."),
    row("MUN_RESP", "nome_municipio_responsavel", "string", "Municipality of the responsible person."),
    row("UF_RESP", "sigla_uf_responsavel", "string", "UF of the responsible person.", directory="br_bd_diretorios_brasil.uf:sigla_uf"),
    row("PAIS_RESP", "nome_pais_responsavel", "string", "Country of the responsible person."),
    row("CEP_RESP", "cep_responsavel", "string", "Postal code of the responsible person."),
    row("DDD_TEL_RESP", "ddd_responsavel", "string", "Telephone area code of the responsible person."),
    row("TEL_RESP", "telefone_responsavel", "string", "Telephone of the responsible person."),
    row("DDD_FAX_RESP", "ddd_fax_responsavel", "string", "Fax area code of the responsible person."),
    row("FAX_RESP", "fax_responsavel", "string", "Fax of the responsible person."),
    row("EMAIL_RESP", "email_responsavel", "string", "Email of the responsible person."),
    row("CNPJ_AUDITOR", "id_cnpj_auditor", "string", "Auditor firm CNPJ, padded to 14 when digits exist."),
    row("AUDITOR", "nome_auditor", "string", "Auditor firm name."),
]

TABLES["stg_cvm_fre_posicao_acionaria"] = [
    row("", "ano", "int64", "FRE extract year.", "2026(1)2026", observations="Added in staging."),
    row("CNPJ_Companhia", "id_cnpj", "string", "Issuer CNPJ, digits only, padded to 14."),
    row("Data_Referencia", "data_referencia", "date", "Reference date of this FRE shareholder position."),
    row("Versao", "versao", "int64", "Document version number inside the FRE package."),
    row("ID_Documento", "id_documento", "string", "FRE document id. Walk later keeps max(id_documento) per company."),
    row("Nome_Companhia", "nome_companhia", "string", "Issuer name as written on the FRE."),
    row("ID_Acionista", "id_acionista", "string", "Shareholder id inside the document."),
    row("Acionista", "nome_acionista", "string", "Shareholder name as cited. Keep Outros and tesouraria rows."),
    row("Tipo_Pessoa_Acionista", "tipo_pessoa_acionista", "string", "Shareholder person type.", dictionary="yes"),
    row("CPF_CNPJ_Acionista", "documento_acionista", "string", "Shareholder CPF (11) or CNPJ (14) when digits are complete; otherwise the masked source string. Warehouse-only."),
    row("ID_Acionista_Relacionado", "id_acionista_relacionado", "string", "Related-shareholder id when the row is a related holding."),
    row("Acionista_Relacionado", "nome_acionista_relacionado", "string", "Related-shareholder name."),
    row("Tipo_Pessoa_Acionista_Relacionado", "tipo_pessoa_acionista_relacionado", "string", "Related-shareholder person type.", dictionary="yes"),
    row("CPF_CNPJ_Acionista_Relacionado", "documento_acionista_relacionado", "string", "Related-shareholder CPF/CNPJ or mask."),
    row("Quantidade_Acao_Ordinaria_Circulacao", "quantidade_acao_ordinaria_circulacao", "int64", "Ordinary shares in circulation attributed to this shareholder.", unit="acao"),
    row("Percentual_Acao_Ordinaria_Circulacao", "proporcao_acao_ordinaria_circulacao", "float64", "Percent of ordinary shares in circulation (0-100). Criterion uses >= 10.", unit="%"),
    row("Quantidade_Acao_Preferencial_Circulacao", "quantidade_acao_preferencial_circulacao", "int64", "Preferred shares in circulation.", unit="acao"),
    row("Percentual_Acao_Preferencial_Circulacao", "proporcao_acao_preferencial_circulacao", "float64", "Percent of preferred shares in circulation (0-100).", unit="%"),
    row("Quantidade_Total_Acoes_Circulacao", "quantidade_total_acao_circulacao", "int64", "Total shares in circulation.", unit="acao"),
    row("Percentual_Total_Acoes_Circulacao", "proporcao_total_acao_circulacao", "float64", "Percent of total shares in circulation (0-100).", unit="%"),
    row("Nacionalidade", "nacionalidade", "string", "Shareholder nationality."),
    row("Sigla_UF", "sigla_uf", "string", "UF of the shareholder when resident in Brazil.", directory="br_bd_diretorios_brasil.uf:sigla_uf"),
    row("Residente_Exterior", "indicador_residente_exterior", "string", "Whether the shareholder lives abroad.", dictionary="yes"),
    row("Representante_Legal", "nome_representante_legal", "string", "Legal representative name."),
    row("Tipo_Pessoa_Representante_Legal", "tipo_pessoa_representante_legal", "string", "Legal representative person type.", dictionary="yes"),
    row("CPF_CNPJ_Representante_legal", "documento_representante_legal", "string", "Legal representative CPF/CNPJ. Official source spelling uses lowercase l."),
    row("Data_Composicao_Capital_Social", "data_composicao_capital_social", "string", "Capital-composition date as published (kept string; formats vary)."),
    row("Data_Ultima_Alteracao", "data_ultima_alteracao", "date", "Last change date of this position."),
    row("Acionista_Controlador", "indicador_acionista_controlador", "string", "S/N controller flag from the FRE. This is the citeable control signal.", dictionary="yes"),
    row("Participante_Acordo_Acionistas", "indicador_participante_acordo_acionistas", "string", "S/N shareholders-agreement flag. No separate acordo CSV exists.", dictionary="yes"),
]

TABLES["stg_cvm_fre_capital_social"] = [
    row("", "ano", "int64", "FRE extract year.", "2026(1)2026", observations="Added in staging."),
    row("CNPJ_Companhia", "id_cnpj", "string", "Issuer CNPJ, digits only, padded to 14."),
    row("Data_Referencia", "data_referencia", "date", "Reference date of this capital-social view."),
    row("Versao", "versao", "int64", "Document version number."),
    row("ID_Documento", "id_documento", "string", "FRE document id."),
    row("Nome_Companhia", "nome_companhia", "string", "Issuer name as written on the FRE."),
    row("ID_Capital_Social", "id_capital_social", "string", "Capital-social line id inside the document."),
    row("Tipo_Capital", "tipo_capital", "string", "Capital view: Autorizado / Emitido / Subscrito / Integralizado. Views, not addends.", dictionary="yes"),
    row("Data_Autorizacao_Aprovacao", "data_autorizacao_aprovacao", "string", "Authorization/approval date as published."),
    row("Valor_Capital", "valor_capital", "numeric", "Capital amount in this view.", unit="BRL"),
    row("Prazo_Integralizacao", "prazo_integralizacao", "string", "Paid-in deadline when published."),
    row("Quantidade_Acoes_Ordinarias", "quantidade_acao_ordinaria", "int64", "Ordinary share count in this view.", unit="acao"),
    row("Quantidade_Acoes_Preferenciais", "quantidade_acao_preferencial", "int64", "Preferred share count in this view.", unit="acao"),
    row("Quantidade_Total_Acoes", "quantidade_total_acao", "int64", "Total share count in this view.", unit="acao"),
]

TABLES["stg_cvm_fca_valor_mobiliario"] = [
    row("", "ano", "int64", "FCA extract year.", "2026(1)2026", observations="Added in staging."),
    row("CNPJ_Companhia", "id_cnpj", "string", "Issuer CNPJ, digits only, padded to 14."),
    row("Data_Referencia", "data_referencia", "date", "Reference date of the FCA filing."),
    row("Versao", "versao", "int64", "Document version number."),
    row("ID_Documento", "id_documento", "string", "FCA document id. Floor later keeps the latest per (CNPJ, ticker)."),
    row("Nome_Empresarial", "razao_social", "string", "Issuer legal name on the FCA."),
    row("Valor_Mobiliario", "tipo_valor_mobiliario", "string", "Security type (Ações Ordinárias, Ações Preferenciais…)."),
    row("Sigla_Classe_Acao_Preferencial", "sigla_classe_acao_preferencial", "string", "Preferred-class ticker suffix when present."),
    row("Classe_Acao_Preferencial", "classe_acao_preferencial", "string", "Preferred-class description."),
    row("Codigo_Negociacao", "ticker", "string", "B3 trading code. Joins COTAHIST CODNEG."),
    row("Composicao_BDR_Unit", "composicao_bdr_unit", "string", "BDR/unit composition when the security is a unit."),
    row("Mercado", "tipo_mercado", "string", "Market (Bolsa / Balcão). Floor later keeps Bolsa."),
    row("Sigla_Entidade_Administradora", "sigla_entidade_administradora", "string", "Exchange acronym."),
    row("Entidade_Administradora", "nome_entidade_administradora", "string", "Exchange name."),
    row("Data_Inicio_Negociacao", "data_inicio_negociacao", "date", "First trading date."),
    row("Data_Fim_Negociacao", "data_fim_negociacao", "date", "Last trading date. Empty means still listed."),
    row("Segmento", "segmento", "string", "Listing segment (Novo Mercado, Nível 2, …)."),
    row("Data_Inicio_Listagem", "data_inicio_listagem", "date", "Listing start date."),
    row("Data_Fim_Listagem", "data_fim_listagem", "date", "Listing end date."),
]

TABLES["stg_bcb_entidade_supervisionada"] = [
    row("database", "data_base", "date", "Unicad dataBase used in the OData call.", "2026-08(1)2026-08", observations="Landed as MM-DD-YYYY (08-01-2026)."),
    row("codigoCNPJ14", "id_cnpj", "string", "14-digit CNPJ of this Unicad row (line identifier). Headquarters end in 0001."),
    row("codigoCNPJ8", "cnpj_basico", "string", "8-digit institution CNPJ. Join key to IF.data."),
    row("nomeEntidadeInteresse", "nome", "string", "Supervised-entity name."),
    row("codigoTipoSituacaoPessoaJuridica", "tipo_situacao", "string", "Legal-person situation code. Seed B later keeps 3 (em funcionamento).", dictionary="yes"),
    row("codigoTipoEntidadeSupervisionada", "tipo_entidade", "string", "Supervised-entity type. Seed B later keeps {2,4,5,6,7,8,13,28,39} and drops {3,9,11}.", dictionary="yes"),
]

TABLES["stg_bcb_ifdata_cadastro"] = [
    row("Data", "data", "date", "IF.data quarter date for this reporter."),
    row("Data", "ano_mes", "string", "YYYYMM quarter derived from Data. Not a landed column of its own."),
    row("CodInst", "id_instituicao", "string", "Reporter code. Join to valores via coalesce(id_conglomerado_prudencial, id_instituicao)."),
    row("CodConglomeradoPrudencial", "id_conglomerado_prudencial", "string", "Prudential conglomerate code when the reporter is a member."),
    row("CnpjInstituicaoLider", "cnpj_basico_lider", "string", "Leading institution CNPJ8."),
    row("NomeInstituicao", "nome", "string", "Reporter name."),
    row("Situacao", "situacao", "string", "Reporter situation. Floor later keeps A.", dictionary="yes"),
]

TABLES["stg_bcb_ifdata_ativo_total"] = [
    row("AnoMes", "ano_mes", "string", "YYYYMM of the IF.data quarter.", "2026-03(1)2026-03"),
    row("TipoInstituicao", "tipo_instituicao", "int64", "Institution grain. Landed extract is already TipoInstituicao=1 (prudential). Never mix 2 or 3.", dictionary="yes"),
    row("CodInst", "id_instituicao", "string", "Prudential reporter code. Joins cadastro."),
    row("NumeroRelatorio", "numero_relatorio", "string", "Report number. Landed extract is Relatorio 2."),
    row("Conta", "conta", "string", "Account code. Landed extract is 140220 (Ativo Total)."),
    row("NomeColuna", "nome_conta", "string", "Account label as published."),
    row("Saldo", "saldo", "numeric", "Ativo Total balance. Floor later uses this as valor_do_piso.", unit="BRL"),
]

TABLES["stg_susep_dado_cadastral"] = [
    row("", "ano", "int64", "Year of the cadastro dump.", "2026(1)2026", observations="Added in staging."),
    row("entcgc", "id_cnpj", "string", "Supervised-entity CNPJ, padded to 14."),
    row("entnome", "nome", "string", "Supervised-entity name."),
    row("mercodigo", "tipo_mercado", "string", "SUSEP market code. Seed B later keeps {1,2,3,4,6} and drops 5.", dictionary="yes"),
]

TABLES["stg_susep_receita_seguro"] = [
    row("", "ano", "int64", "ReceitasSeguros year parameter.", "2026(1)2026", observations="Added in staging."),
    row("cnpj", "id_cnpj", "string", "Insurer CNPJ, padded to 14."),
    row("entnome", "nome", "string", "Insurer name."),
    row("mesreferencia", "mes_referencia", "string", "Reference month as published by Olinda."),
    row("grupo", "grupo", "string", "Premium group."),
    row("ramo", "ramo", "string", "Insurance branch."),
    row("valor", "valor", "numeric", "Emitted premiums (prêmios emitidos). Not SES premio_ganho.", unit="BRL"),
]

TABLES["stg_b3_empresa_listada"] = [
    row("", "ano", "int64", "Year of the listed-company pull.", "2026(1)2026", observations="Added in staging."),
    row("cnpj", "id_cnpj", "string", "Issuer CNPJ, padded to 14. Downloader already zfilled."),
    row("codeCVM", "id_cvm", "string", "CVM issuer code."),
    row("issuingCompany", "codigo_emissor", "string", "B3 issuing-company code. Joins the supplement code."),
    row("companyName", "razao_social", "string", "Legal name from GetInitialCompanies."),
    row("tradingName", "nome_comercial", "string", "Trading name."),
    row("type", "tipo", "string", "B3 company type. Landed extract is already type=1.", dictionary="yes"),
]

TABLES["stg_b3_empresa_listada_complemento"] = [
    row("", "ano", "int64", "Year of the supplement pull.", "2026(1)2026", observations="Added in staging."),
    row("code", "codigo_emissor", "string", "B3 issuing-company code. Joins listed_companies.issuingCompany."),
    row("codeCVM", "id_cvm", "string", "CVM issuer code."),
    row("tradingName", "nome_comercial", "string", "Trading name."),
    row("numberCommonShares", "quantidade_acao_ordinaria", "numeric", "Ordinary shares outstanding. Brazilian thousands/decimal parsed when needed.", unit="acao"),
    row("numberPreferredShares", "quantidade_acao_preferencial", "numeric", "Preferred shares outstanding.", unit="acao"),
    row("totalNumberShares", "quantidade_total_acao", "numeric", "Total shares outstanding.", unit="acao"),
]

TABLES["stg_b3_cotahist"] = [
    row("DATA_PREGAO", "data_pregao", "date", "Trading session date (source YYYYMMDD).", "2026(1)2026"),
    row("CODNEG", "ticker", "string", "B3 trading code. Joins FCA Codigo_Negociacao."),
    row("CODBDI", "codigo_bdi", "string", "BDI code. Landed extract is already 02 (lote-padrão)."),
    row("TPMERC", "tipo_mercado", "string", "Market type. Landed extract is already 010 (vista)."),
    row("PREULT", "preco_fechamento", "numeric", "Official close. Source PREULT is integer cents; staging divides by 100.", unit="BRL"),
    row("NUMNEG", "quantidade_negocio", "int64", "Number of trades in the session.", unit="1"),
]

TABLES["stg_rf_socio"] = [
    row("data", "data", "date", "Receita snapshot partition copied from basedosdados.br_me_cnpj.socios.", "2026-01(1)2026-01"),
    row("ano", "ano", "int64", "Year extracted from the partition date."),
    row("mes", "mes", "int64", "Month extracted from the partition date."),
    row("cnpj_basico", "cnpj_basico", "string", "8-digit company root. Leading zeros preserved."),
    row("tipo", "tipo", "string", "Partner type: 1 PJ, 2 PF, 3 foreign.", dictionary="yes"),
    row("nome", "nome", "string", "Partner name or razão social as filed."),
    row("documento", "documento", "string", "Masked CPF or CNPJ. Match later with a mask derived from the warehouse CPF, never by name alone."),
    row("qualificacao", "qualificacao", "string", "RF qualification code, 2 digits. Walk later keeps the ownership set and drops administrators.", dictionary="yes"),
    row("data_entrada_sociedade", "data_entrada_sociedade", "date", "Date the partner entered the company."),
    row("id_pais", "id_pais", "string", "Country id when published."),
    row("cpf_representante_legal", "cpf_representante_legal", "string", "Legal-representative CPF (often masked)."),
    row("nome_representante_legal", "nome_representante_legal", "string", "Legal-representative name."),
    row("qualificacao_representante_legal", "qualificacao_representante_legal", "string", "Legal-representative qualification code.", dictionary="yes"),
    row("faixa_etaria", "faixa_etaria", "string", "Age band of a natural-person partner.", dictionary="yes"),
]

TABLES["stg_rf_empresa"] = [
    row("data", "data", "date", "Receita snapshot partition copied from basedosdados.br_me_cnpj.empresas.", "2026-01(1)2026-01"),
    row("ano", "ano", "int64", "Year extracted from the partition date."),
    row("mes", "mes", "int64", "Month extracted from the partition date."),
    row("cnpj_basico", "cnpj_basico", "string", "8-digit company root. One row per company in the snapshot."),
    row("razao_social", "razao_social", "string", "Legal name."),
    row("natureza_juridica", "natureza_juridica", "string", "Legal-nature code, 4 digits. Walk later skips 2054 (SA fechada) because QSA is not a public book.", dictionary="yes"),
    row("qualificacao_responsavel", "qualificacao_responsavel", "string", "Qualification of the responsible person.", dictionary="yes"),
    row("capital_social", "capital_social", "float64", "Share capital as filed.", unit="BRL"),
    row("porte", "porte", "string", "Company size class.", dictionary="yes"),
    row("ente_federativo", "ente_federativo", "string", "Federative entity when the company is public."),
]

TABLES["stg_rf_estabelecimento"] = [
    row("data", "data", "date", "Receita snapshot partition copied from basedosdados.br_me_cnpj.estabelecimentos.", "2026-01(1)2026-01"),
    row("ano", "ano", "int64", "Year extracted from the partition date."),
    row("mes", "mes", "int64", "Month extracted from the partition date."),
    row("cnpj", "cnpj", "string", "14-digit establishment CNPJ."),
    row("cnpj_basico", "cnpj_basico", "string", "8-digit company root."),
    row("cnpj_ordem", "cnpj_ordem", "string", "4-digit establishment order. Headquarters are 0001."),
    row("cnpj_dv", "cnpj_dv", "string", "2-digit check digits."),
    row("identificador_matriz_filial", "identificador_matriz_filial", "string", "1 matriz / 2 filial.", dictionary="yes"),
    row("nome_fantasia", "nome_fantasia", "string", "Trade name of the establishment."),
    row("situacao_cadastral", "situacao_cadastral", "string", "Cadastral situation code.", dictionary="yes"),
    row("data_situacao_cadastral", "data_situacao_cadastral", "date", "Date of the current cadastral situation."),
    row("motivo_situacao_cadastral", "motivo_situacao_cadastral", "string", "Motive of the cadastral situation."),
    row("nome_cidade_exterior", "nome_cidade_exterior", "string", "Foreign city when the establishment is abroad."),
    row("id_pais", "id_pais", "string", "Country id."),
    row("data_inicio_atividade", "data_inicio_atividade", "date", "Activity start date."),
    row("cnae_fiscal_principal", "cnae_fiscal_principal", "string", "Primary CNAE."),
    row("cnae_fiscal_secundaria", "cnae_fiscal_secundaria", "string", "Secondary CNAEs, source delimiter preserved."),
    row("sigla_uf", "sigla_uf", "string", "Federation unit.", directory="br_bd_diretorios_brasil.uf:sigla_uf"),
    row("id_municipio", "id_municipio", "string", "IBGE 7-digit municipality id.", directory="br_bd_diretorios_brasil.municipio:id_municipio"),
    row("id_municipio_rf", "id_municipio_rf", "string", "Receita municipality id, distinct from IBGE."),
    row("tipo_logradouro", "tipo_logradouro", "string", "Street type."),
    row("logradouro", "logradouro", "string", "Street name."),
    row("numero", "numero", "string", "Street number."),
    row("complemento", "complemento", "string", "Address complement."),
    row("bairro", "bairro", "string", "Neighborhood."),
    row("cep", "cep", "string", "Postal code."),
    row("ddd_1", "ddd_1", "string", "Primary telephone area code."),
    row("telefone_1", "telefone_1", "string", "Primary telephone."),
    row("ddd_2", "ddd_2", "string", "Secondary telephone area code."),
    row("telefone_2", "telefone_2", "string", "Secondary telephone."),
    row("ddd_fax", "ddd_fax", "string", "Fax area code."),
    row("fax", "fax", "string", "Fax number."),
    row("email", "email", "string", "Establishment email."),
    row("situacao_especial", "situacao_especial", "string", "Special situation when present."),
    row("data_situacao_especial", "data_situacao_especial", "date", "Special-situation date."),
]


DICIONARIO: list[tuple[str, str, str, str]] = []


def d(table: str, column: str, key: str, value: str) -> None:
    DICIONARIO.append((table, column, key, value))


# Valor
for key, val in [
    ("sociedade anônima aberta", "Sociedade anônima aberta"),
    ("sociedade anônima fechada", "Sociedade anônima fechada"),
    ("desconhecido", "Desconhecido"),
]:
    d("stg_valor_empresa_inventario", "tipo_societario", key, val)
for key, val in [("sim", "Sim"), ("não", "Não")]:
    d("stg_valor_empresa_inventario", "indicador_grafo", key, val)
    d("stg_valor_empresa_inventario", "indicador_formulario", key, val)
d("stg_valor_empresa_inventario", "indicador_formulario", "buraco", "Buraco")
for key, val in [
    ("só inventário", "Só inventário"),
    ("árvore no grafo", "Árvore no grafo"),
    ("pulada-já-semente", "Pulada, já semente"),
    ("grupo sem sócio", "Grupo sem sócio"),
    ("buraco", "Buraco"),
    ("inventário-fechada-não-andar", "Inventário, fechada, não andar"),
]:
    d("stg_valor_empresa_inventario", "situacao_passeio", key, val)
for key in ("folha", "globo", "havan", "record", "vazio"):
    d("stg_valor_empresa_inventario", "identificador", key, key.capitalize() if key != "vazio" else "Sem CNPJ (sentinela)")

# CVM cadastro
for key, val in [
    ("ATIVO", "Ativo"),
    ("CANCELADA", "Cancelada"),
    ("SUSPENSO", "Suspenso"),
]:
    d("stg_cvm_cia_aberta", "situacao", key, val)
for key, val in [
    ("PRIVADO", "Privado"),
    ("ESTATAL", "Estatal"),
    ("ESTRANGEIRO", "Estrangeiro"),
]:
    d("stg_cvm_cia_aberta", "tipo_controle_acionario", key, val)

# FRE flags and person types
for table, col in [
    ("stg_cvm_fre_posicao_acionaria", "indicador_acionista_controlador"),
    ("stg_cvm_fre_posicao_acionaria", "indicador_participante_acordo_acionistas"),
    ("stg_cvm_fre_posicao_acionaria", "indicador_residente_exterior"),
]:
    d(table, col, "S", "Sim")
    d(table, col, "N", "Não")
for col in (
    "tipo_pessoa_acionista",
    "tipo_pessoa_acionista_relacionado",
    "tipo_pessoa_representante_legal",
):
    for key, val in [
        ("Física", "Pessoa física"),
        ("Jurídica", "Pessoa jurídica"),
        ("Pessoa Física", "Pessoa física"),
        ("Pessoa Jurídica", "Pessoa jurídica"),
        ("PF", "Pessoa física"),
        ("PJ", "Pessoa jurídica"),
    ]:
        d("stg_cvm_fre_posicao_acionaria", col, key, val)

for key, val in [
    ("Autorizado", "Autorizado"),
    ("Emitido", "Emitido"),
    ("Subscrito", "Subscrito"),
    ("Integralizado", "Integralizado"),
]:
    d("stg_cvm_fre_capital_social", "tipo_capital", key, val)

# BCB
d("stg_bcb_entidade_supervisionada", "tipo_situacao", "3", "Em funcionamento")
for key, val in [
    ("2", "Banco comercial"),
    ("3", "Cooperativa de crédito (excluída da semente B)"),
    ("4", "Banco múltiplo"),
    ("5", "Caixa econômica"),
    ("6", "Banco de desenvolvimento"),
    ("7", "Banco de investimento"),
    ("8", "Sociedade de crédito, financiamento e investimento"),
    ("9", "Sociedade de crédito imobiliário (excluída da semente B)"),
    ("11", "Sociedade de arrendamento mercantil (excluída da semente B)"),
    ("13", "Companhia hipotecária"),
    ("28", "Banco cooperativo"),
    ("39", "Associação de poupança e empréstimo"),
]:
    d("stg_bcb_entidade_supervisionada", "tipo_entidade", key, val)
d("stg_bcb_ifdata_cadastro", "situacao", "A", "Ativa")
d("stg_bcb_ifdata_cadastro", "situacao", "I", "Inativa")
d("stg_bcb_ifdata_ativo_total", "tipo_instituicao", "1", "Conglomerado prudencial")
d("stg_bcb_ifdata_ativo_total", "tipo_instituicao", "2", "Conglomerado financeiro")
d("stg_bcb_ifdata_ativo_total", "tipo_instituicao", "3", "Instituição individual")

# SUSEP mercados (Olinda DadosCadastrais). Seed B drops 5.
for key, val in [
    ("1", "Seguros"),
    ("2", "Previdência complementar aberta"),
    ("3", "Capitalização"),
    ("4", "Resseguros"),
    ("5", "Corretores / outro mercado (fora da semente B)"),
    ("6", "Entidade supervisionada adicional"),
]:
    d("stg_susep_dado_cadastral", "tipo_mercado", key, val)

d("stg_b3_empresa_listada", "tipo", "1", "Companhia listada (GetInitialCompanies type=1)")

# RF
d("stg_rf_socio", "tipo", "1", "Pessoa jurídica")
d("stg_rf_socio", "tipo", "2", "Pessoa física")
d("stg_rf_socio", "tipo", "3", "Sócio estrangeiro")

QUALIFICACAO = {
    "05": "Administrador",
    "08": "Conselheiro de administração",
    "09": "Curador",
    "10": "Diretor",
    "11": "Interventor",
    "12": "Inventariante",
    "13": "Liquidante",
    "14": "Mãe",
    "15": "Pai",
    "16": "Presidente",
    "17": "Procurador",
    "18": "Síndico",
    "19": "Sociedade consorciada",
    "20": "Sociedade filiada",
    "21": "Sócio",
    "22": "Sócio capitalista",
    "23": "Sócio comanditado",
    "24": "Sócio comanditário",
    "25": "Sócio de indústria",
    "26": "Sócio pessoa jurídica domiciliado no exterior",
    "28": "Sócio-gerente",
    "29": "Sócio ou acionista incapaz",
    "30": "Tradutor / intérprete",
    "31": "Sócio pessoa física residente ou domiciliado no exterior",
    "32": "Titular pessoa física residente ou domiciliado no exterior",
    "33": "Titular pessoa jurídica domiciliada no exterior",
    "34": "Titular pessoa jurídica domiciliada no Brasil",
    "35": "Tesoureiro",
    "36": "Titular de empresa individual imobiliária",
    "37": "Sócio pessoa jurídica domiciliado no Brasil",
    "38": "Sócio pessoa física residente ou domiciliado no Brasil",
    "39": "Titular pessoa física residente ou domiciliado no Brasil",
    "40": "Diretor residente no exterior",
    "41": "Presidente residente no exterior",
    "42": "Conselheiro de administração residente no exterior",
    "43": "Administrador residente no exterior",
    "46": "Ministro de estado",
    "47": "Sócio pessoa física residente no Brasil",
    "48": "Sócio pessoa jurídica domiciliado no Brasil",
    "49": "Sócio-administrador",
    "50": "Administrador residente ou domiciliado no exterior",
    "51": "Cônsul",
    "52": "Sócio com capital",
    "53": "Sócio sem capital",
    "54": "Fundador",
    "55": "Sócio comanditado pessoa física",
    "56": "Sócio comanditário pessoa jurídica",
    "57": "Sócio comanditário pessoa física",
    "58": "Sócio comanditado pessoa jurídica",
    "59": "Produtor rural",
    "63": "Cotista",
    "64": "Administrador judicial",
    "65": "Titular pessoa física residente ou domiciliado no Brasil",
    "66": "Titular pessoa física residente ou domiciliado no exterior",
    "67": "Titular pessoa jurídica domiciliada no Brasil",
    "68": "Titular pessoa jurídica domiciliada no exterior",
    "70": "Ouvidor",
    "72": "Inventariante",
    "73": "Liquidante",
    "74": "Sócio ou acionista pessoa física",
    "75": "Sócio ou acionista pessoa jurídica",
    "76": "Presidente com poderes de administração no exterior",
    "77": "Administrador residente no Brasil",
    "78": "Titular pessoa física incapaz ou relativamente incapaz",
    "79": "Produtor rural pessoa jurídica",
}
for key, val in QUALIFICACAO.items():
    d("stg_rf_socio", "qualificacao", key, val)
    d("stg_rf_socio", "qualificacao_representante_legal", key, val)
    d("stg_rf_empresa", "qualificacao_responsavel", key, val)

NATUREZA = {
    "2011": "Empresa pública",
    "2038": "Sociedade de economia mista",
    "2046": "Sociedade anônima aberta",
    "2054": "Sociedade anônima fechada",
    "2062": "Sociedade empresária limitada",
    "2135": "Empresário individual",
    "2143": "Cooperativa",
    "2232": "Sociedade simples",
    "2240": "Sociedade simples limitada",
    "2305": "Empresa individual de responsabilidade limitada (natureza empresária)",
    "2313": "Empresa individual de responsabilidade limitada (natureza simples)",
    "2321": "Sociedade unipessoal de advogados",
    "2330": "Cooperativa de consumo",
    "3034": "Serviço notarial e registral (cartório)",
    "3069": "Fundação privada",
    "3077": "Serviço social autônomo",
    "3085": "Condomínio edilício",
    "3107": "Comissão de conciliação prévia",
    "3115": "Entidade de mediação e arbitragem",
    "3131": "Entidade sindical",
    "3204": "Estabelecimento no Brasil de sociedade estrangeira",
    "3212": "Estabelecimento no Brasil de empresa binacional argentino-brasileira",
    "3220": "Empresa domiciliada no exterior",
    "3239": "Clube/fundo de investimento",
    "3247": "Sociedade simples pura",
    "3255": "Sociedade em conta de participação",
    "3263": "Sociedade simples limitada",
    "3271": "Órgão de direção nacional de partido político",
    "3280": "Órgão de direção regional de partido político",
    "3298": "Órgão de direção local de partido político",
    "3301": "Comitê financeiro de partido político",
    "3306": "Frente pleiteira",
    "3999": "Associação privada",
    "4014": "Empresa individual imobiliária",
    "4090": "Candidato a cargo político eletivo",
    "4120": "Produtor rural (pessoa física)",
    "5010": "Organização internacional",
    "5029": "Representação diplomática estrangeira",
    "5037": "Outras instituições extraterritoriais",
}
for key, val in NATUREZA.items():
    d("stg_rf_empresa", "natureza_juridica", key, val)

d("stg_rf_empresa", "porte", "00", "Não informado")
d("stg_rf_empresa", "porte", "01", "Microempresa")
d("stg_rf_empresa", "porte", "03", "Empresa de pequeno porte")
d("stg_rf_empresa", "porte", "05", "Demais")

d("stg_rf_estabelecimento", "identificador_matriz_filial", "1", "Matriz")
d("stg_rf_estabelecimento", "identificador_matriz_filial", "2", "Filial")

for key, val in [
    ("01", "Nula"),
    ("02", "Ativa"),
    ("03", "Suspensa"),
    ("04", "Inapta"),
    ("08", "Baixada"),
]:
    d("stg_rf_estabelecimento", "situacao_cadastral", key, val)

for key, val in [
    ("0", "Não se aplica"),
    ("1", "0 a 12 anos"),
    ("2", "13 a 17 anos"),
    ("3", "18 a 20 anos"),
    ("4", "21 a 30 anos"),
    ("5", "31 a 40 anos"),
    ("6", "41 a 50 anos"),
    ("7", "51 a 60 anos"),
    ("8", "61 a 70 anos"),
    ("9", "Mais de 70 anos"),
]:
    d("stg_rf_socio", "faixa_etaria", key, val)


def write_architecture() -> None:
    ARCH.mkdir(parents=True, exist_ok=True)
    for name, rows in TABLES.items():
        path = ARCH / f"{name}.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=HEADER)
            writer.writeheader()
            writer.writerows(rows)
        print(f"wrote {path.relative_to(ROOT)} ({len(rows)} cols)")


def write_dicionario() -> None:
    with SEED.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id_tabela", "nome_coluna", "chave", "valor"])
        writer.writerows(DICIONARIO)
    print(f"wrote {SEED.relative_to(ROOT)} ({len(DICIONARIO)} keys)")


if __name__ == "__main__":
    write_architecture()
    write_dicionario()
