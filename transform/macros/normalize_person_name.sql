{% macro normalize_person_name(name_expression) -%}
    {%- if target.type == 'duckdb' -%}
        upper(
            regexp_replace(
                trim(cast({{ name_expression }} as varchar)),
                '\s+',
                ' ',
                'g'
            )
        )
    {%- else -%}
        upper(
            regexp_replace(
                trim(cast({{ name_expression }} as string)),
                r'\s+',
                ' '
            )
        )
    {%- endif -%}
{%- endmacro %}
