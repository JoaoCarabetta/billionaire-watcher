-- control_edge_facts.sql
-- Control edge facts from freeze edge_label
-- One fact per control relationship (person → company)
-- Published facts ONLY for freeze_status=in
-- PM: Follow freeze edge_label. Use freeze source_doc (FRE stays FRE). No invented RF QSA URL.

with freeze_persons as (
    select * from {{ ref('freeze_persons_with_forbes') }}
    where freeze_status = 'in' -- Published facts only
      and person_name is not null
      and source_doc is not null -- Drop facts with null source_doc
      and edge_label is not null -- Must have an edge
),

control_edge_facts_base as (
    select
        concat('control_edge_', cnpj_basico, '_', person_name, '_', edge_label) as fact_id,
        person_name,
        'control_edge' as fact_kind,
        -- Follow freeze edge_label: acionista_controlador NOT "é sócio de"
        case
            when edge_label = 'acionista_controlador' then concat(
                person_name,
                ' é acionista controlador de ',
                group_name,
                ' (CNPJ ', cnpj_basico, ')'
            )
            when edge_label = 'socio' then concat(
                person_name,
                ' é sócio de ',
                group_name,
                ' (CNPJ ', cnpj_basico, ')'
            )
            when edge_label = 'administrador' then concat(
                person_name,
                ' é administrador de ',
                group_name,
                ' (CNPJ ', cnpj_basico, ')'
            )
        end as value,
        case
            when source_doc like 'CVM FRE%' then 'CVM - Comissão de Valores Mobiliários'
            when source_doc like 'Forbes%' then 'Forbes'
            else 'Receita Federal do Brasil'
        end as source_publisher,
        source_doc as source_locator, -- Use freeze source_doc, not invented RF URL
        null as source_retrieved_at, -- No fake timestamp
        cpf_masked,
        cnpj_basico,
        group_name,
        edge_label
    from freeze_persons
)

select
    fact_id,
    person_name,
    fact_kind,
    value,
    source_publisher,
    source_locator,
    source_retrieved_at,
    cpf_masked,
    cnpj_basico,
    group_name,
    edge_label
from control_edge_facts_base
