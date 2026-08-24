-- identity_facts.sql
-- Identity facts for freeze persons (name, role, group affiliation)
-- One fact per identity field per person
-- Published facts ONLY for freeze_status=in

with freeze_persons as (
    select * from {{ ref('freeze_persons_with_forbes') }}
    where freeze_status = 'in' -- Published facts only
      and person_name is not null
),

identity_facts_base as (
    -- Fact: person name
    select
        concat('identity_', cnpj_basico, '_', person_name, '_name') as fact_id,
        person_name,
        'identity' as fact_kind,
        'name' as field,
        person_name as value,
        case
            when source_doc like 'CVM FRE%' then 'CVM - Comissão de Valores Mobiliários'
            when source_doc like 'Forbes%' then 'Forbes'
            else 'Receita Federal do Brasil'
        end as source_publisher,
        coalesce(source_doc, 'Freeze source document') as source_locator,
        current_timestamp() as source_retrieved_at,
        cpf_masked,
        cnpj_basico,
        group_name
    from freeze_persons

    union all

    -- Fact: role
    select
        concat('identity_', cnpj_basico, '_', person_name, '_role') as fact_id,
        person_name,
        'identity' as fact_kind,
        'role' as field,
        role as value,
        case
            when source_doc like 'CVM FRE%' then 'CVM - Comissão de Valores Mobiliários'
            when source_doc like 'Forbes%' then 'Forbes'
            else 'Receita Federal do Brasil'
        end as source_publisher,
        coalesce(source_doc, 'Freeze source document') as source_locator,
        current_timestamp() as source_retrieved_at,
        cpf_masked,
        cnpj_basico,
        group_name
    from freeze_persons

    union all

    -- Fact: group affiliation
    select
        concat('identity_', cnpj_basico, '_', person_name, '_group') as fact_id,
        person_name,
        'identity' as fact_kind,
        'group_affiliation' as field,
        concat('Controla ', group_name) as value,
        case
            when source_doc like 'CVM FRE%' then 'CVM - Comissão de Valores Mobiliários'
            when source_doc like 'Forbes%' then 'Forbes'
            else 'Receita Federal do Brasil'
        end as source_publisher,
        coalesce(source_doc, 'Freeze source document') as source_locator,
        current_timestamp() as source_retrieved_at,
        cpf_masked,
        cnpj_basico,
        group_name
    from freeze_persons
)

select
    fact_id,
    person_name,
    fact_kind,
    field,
    value,
    source_publisher,
    source_locator,
    source_retrieved_at,
    cpf_masked,
    cnpj_basico,
    group_name
from identity_facts_base
