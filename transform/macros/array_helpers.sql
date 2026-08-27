{% macro empty_string_array() -%}
{%- if target.type == 'bigquery' -%}
cast([] as array<string>)
{%- else -%}
cast([] as varchar[])
{%- endif -%}
{%- endmacro %}
