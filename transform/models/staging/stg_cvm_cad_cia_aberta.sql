-- stg_cvm_cad_cia_aberta.sql
-- CVM registered listed companies (cadastro)
-- Source: GCS raw/cvm/fre/2026/cad_cia_aberta.csv (latin-1, semicolon)

with source as (
    select * from {{ source('gcs_cvm', 'cad_cia_aberta') }}
),

cleaned as (
    select
        lpad(regexp_replace(cast(CNPJ_CIA as string), r'[^\d]', ''), 14, '0') as CNPJ_CIA,
        cast(DENOM_SOCIAL as string) as DENOM_SOCIAL,
        cast(DENOM_COMERC as string) as DENOM_COMERC,
        cast(DT_REG as date) as DT_REG,
        cast(DT_CONST as date) as DT_CONST,
        cast(DT_CANCEL as date) as DT_CANCEL,
        cast(MOTIVO_CANCEL as string) as MOTIVO_CANCEL,
        cast(SIT as string) as SIT,
        cast(DT_INI_SIT as date) as DT_INI_SIT,
        cast(CD_CVM as int64) as CD_CVM,
        cast(SETOR_ATIV as string) as SETOR_ATIV,
        cast(TP_MERC as string) as TP_MERC,
        cast(CATEG_REG as string) as CATEG_REG,
        cast(DT_INI_CATEG as date) as DT_INI_CATEG,
        cast(SIT_EMISSOR as string) as SIT_EMISSOR,
        cast(DT_INI_SIT_EMISSOR as date) as DT_INI_SIT_EMISSOR,
        cast(CONTROLE_ACIONARIO as string) as CONTROLE_ACIONARIO,
        cast(TP_ENDER as string) as TP_ENDER,
        cast(LOGRADOURO as string) as LOGRADOURO,
        cast(COMPL as string) as COMPL,
        cast(BAIRRO as string) as BAIRRO,
        cast(MUN as string) as MUN,
        cast(UF as string) as UF,
        cast(PAIS as string) as PAIS,
        cast(CEP as int64) as CEP,
        cast(DDD_TEL as int64) as DDD_TEL,
        cast(TEL as int64) as TEL,
        cast(DDD_FAX as int64) as DDD_FAX,
        cast(FAX as int64) as FAX,
        cast(EMAIL as string) as EMAIL,
        cast(TP_RESP as string) as TP_RESP,
        cast(RESP as string) as RESP,
        cast(DT_INI_RESP as date) as DT_INI_RESP,
        cast(LOGRADOURO_RESP as string) as LOGRADOURO_RESP,
        cast(COMPL_RESP as string) as COMPL_RESP,
        cast(BAIRRO_RESP as string) as BAIRRO_RESP,
        cast(MUN_RESP as string) as MUN_RESP,
        cast(UF_RESP as string) as UF_RESP,
        cast(PAIS_RESP as string) as PAIS_RESP,
        cast(CEP_RESP as int64) as CEP_RESP,
        cast(DDD_TEL_RESP as int64) as DDD_TEL_RESP,
        cast(TEL_RESP as int64) as TEL_RESP,
        cast(DDD_FAX_RESP as int64) as DDD_FAX_RESP,
        cast(FAX_RESP as int64) as FAX_RESP,
        cast(EMAIL_RESP as string) as EMAIL_RESP,
        cast(CNPJ_AUDITOR as string) as CNPJ_AUDITOR,
        cast(AUDITOR as string) as AUDITOR
    from source
)

select * from cleaned
