{% macro person_id_from_cpf(cpf_expression) -%}
    {%- if target.type == 'bigquery' -%}
        concat(
            'p-',
            substr(to_hex(sha256(cast({{ cpf_expression }} as bytes))), 1, 8)
        )
    {%- else -%}
        concat(
            'p-',
            substr(sha256(cast({{ cpf_expression }} as varchar)), 1, 8)
        )
    {%- endif -%}
{%- endmacro %}
