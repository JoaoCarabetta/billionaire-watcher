-- int_forbes_candidates.sql
-- Forbes safety-net: add natural persons as role=candidato_forbes, freeze_status=review
-- AFTER positional freeze. Additive only.
--
-- Add ONLY if ALL of:
-- 1. On Forbes World's Billionaires (seed/fixture)
-- 2. Brazil-operations nexus = true
-- 3. NOT already in positional freeze (not in freeze_persons with freeze_status in ('in', 'skip_soe'))
-- 4. Documentable control of Brazil-operating group (group MAY be outside top-50)
--
-- Do NOT auto-promote to freeze_status=in even if control_doc_available=true.
-- Humans promote. Models stay review.

with forbes_seed as (
    select * from {{ ref('forbes_billionaires_brazil_nexus') }}
),

positional_freeze as (
    select
        person_name,
        cnpj_basico,
        freeze_status
    from {{ ref('freeze_persons') }}
    where freeze_status in ('in', 'skip_soe')
),

forbes_with_nexus as (
    select
        f.person_name,
        f.forbes_year,
        f.estimated_wealth_usd_billions,
        f.cnpj_basico,
        f.notes,
        f.source_doc,
        f.control_doc_available
    from forbes_seed f
    where f.brazil_operations_nexus = true
),

-- Filter out persons already in positional freeze
-- Match on person_name + cnpj_basico OR person_name alone if cnpj_basico is null
forbes_not_in_freeze as (
    select
        f.person_name,
        f.forbes_year,
        f.estimated_wealth_usd_billions,
        f.cnpj_basico,
        f.notes,
        f.source_doc,
        f.control_doc_available
    from forbes_with_nexus f
    left join positional_freeze pf
        on f.person_name = pf.person_name
        and (
            f.cnpj_basico = pf.cnpj_basico
            or (f.cnpj_basico is null and pf.cnpj_basico is null)
        )
    where pf.person_name is null
),

-- Final candidates: same columns as freeze_persons
forbes_candidates as (
    select
        null as group_rank,
        null as group_name,
        cnpj_basico,
        'Forbes World''s Billionaires ' || cast(forbes_year as string) as ranking_source,
        null as receita_fy2024_brl,
        false as listed_flag,
        false as soe_flag,
        null as controlador_tipo,
        person_name,
        'candidato_forbes' as role,
        null as edge_label,
        null as acordo_acionistas,
        source_doc,
        null as fre_item,
        false as hole,
        null as cpf_masked,
        'review' as freeze_status,
        notes
    from forbes_not_in_freeze
)

select
    group_rank,
    group_name,
    cnpj_basico,
    ranking_source,
    receita_fy2024_brl,
    listed_flag,
    soe_flag,
    controlador_tipo,
    person_name,
    role,
    edge_label,
    acordo_acionistas,
    source_doc,
    fre_item,
    hole,
    cpf_masked,
    freeze_status,
    notes
from forbes_candidates
