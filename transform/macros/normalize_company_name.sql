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
    translate(
        replace(upper(trim(coalesce(cast({{ col }} as string), ''))), '&', 'E'),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
        'AAAAAEEEEIIIIOOOOOUUUUCNY'
    ),
    '[^A-Z0-9]',
    '',
    'g'
)
{%- else -%}
regexp_replace(
    translate(
        replace(upper(trim(coalesce(cast({{ col }} as string), ''))), '&', 'E'),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
        'AAAAAEEEEIIIIOOOOOUUUUCNY'
    ),
    r'[^A-Z0-9]',
    ''
)
{%- endif -%}
{%- endmacro %}
