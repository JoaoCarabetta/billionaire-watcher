{{ config(
    labels={'layer': 'marts'},
    persist_docs={'relation': true, 'columns': true}
) }}

with vinculo_pessoa as (
    select *
    from {{ ref('vinculos') }}
    where origem_tipo = 'pessoa'
),

cpf_resolvido as (
    select
        origem_id,
        any_value(origem_documento) as cpf
    from {{ ref('int_vinculo_propriedade') }}
    where origem_tipo = 'pessoa'
      and {{ is_cpf11('origem_documento') }}
    group by origem_id
)

select
    vinculo_pessoa.origem_id as pessoa_id,
    vinculo_pessoa.origem_nome as nome,
    coalesce(
        case
            when {{ is_cpf11('vinculo_pessoa.origem_documento') }}
                then vinculo_pessoa.origem_documento
        end,
        cpf_resolvido.cpf
    ) as cpf
from vinculo_pessoa
left join cpf_resolvido
    on cpf_resolvido.origem_id = vinculo_pessoa.origem_id
qualify row_number() over (
    partition by vinculo_pessoa.origem_id
    order by
        case when {{ is_cpf11('vinculo_pessoa.origem_documento') }} then 0 else 1 end,
        case when vinculo_pessoa.fonte = 'fre' then 0 else 1 end,
        vinculo_pessoa.origem_nome
) = 1
