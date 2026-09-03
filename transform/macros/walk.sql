{% macro fold_upper(col) -%}
translate(
    upper(trim(coalesce(cast({{ col }} as string), ''))),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'AAAAAEEEEIIIIOOOOOUUUUCNY'
)
{%- endmacro %}

{% macro qsa_ownership_qualificacao() -%}
(
    '20', '21', '22', '23', '24', '25', '26', '28', '29', '30', '31', '34',
    '37', '38', '47', '48', '49', '50', '52', '53', '54', '55', '56', '57',
    '58', '59', '65', '66', '67', '68', '74', '75', '78', '79'
)
{%- endmacro %}

{% macro is_cpf11(col) -%}
{%- if target.type == 'duckdb' -%}
regexp_matches(cast({{ col }} as varchar), '^[0-9]{11}$')
{%- else -%}
regexp_contains(cast({{ col }} as string), r'^[0-9]{11}$')
{%- endif %}
{%- endmacro %}

{% macro is_placeholder_cnpj(col) -%}
(
    {{ col }} is not null
    and length({{ digits_only(col) }}) > 0
    {%- if target.type == 'duckdb' %}
    and regexp_matches({{ digits_only(col) }}, '^0+$')
    {%- else %}
    and regexp_contains({{ digits_only(col) }}, r'^0+$')
    {%- endif %}
)
{%- endmacro %}

{# 14 digits, not the CVM all-zero placeholder (never Banco do Brasil 00000000000191). False when null. #}
{% macro is_cnpj14(col) -%}
(
    {{ col }} is not null
    and length({{ col }}) = 14
    {%- if target.type == 'duckdb' %}
    and regexp_matches(cast({{ col }} as varchar), '^[0-9]{14}$')
    and not regexp_matches(cast({{ col }} as varchar), '^0+$')
    {%- else %}
    and regexp_contains(cast({{ col }} as string), r'^[0-9]{14}$')
    and not regexp_contains(cast({{ col }} as string), r'^0+$')
    {%- endif %}
)
{%- endmacro %}

{% macro cpf_mask6(col) -%}
case
    when {{ is_cpf11(col) }} then substr(cast({{ col }} as string), 4, 6)
    when length({{ digits_only(col) }}) = 6 then {{ digits_only(col) }}
    else cast(null as string)
end
{%- endmacro %}

{% macro pessoa_id_origem(documento_expr, nome_expr, cnpj_expr) -%}
case
    when {{ is_cpf11(documento_expr) }}
        then {{ person_id_from_cpf(documento_expr) }}
    else concat('nome:', {{ normalize_person_name(nome_expr) }}, '@', {{ cnpj_expr }})
end
{%- endmacro %}

{% macro person_n_tok(chave) -%}
{%- if target.type == 'duckdb' -%}
len(string_split({{ chave }}, ' '))
{%- else -%}
array_length(split({{ chave }}, ' '))
{%- endif -%}
{%- endmacro %}

{% macro person_first_tok(chave) -%}
{%- if target.type == 'duckdb' -%}
string_split({{ chave }}, ' ')[1]
{%- else -%}
split({{ chave }}, ' ')[offset(0)]
{%- endif -%}
{%- endmacro %}

{% macro person_last_tok(chave) -%}
{%- if target.type == 'duckdb' -%}
string_split({{ chave }}, ' ')[-1]
{%- else -%}
split({{ chave }}, ' ')[offset(array_length(split({{ chave }}, ' ')) - 1)]
{%- endif -%}
{%- endmacro %}

{% macro name_edit_distance(left_expr, right_expr) -%}
{%- if target.type == 'duckdb' -%}
levenshtein({{ left_expr }}, {{ right_expr }})
{%- else -%}
edit_distance({{ left_expr }}, {{ right_expr }})
{%- endif -%}
{%- endmacro %}

{% macro tokens_contained(inner_chave, outer_chave) -%}
{%- if target.type == 'duckdb' -%}
list_has_all(string_split({{ outer_chave }}, ' '), string_split({{ inner_chave }}, ' '))
{%- else -%}
not exists (
    select 1
    from unnest(split({{ inner_chave }}, ' ')) as tok
    where tok not in unnest(split({{ outer_chave }}, ' '))
)
{%- endif -%}
{%- endmacro %}

{% macro matriz_order() -%}
    case when identificador_matriz_filial = '1' then 0 else 1 end,
    case when situacao_cadastral = '02' then 0 else 1 end,
    case when cnpj_ordem = '0001' then 0 else 1 end,
    cnpj
{%- endmacro %}

{% macro null_float() -%}
{%- if target.type == 'duckdb' -%}
cast(null as double)
{%- else -%}
cast(null as float64)
{%- endif -%}
{%- endmacro %}

{% macro null_bool() -%}
cast(null as boolean)
{%- endmacro %}
