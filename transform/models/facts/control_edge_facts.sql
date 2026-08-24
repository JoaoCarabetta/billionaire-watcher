-- control_edge_facts.sql
-- Control edge facts from RF partner relationships
-- One fact per control relationship (person → company)
-- Published facts ONLY for freeze_status=in

with control_edges as (
    select * from {{ ref('int_match_freeze_to_control_edges') }}
),

rf_empresas as (
    select * from {{ ref('stg_rf_empresas') }}
),

control_edge_facts_base as (
    select
        concat('control_edge_', ce.cnpj_basico, '_', ce.person_name) as fact_id,
        ce.person_name,
        'control_edge' as fact_kind,
        concat(
            ce.person_name,
            ' é sócio de ',
            coalesce(ce.razao_social, ce.group_name),
            ' (CNPJ ', ce.cnpj_basico, ')'
        ) as value,
        'Receita Federal do Brasil' as source_publisher,
        concat(
            'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/consultas/consulta-qsa CNPJ ',
            ce.cnpj_basico
        ) as source_locator,
        current_timestamp() as source_retrieved_at,
        ce.cpf_masked,
        ce.cnpj_basico,
        ce.group_name,
        ce.freeze_edge_label as edge_label,
        ce.qualificacao as rf_qualificacao
    from control_edges ce
    where ce.person_name is not null
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
    edge_label,
    rf_qualificacao
from control_edge_facts_base
