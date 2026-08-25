-- graph_person_holdings.sql
-- Derived person holdings: pct_economica_pessoa and pct_votos_pessoa
-- Computed only on complete paths (all hops have percents)
-- Incomplete path (any null hop) → null person percents

with edges as (
    select
        from_id,
        to_id,
        pct_capital,
        pct_votos
    from {{ ref('graph_edges') }}
),

nodes as (
    select
        node_id,
        node_kind,
        name,
        cpf_masked
    from {{ ref('graph_nodes') }}
),

-- Direct person holdings (one hop)
direct_holdings as (
    select
        e.from_id as person_node_id,
        n_person.name as person_name,
        n_person.cpf_masked,
        e.to_id as company_node_id,
        n_company.name as company_name,
        e.pct_capital as pct_economica_pessoa,
        e.pct_votos as pct_votos_pessoa,
        1 as path_length
    from edges e
    inner join nodes n_person on e.from_id = n_person.node_id
    inner join nodes n_company on e.to_id = n_company.node_id
    where n_person.node_kind = 'person'
),

-- Two-hop paths (person → company1 → company2)
two_hop_holdings as (
    select
        e1.from_id as person_node_id,
        n_person.name as person_name,
        n_person.cpf_masked,
        e2.to_id as company_node_id,
        n_company.name as company_name,
        case
            when e1.pct_capital is not null and e2.pct_capital is not null
            then e1.pct_capital * e2.pct_capital / 100.0
            else null
        end as pct_economica_pessoa,
        case
            when e1.pct_votos is not null and e2.pct_votos is not null
            then e1.pct_votos * e2.pct_votos / 100.0
            else null
        end as pct_votos_pessoa,
        2 as path_length
    from edges e1
    inner join edges e2 on e1.to_id = e2.from_id
    inner join nodes n_person on e1.from_id = n_person.node_id
    inner join nodes n_company on e2.to_id = n_company.node_id
    where n_person.node_kind = 'person'
),

-- Three-hop paths (person → company1 → company2 → company3)
three_hop_holdings as (
    select
        e1.from_id as person_node_id,
        n_person.name as person_name,
        n_person.cpf_masked,
        e3.to_id as company_node_id,
        n_company.name as company_name,
        case
            when e1.pct_capital is not null 
                and e2.pct_capital is not null 
                and e3.pct_capital is not null
            then e1.pct_capital * e2.pct_capital * e3.pct_capital / 10000.0
            else null
        end as pct_economica_pessoa,
        case
            when e1.pct_votos is not null 
                and e2.pct_votos is not null 
                and e3.pct_votos is not null
            then e1.pct_votos * e2.pct_votos * e3.pct_votos / 10000.0
            else null
        end as pct_votos_pessoa,
        3 as path_length
    from edges e1
    inner join edges e2 on e1.to_id = e2.from_id
    inner join edges e3 on e2.to_id = e3.from_id
    inner join nodes n_person on e1.from_id = n_person.node_id
    inner join nodes n_company on e3.to_id = n_company.node_id
    where n_person.node_kind = 'person'
),

-- Four-hop paths (person → company1 → company2 → company3 → company4)
four_hop_holdings as (
    select
        e1.from_id as person_node_id,
        n_person.name as person_name,
        n_person.cpf_masked,
        e4.to_id as company_node_id,
        n_company.name as company_name,
        case
            when e1.pct_capital is not null 
                and e2.pct_capital is not null 
                and e3.pct_capital is not null
                and e4.pct_capital is not null
            then e1.pct_capital * e2.pct_capital * e3.pct_capital * e4.pct_capital / 1000000.0
            else null
        end as pct_economica_pessoa,
        case
            when e1.pct_votos is not null 
                and e2.pct_votos is not null 
                and e3.pct_votos is not null
                and e4.pct_votos is not null
            then e1.pct_votos * e2.pct_votos * e3.pct_votos * e4.pct_votos / 1000000.0
            else null
        end as pct_votos_pessoa,
        4 as path_length
    from edges e1
    inner join edges e2 on e1.to_id = e2.from_id
    inner join edges e3 on e2.to_id = e3.from_id
    inner join edges e4 on e3.to_id = e4.from_id
    inner join nodes n_person on e1.from_id = n_person.node_id
    inner join nodes n_company on e4.to_id = n_company.node_id
    where n_person.node_kind = 'person'
),

-- Five-hop paths (person → c1 → c2 → c3 → c4 → c5)
five_hop_holdings as (
    select
        e1.from_id as person_node_id,
        n_person.name as person_name,
        n_person.cpf_masked,
        e5.to_id as company_node_id,
        n_company.name as company_name,
        case
            when e1.pct_capital is not null 
                and e2.pct_capital is not null 
                and e3.pct_capital is not null
                and e4.pct_capital is not null
                and e5.pct_capital is not null
            then e1.pct_capital * e2.pct_capital * e3.pct_capital * e4.pct_capital * e5.pct_capital / 100000000.0
            else null
        end as pct_economica_pessoa,
        case
            when e1.pct_votos is not null 
                and e2.pct_votos is not null 
                and e3.pct_votos is not null
                and e4.pct_votos is not null
                and e5.pct_votos is not null
            then e1.pct_votos * e2.pct_votos * e3.pct_votos * e4.pct_votos * e5.pct_votos / 100000000.0
            else null
        end as pct_votos_pessoa,
        5 as path_length
    from edges e1
    inner join edges e2 on e1.to_id = e2.from_id
    inner join edges e3 on e2.to_id = e3.from_id
    inner join edges e4 on e3.to_id = e4.from_id
    inner join edges e5 on e4.to_id = e5.from_id
    inner join nodes n_person on e1.from_id = n_person.node_id
    inner join nodes n_company on e5.to_id = n_company.node_id
    where n_person.node_kind = 'person'
),

all_holdings as (
    select * from direct_holdings
    union all
    select * from two_hop_holdings
    union all
    select * from three_hop_holdings
    union all
    select * from four_hop_holdings
    union all
    select * from five_hop_holdings
)

select
    person_node_id,
    person_name,
    cpf_masked,
    company_node_id,
    company_name,
    pct_economica_pessoa,
    pct_votos_pessoa,
    path_length
from all_holdings
order by company_node_id, person_node_id, path_length
