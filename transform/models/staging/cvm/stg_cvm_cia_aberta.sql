{% if target.type == 'bigquery' %}
{{ config(
    cluster_by=['id_cnpj'],
    labels={'origin': 'cvm', 'layer': 'staging'}
) }}
{% else %}
{{ config(labels={'origin': 'cvm', 'layer': 'staging'}) }}
{% endif %}

with source as (
    select * from {{ source('cvm', 'cad_cia_aberta') }}
),

cleaned as (
    select
        2026 as ano,
        {{ cnpj14('CNPJ_CIA') }} as id_cnpj,
        {{ clean_string('CD_CVM') }} as id_cvm,
        {{ clean_string('DENOM_SOCIAL') }} as razao_social,
        {{ clean_string('DENOM_COMERC') }} as nome_comercial,
        {{ to_date('DT_REG') }} as data_registro,
        {{ to_date('DT_CONST') }} as data_constituicao,
        {{ to_date('DT_CANCEL') }} as data_cancelamento,
        {{ clean_string('MOTIVO_CANCEL') }} as motivo_cancelamento,
        {{ clean_string('SIT') }} as situacao,
        {{ to_date('DT_INI_SIT') }} as data_inicio_situacao,
        {{ clean_string('SETOR_ATIV') }} as setor_atividade,
        {{ clean_string('TP_MERC') }} as tipo_mercado,
        {{ clean_string('CATEG_REG') }} as categoria_registro,
        {{ to_date('DT_INI_CATEG') }} as data_inicio_categoria,
        {{ clean_string('SIT_EMISSOR') }} as situacao_emissor,
        {{ to_date('DT_INI_SIT_EMISSOR') }} as data_inicio_situacao_emissor,
        {{ clean_string('CONTROLE_ACIONARIO') }} as tipo_controle_acionario,
        {{ clean_string('TP_ENDER') }} as tipo_endereco,
        {{ clean_string('LOGRADOURO') }} as logradouro,
        {{ clean_string('COMPL') }} as complemento,
        {{ clean_string('BAIRRO') }} as bairro,
        {{ clean_string('MUN') }} as nome_municipio,
        {{ clean_string('UF') }} as sigla_uf,
        {{ clean_string('PAIS') }} as nome_pais,
        {{ clean_string('CEP') }} as cep,
        {{ clean_string('DDD_TEL') }} as ddd,
        {{ clean_string('TEL') }} as telefone,
        {{ clean_string('DDD_FAX') }} as ddd_fax,
        {{ clean_string('FAX') }} as fax,
        {{ clean_string('EMAIL') }} as email,
        {{ clean_string('TP_RESP') }} as tipo_responsavel,
        {{ clean_string('RESP') }} as nome_responsavel,
        {{ to_date('DT_INI_RESP') }} as data_inicio_responsavel,
        {{ clean_string('LOGRADOURO_RESP') }} as logradouro_responsavel,
        {{ clean_string('COMPL_RESP') }} as complemento_responsavel,
        {{ clean_string('BAIRRO_RESP') }} as bairro_responsavel,
        {{ clean_string('MUN_RESP') }} as nome_municipio_responsavel,
        {{ clean_string('UF_RESP') }} as sigla_uf_responsavel,
        {{ clean_string('PAIS_RESP') }} as nome_pais_responsavel,
        {{ clean_string('CEP_RESP') }} as cep_responsavel,
        {{ clean_string('DDD_TEL_RESP') }} as ddd_responsavel,
        {{ clean_string('TEL_RESP') }} as telefone_responsavel,
        {{ clean_string('DDD_FAX_RESP') }} as ddd_fax_responsavel,
        {{ clean_string('FAX_RESP') }} as fax_responsavel,
        {{ clean_string('EMAIL_RESP') }} as email_responsavel,
        {{ cnpj14('CNPJ_AUDITOR') }} as id_cnpj_auditor,
        {{ clean_string('AUDITOR') }} as nome_auditor
    from source
)

select * from cleaned
