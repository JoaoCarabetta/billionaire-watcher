-- One row per step of each concrete cited path from an e_oligarca person
-- to a seed Formulário door. Direct seed-Formulário people keep a one-step
-- path. Partners of a holding on that door (and the same up the chain) get
-- a multi-step path. Hop citations never become a last step.

with recursive seeds as (
    select empresa_id
    from {{ ref('empresas') }}
    where motivo_entrada = 'semente' or em_semente_a
),

oligarchs as (
    select pessoa_id
    from {{ ref('pessoas') }}
    where e_oligarca
),

vinculos as (
    select *
    from {{ ref('vinculos') }}
),

seed_door_edges as (
    select
        edges.*,
        case
            when edges.fonte = 'qsa' then 'socio_qsa'
            when edges.acionista_controlador then 'controlador_fre'
            when edges.percentual_on >= 10 then 'dez_por_cento_on'
        end as regra_do_passo
    from vinculos as edges
    inner join seeds
        on edges.destino_empresa_id = seeds.empresa_id
    where
        edges.fonte = 'fre'
        and (
            edges.acionista_controlador
            or edges.percentual_on >= 10
        )
),

direct_seed_doors as (
    select
        edges.origem_pessoa_id as pessoa_id,
        edges.destino_empresa_id as empresa_semente_id,
        concat(
            edges.origem_pessoa_id,
            '|',
            edges.destino_empresa_id,
            '|',
            edges.fonte,
            '|',
            cast(edges.data_referencia as string)
        ) as percurso_id,
        cast(1 as int64) as passo,
        edges.origem_tipo,
        edges.origem_pessoa_id,
        edges.origem_empresa_id,
        edges.destino_empresa_id,
        edges.papel,
        edges.fonte,
        edges.acionista_controlador,
        edges.participante_acordo_acionistas,
        edges.percentual_on,
        edges.percentual_total,
        edges.qualificacao,
        edges.data_referencia,
        edges.regra_do_passo,
        edges.fonte_documento
    from seed_door_edges as edges
    inner join oligarchs
        on edges.origem_pessoa_id = oligarchs.pessoa_id
    where edges.origem_tipo = 'pessoa'
),

-- Each row is one company-to-company hop on a concrete chain from a door
-- holding (height 0) up to a company that owns through vinculos to that door.
company_chains as (
    select
        edges.origem_empresa_id as head_empresa_id,
        edges.destino_empresa_id as empresa_semente_id,
        concat(
            edges.origem_empresa_id,
            '>',
            edges.destino_empresa_id,
            '>',
            edges.fonte,
            '>',
            cast(edges.data_referencia as string)
        ) as chain_key,
        concat('|', edges.origem_empresa_id, '|') as visited_path,
        0 as height,
        edges.origem_tipo,
        edges.origem_pessoa_id,
        edges.origem_empresa_id,
        edges.destino_empresa_id,
        edges.papel,
        edges.fonte,
        edges.acionista_controlador,
        edges.participante_acordo_acionistas,
        edges.percentual_on,
        edges.percentual_total,
        edges.qualificacao,
        edges.data_referencia,
        edges.regra_do_passo,
        edges.fonte_documento
    from seed_door_edges as edges
    where edges.origem_tipo = 'empresa'

    union all

    select
        edges.origem_empresa_id as head_empresa_id,
        chains.empresa_semente_id,
        concat(
            edges.origem_empresa_id,
            '>',
            edges.destino_empresa_id,
            '>',
            edges.fonte,
            '>',
            cast(edges.data_referencia as string),
            '>>',
            chains.chain_key
        ) as chain_key,
        concat(chains.visited_path, edges.origem_empresa_id, '|') as visited_path,
        chains.height + 1 as height,
        edges.origem_tipo,
        edges.origem_pessoa_id,
        edges.origem_empresa_id,
        edges.destino_empresa_id,
        edges.papel,
        edges.fonte,
        edges.acionista_controlador,
        edges.participante_acordo_acionistas,
        edges.percentual_on,
        edges.percentual_total,
        edges.qualificacao,
        edges.data_referencia,
        case
            when edges.fonte = 'qsa' then 'socio_qsa'
            when edges.acionista_controlador then 'controlador_fre'
            when edges.percentual_on >= 10 then 'dez_por_cento_on'
            else 'socio_qsa'
        end as regra_do_passo,
        edges.fonte_documento
    from company_chains as chains
    inner join vinculos as edges
        on edges.origem_tipo = 'empresa'
        and edges.origem_empresa_id is not null
        and edges.destino_empresa_id = chains.head_empresa_id
    where
        strpos(
            chains.visited_path,
            concat('|', edges.origem_empresa_id, '|')
        ) = 0
        and chains.height < 50
),

