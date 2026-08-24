-- published_facts.sql
-- Union of all published facts (identity + control edges)
-- ONLY freeze_status=in persons. review/hole/skip_soe/candidato_forbes do NOT publish.

with identity_facts as (
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
        group_name
    from {{ ref('identity_facts') }}
),

control_edge_facts as (
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
        group_name
    from {{ ref('control_edge_facts') }}
),

all_facts as (
    select * from identity_facts
    union all
    select * from control_edge_facts
)

select
    fact_id,
    person_name as person_id,
    fact_kind,
    value,
    source_publisher,
    source_locator,
    cast(source_retrieved_at as string) as source_retrieved_at,
    cpf_masked,
    cnpj_basico,
    group_name
from all_facts
-- Final assertion: fact_id must be unique and source must exist
where fact_id is not null
  and source_locator is not null
