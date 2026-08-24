-- association_facts.sql
-- Association facts derived from shared control or co-donation
-- Each association lists the fact_ids that support it
-- Association without supporting fact_ids does NOT emit
-- Ordinary candidates stay rows, not dossier persons

with freeze_persons as (
    select distinct person_name
    from {{ ref('freeze_persons_with_forbes') }}
    where freeze_status = 'in' -- Only in-status persons
      and person_name is not null
),

-- Control edge facts (for shared control associations)
control_facts as (
    select
        fact_id,
        person_name,
        cnpj_basico
    from {{ ref('control_edge_facts') }}
    where cnpj_basico is not null
),

-- Donation facts (for co-donation associations)
donation_facts as (
    select
        fact_id,
        person_name,
        -- Extract year from source_locator
        -- Format: "TSE Receitas Candidato {ano} recibo {numero_recibo_eleitoral}"
        regexp_extract(source_locator, r'TSE Receitas Candidato (\d{4})') as ano,
        -- Extract receipt to join back to seed for candidate name
        regexp_extract(source_locator, r'recibo (\S+)') as numero_recibo_eleitoral
    from {{ ref('donation_facts') }}
    where source_locator like 'TSE Receitas%'
),

-- Enrich donation facts with candidate info from seed
donation_facts_enriched as (
    select
        d.fact_id,
        d.person_name,
        d.ano,
        t.nome_candidato
    from donation_facts d
    inner join {{ ref('tse_donations_2026') }} t
        on d.numero_recibo_eleitoral = t.numero_recibo_eleitoral
        and d.ano = cast(t.ano as string)
),

-- Shared control: two freeze persons both control the same company
shared_control_pairs as (
    select
        c1.person_name as person1,
        c2.person_name as person2,
        c1.cnpj_basico,
        array_agg(c1.fact_id order by c1.fact_id) as person1_fact_ids,
        array_agg(c2.fact_id order by c2.fact_id) as person2_fact_ids
    from control_facts c1
    inner join control_facts c2
        on c1.cnpj_basico = c2.cnpj_basico
        and c1.person_name < c2.person_name -- Avoid duplicates, ensure ordering
    inner join freeze_persons f1 on c1.person_name = f1.person_name
    inner join freeze_persons f2 on c2.person_name = f2.person_name
    group by c1.person_name, c2.person_name, c1.cnpj_basico
    having count(*) > 0 -- Must have at least one control fact each
),

-- Co-donation: two freeze persons both donated to the same candidate in the same year
co_donation_pairs as (
    select
        d1.person_name as person1,
        d2.person_name as person2,
        d1.ano,
        d1.nome_candidato,
        array_agg(d1.fact_id order by d1.fact_id) as person1_fact_ids,
        array_agg(d2.fact_id order by d2.fact_id) as person2_fact_ids
    from donation_facts_enriched d1
    inner join donation_facts_enriched d2
        on d1.nome_candidato = d2.nome_candidato
        and d1.ano = d2.ano
        and d1.person_name < d2.person_name -- Avoid duplicates, ensure ordering
    inner join freeze_persons f1 on d1.person_name = f1.person_name
    inner join freeze_persons f2 on d2.person_name = f2.person_name
    group by d1.person_name, d2.person_name, d1.ano, d1.nome_candidato
    having count(*) > 0 -- Must have at least one donation fact each
),

-- Union shared control and co-donation associations
-- Each association publishes TWO rows (one for each person)
-- fact_id includes person_name to ensure uniqueness
shared_control_associations as (
    -- Person1's row
    select
        concat('association_shared_control_', person1, '_', person2, '_', cnpj_basico, '_for_', person1) as fact_id,
        person1 as person_name,
        'association' as fact_kind,
        concat(
            person1,
            ' e ',
            person2,
            ' compartilham controle de empresa CNPJ ',
            cnpj_basico
        ) as value,
        'Billionaire Watcher (derived)' as source_publisher,
        concat(
            'Derived from control facts: ',
            array_to_string(array_concat(person1_fact_ids, person2_fact_ids), ', ')
        ) as source_locator,
        null as source_retrieved_at,
        array_concat(person1_fact_ids, person2_fact_ids) as supporting_fact_ids
    from shared_control_pairs
    
    union all
    
    -- Person2's row (different fact_id, same supporting_fact_ids)
    select
        concat('association_shared_control_', person1, '_', person2, '_', cnpj_basico, '_for_', person2) as fact_id,
        person2 as person_name,
        'association' as fact_kind,
        concat(
            person1,
            ' e ',
            person2,
            ' compartilham controle de empresa CNPJ ',
            cnpj_basico
        ) as value,
        'Billionaire Watcher (derived)' as source_publisher,
        concat(
            'Derived from control facts: ',
            array_to_string(array_concat(person1_fact_ids, person2_fact_ids), ', ')
        ) as source_locator,
        null as source_retrieved_at,
        array_concat(person1_fact_ids, person2_fact_ids) as supporting_fact_ids
    from shared_control_pairs
),

co_donation_associations as (
    -- Person1's row
    select
        concat('association_co_donation_', person1, '_', person2, '_', ano, '_', nome_candidato, '_for_', person1) as fact_id,
        person1 as person_name,
        'association' as fact_kind,
        concat(
            person1,
            ' e ',
            person2,
            ' doaram para ',
            nome_candidato,
            ' em ',
            ano
        ) as value,
        'Billionaire Watcher (derived)' as source_publisher,
        concat(
            'Derived from donation facts: ',
            array_to_string(array_concat(person1_fact_ids, person2_fact_ids), ', ')
        ) as source_locator,
        null as source_retrieved_at,
        array_concat(person1_fact_ids, person2_fact_ids) as supporting_fact_ids
    from co_donation_pairs
    
    union all
    
    -- Person2's row (different fact_id, same supporting_fact_ids)
    select
        concat('association_co_donation_', person1, '_', person2, '_', ano, '_', nome_candidato, '_for_', person2) as fact_id,
        person2 as person_name,
        'association' as fact_kind,
        concat(
            person1,
            ' e ',
            person2,
            ' doaram para ',
            nome_candidato,
            ' em ',
            ano
        ) as value,
        'Billionaire Watcher (derived)' as source_publisher,
        concat(
            'Derived from donation facts: ',
            array_to_string(array_concat(person1_fact_ids, person2_fact_ids), ', ')
        ) as source_locator,
        null as source_retrieved_at,
        array_concat(person1_fact_ids, person2_fact_ids) as supporting_fact_ids
    from co_donation_pairs
),

all_associations as (
    select * from shared_control_associations
    union all
    select * from co_donation_associations
)

select
    fact_id,
    person_name,
    fact_kind,
    value,
    source_publisher,
    source_locator,
    source_retrieved_at,
    cast(null as string) as cpf_masked, -- Associations don't have a single CPF
    cast(null as string) as cnpj_basico, -- May be null for co-donation
    cast(null as string) as group_name, -- Associations don't have a single group
    supporting_fact_ids
from all_associations
where array_length(supporting_fact_ids) > 0 -- Association without supporting fact_ids does NOT emit
