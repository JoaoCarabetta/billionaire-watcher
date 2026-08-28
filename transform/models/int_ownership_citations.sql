{{
    config(
        cluster_by=['company_key'] if target.type == 'bigquery' else none
    )
}}

with
{{ ownership_edge_ctes() }}

select
    company_key,
    company_name,
    fonte,
    owner_kind,
    owner_company_id,
    owner_name,
    owner_document,
    owner_cpf,
    papel,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    data_referencia,
    fonte_documento
from all_ownership_citations
