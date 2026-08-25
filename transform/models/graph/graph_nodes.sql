-- graph_nodes.sql
-- Control graph nodes: companies, persons, funds, state entities
-- Union of all node types with standardized node_id and node_kind

with companies as (
    select
        cnpj_basico as node_id,
        node_kind,
        name,
        cast(null as string) as cpf,
        cast(null as string) as cpf_masked,
        cast(null as string) as provisional_name_key,
        cnpj_basico
    from {{ ref('energisa_companies_fixture') }}
),

persons as (
    select
        coalesce(cpf, provisional_name_key, person_id) as node_id,
        node_kind,
        name,
        cpf,
        cpf_masked,
        provisional_name_key,
        cast(null as string) as cnpj_basico
    from {{ ref('energisa_persons_fixture') }}
),

all_nodes as (
    select * from companies
    union all
    select * from persons
)

select
    node_id,
    node_kind,
    name,
    cpf,
    cpf_masked,
    provisional_name_key,
    cnpj_basico
from all_nodes
