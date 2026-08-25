-- graph_nodes.sql
-- Control graph nodes: companies, persons, funds, state entities, outros
-- Union of all node types with standardized node_id and node_kind
-- CPF masked as ***NNN*** (stars + last-3 + stars) derived from warehouse cpf

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
        node_id,
        node_kind,
        name,
        cpf,
        case
            when cpf is not null
            then concat('***', substr(cpf, 9, 3), '***')
            else null
        end as cpf_masked,
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
