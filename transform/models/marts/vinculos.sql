{{ config(
    labels={'layer': 'marts'},
    persist_docs={'relation': true, 'columns': true}
) }}

with visitado as (
    select vinculo.*
    from {{ ref('int_vinculo_propriedade') }} as vinculo
    inner join {{ ref('int_caminhada') }} as caminhada
        on caminhada.cnpj = vinculo.cnpj
),

dona as (
    select distinct
        origem_id as dono_cnpj,
        cnpj as veiculo_cnpj
    from {{ ref('int_vinculo_propriedade') }}
    where origem_tipo = 'empresa'
      and {{ is_cnpj14('origem_id') }}
      and origem_id != cnpj
),

pessoa_via as (
    select distinct
        origem_id,
        cnpj as emissora,
        via_cnpj
    from visitado
    where origem_tipo = 'pessoa'
      and {{ is_cnpj14('via_cnpj') }}
),

via_interna as (
    select
        pessoa_via.origem_id,
        pessoa_via.emissora,
        pessoa_via.via_cnpj
    from pessoa_via
    where not exists (
        select 1
        from pessoa_via as outra
        inner join dona
            on dona.dono_cnpj = outra.via_cnpj
            and dona.veiculo_cnpj = pessoa_via.via_cnpj
        where outra.origem_id = pessoa_via.origem_id
          and outra.emissora = pessoa_via.emissora
          and outra.via_cnpj != pessoa_via.via_cnpj
    )
),

livro as (
    select visitado.*
    from visitado
    where not (
        origem_tipo = 'pessoa'
        and {{ is_cnpj14('via_cnpj') }}
    )
    and not (
        origem_tipo = 'empresa'
        and {{ is_cnpj14('via_cnpj') }}
        and exists (
            select 1
            from dona
            where dona.dono_cnpj = visitado.origem_id
              and dona.veiculo_cnpj = visitado.via_cnpj
        )
    )
),

inventado as (
    select
        visitado.origem_tipo,
        visitado.origem_id,
        visitado.origem_nome,
        visitado.origem_documento,
        via_interna.via_cnpj as cnpj,
        visitado.papel,
        visitado.fonte,
        visitado.acionista_controlador,
        visitado.participante_acordo_acionistas,
        {{ null_float() }} as percentual_on,
        {{ null_float() }} as percentual_total,
        visitado.qualificacao,
        visitado.tem_informacao_de_controle,
        visitado.data_referencia,
        visitado.fonte_documento
    from visitado
    inner join via_interna
        on via_interna.origem_id = visitado.origem_id
        and via_interna.emissora = visitado.cnpj
        and via_interna.via_cnpj = visitado.via_cnpj
    where visitado.origem_tipo = 'pessoa'
      and {{ is_cnpj14('visitado.via_cnpj') }}
      and not exists (
          select 1
          from livro
          where livro.origem_tipo = 'pessoa'
            and livro.origem_id = visitado.origem_id
            and livro.cnpj = via_interna.via_cnpj
      )
),

caminho as (
    select
        origem_tipo,
        origem_id,
        origem_nome,
        origem_documento,
        cnpj,
        papel,
        fonte,
        acionista_controlador,
        participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        tem_informacao_de_controle,
        data_referencia,
        fonte_documento
    from livro

    union all

    select
        origem_tipo,
        origem_id,
        origem_nome,
        origem_documento,
        cnpj,
        papel,
        fonte,
        acionista_controlador,
        participante_acordo_acionistas,
        percentual_on,
        percentual_total,
        qualificacao,
        tem_informacao_de_controle,
        data_referencia,
        fonte_documento
    from inventado
)

select
    origem_tipo,
    origem_id,
    origem_nome,
    origem_documento,
    cnpj,
    papel,
    fonte,
    acionista_controlador,
    participante_acordo_acionistas,
    percentual_on,
    percentual_total,
    qualificacao,
    tem_informacao_de_controle,
    data_referencia,
    fonte_documento
from caminho
qualify row_number() over (
    partition by origem_id, cnpj, fonte
    order by
        case when percentual_on is not null then 0 else 1 end,
        fonte_documento
) = 1
