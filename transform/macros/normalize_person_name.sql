{% macro normalize_person_name(name_expression) -%}
    {%- if target.type == 'duckdb' -%}
        regexp_replace(
            trim(
                replace(
                    translate(
                        upper(trim(coalesce(cast({{ name_expression }} as varchar), ''))),
                        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
                        'AAAAAEEEEIIIIOOOOOUUUUCNY'
                    ),
                    '-',
                    ' '
                )
            ),
            '\s+',
            ' ',
            'g'
        )
    {%- else -%}
        regexp_replace(
            trim(
                replace(
                    translate(
                        upper(trim(coalesce(cast({{ name_expression }} as string), ''))),
                        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
                        'AAAAAEEEEIIIIOOOOOUUUUCNY'
                    ),
                    '-',
                    ' '
                )
            ),
            r'\s+',
            ' '
        )
    {%- endif -%}
{%- endmacro %}