inherited_starts as (
    select
        people.origem_pessoa_id as pessoa_id,
        chains.empresa_semente_id,
        concat(
            people.origem_pessoa_id,
            '|',
            people.destino_empresa_id,
            '|',
            people.fonte,
            '|',
            cast(people.data_referencia as string),
            '>>',
            chains.chain_key
        ) as percurso_id,
        chains.chain_key,
        chains.height as attach_height,
        people.origem_tipo,
        people.origem_pessoa_id,
        people.origem_empresa_id,
        people.destino_empresa_id,
        people.papel,
        people.fonte,
        people.acionista_controlador,
        people.participante_acordo_acionistas,
        people.percentual_on,
        people.percentual_total,
        people.qualificacao,
        people.data_referencia,
        case
            when people.fonte = 'qsa' then 'socio_qsa'
            when people.acionista_controlador then 'controlador_fre'
            when people.percentual_on >= 10 then 'dez_por_cento_on'
            else 'socio_qsa'
        end as regra_do_passo,
        people.fonte_documento
    from vinculos as people
    inner join company_chains as chains
        on people.destino_empresa_id = chains.head_empresa_id
    inner join oligarchs
        on people.origem_pessoa_id = oligarchs.pessoa_id
    where
        people.origem_tipo = 'pessoa'
        and people.fonte in ('fre', 'qsa')
),

inherited_person_steps as (
    select
        pessoa_id,
        empresa_semente_id,
        percurso_id,
        cast(1 as int64) as passo,
        origem_tipo,
        origem_pessoa_id,
        origem_empresa_id,
        destino_empresa_id,
        papel,
        fonte,
        acionista_controlador,
        participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        data_referencia,
        regra_do_passo,
        fonte_documento
    from inherited_starts
),

inherited_company_steps as (
    select
        starts.pessoa_id,
        starts.empresa_semente_id,
        starts.percurso_id,
        cast(starts.attach_height - chains.height + 2 as int64) as passo,
        chains.origem_tipo,
        chains.origem_pessoa_id,
        chains.origem_empresa_id,
        chains.destino_empresa_id,
        chains.papel,
        chains.fonte,
        chains.acionista_controlador,
        chains.participante_acordo_acionistas,
        chains.percentual_on,
        chains.percentual_total,
        chains.qualificacao,
        chains.data_referencia,
        chains.regra_do_passo,
        chains.fonte_documento
    from inherited_starts as starts
    inner join company_chains as chains
        on starts.empresa_semente_id = chains.empresa_semente_id
        and (
            starts.chain_key = chains.chain_key
            or right(
                starts.chain_key,
                length(chains.chain_key) + 2
            ) = concat('>>', chains.chain_key)
        )
)

select
    pessoa_id,
    empresa_semente_id,
    percurso_id,
    passo,
    origem_tipo,
    origem_pessoa_id,
    origem_empresa_id,
    destino_empresa_id,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    data_referencia,
    regra_do_passo,
    fonte_documento
from direct_seed_doors

union all

select
    pessoa_id,
    empresa_semente_id,
    percurso_id,
    passo,
    origem_tipo,
    origem_pessoa_id,
    origem_empresa_id,
    destino_empresa_id,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    data_referencia,
    regra_do_passo,
    fonte_documento
from inherited_person_steps

union all

select
    pessoa_id,
    empresa_semente_id,
    percurso_id,
    passo,
    origem_tipo,
    origem_pessoa_id,
    origem_empresa_id,
    destino_empresa_id,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    data_referencia,
    regra_do_passo,
    fonte_documento
from inherited_company_steps
