{% macro digits_only(col) -%}
{%- if target.type == 'duckdb' -%}
regexp_replace(cast({{ col }} as string), '[^0-9]', '', 'g')
{%- else -%}
regexp_replace(cast({{ col }} as string), r'[^0-9]', '')
{%- endif -%}
{%- endmacro %}

{% macro prefix8_from_cnpj14(col) -%}
case
    when length({{ digits_only(col) }}) = 14 then left({{ digits_only(col) }}, 8)
    else cast(null as string)
end
{%- endmacro %}

{% macro normalize_company_name(col) -%}
{%- if target.type == 'duckdb' -%}
regexp_replace(
    regexp_replace(
        ' ' || regexp_replace(
            translate(
                replace(upper(trim(coalesce(cast({{ col }} as string), ''))), '&', 'E'),
                'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
                'AAAAAEEEEIIIIOOOOOUUUUCNY'
            ),
            '[^A-Z0-9]',
            ' ',
            'g'
        ) || ' ',
        ' CIA ',
        ' COMPANHIA ',
        'g'
    ),
    '[^A-Z0-9]',
    '',
    'g'
)
{%- else -%}
regexp_replace(
    regexp_replace(
        concat(
            ' ',
            regexp_replace(
                translate(
                    replace(upper(trim(coalesce(cast({{ col }} as string), ''))), '&', 'E'),
                    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
                    'AAAAAEEEEIIIIOOOOOUUUUCNY'
                ),
                r'[^A-Z0-9]',
                ' '
            ),
            ' '
        ),
        r' CIA ',
        ' COMPANHIA '
    ),
    r'[^A-Z0-9]',
    ''
)
{%- endif -%}
{%- endmacro %}

{% macro text_before_dash(col) -%}
regexp_replace({{ col }}, {% if target.type == 'duckdb' %}' - .*'{% else %}r' - .*'{% endif %}, '')
{%- endmacro %}

{% macro first_parenthetical(col) -%}
regexp_extract({{ col }}, {% if target.type == 'duckdb' %}'\(([^)]+)\)'{% else %}r'\(([^)]+)\)'{% endif %}, 1)
{%- endmacro %}

{% macro strip_legal_suffix(chave_col) -%}
regexp_replace({{ chave_col }}, {% if target.type == 'duckdb' %}'(SA|LTDA|EIRELI)$'{% else %}r'(SA|LTDA|EIRELI)$'{% endif %}, '')
{%- endmacro %}
