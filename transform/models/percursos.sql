-- One row per step of each concrete cited path from a current e_oligarca
-- person to a seed Formulário door. Today's flag is the seed Formulário
-- citation itself, so stored paths are one step (person → seed). Holding
-- partners are not inherited here; that is issue 193.

with seeds as (
    select empresa_id
    from {{ ref('empresas') }}
    where motivo_entrada = 'semente' or em_semente_a
),

oligarchs as (
    select pessoa_id
    from {{ ref('pessoas') }}
    where e_oligarca
),

qualifying_seed_doors as (
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
        case
            when edges.fonte = 'qsa' then 'socio_qsa'
            when edges.acionista_controlador then 'controlador_fre'
            when edges.percentual_on >= 10 then 'dez_por_cento_on'
        end as regra_do_passo,
        edges.fonte_documento
    from {{ ref('vinculos') }} as edges
    inner join seeds
        on edges.destino_empresa_id = seeds.empresa_id
    inner join oligarchs
        on edges.origem_pessoa_id = oligarchs.pessoa_id
    where
        edges.origem_tipo = 'pessoa'
        and edges.fonte = 'fre'
        and (
            edges.acionista_controlador
            or edges.percentual_on >= 10
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
from qualifying_seed_doors
