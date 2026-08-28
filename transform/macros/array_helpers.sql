{% macro empty_string_array() -%}
{%- if target.type == 'bigquery' -%}
cast([] as array<string>)
{%- else -%}
cast([] as varchar[])
{%- endif -%}
{%- endmacro %}


{% macro walk_visited_seed(id_expression) -%}
[{{ id_expression }}]
{%- endmacro %}


{% macro walk_visited_append(visited_expression, id_expression) -%}
{%- if target.type == 'bigquery' -%}
array_concat({{ visited_expression }}, [{{ id_expression }}])
{%- else -%}
list_append({{ visited_expression }}, {{ id_expression }})
{%- endif -%}
{%- endmacro %}


{% macro walk_id_not_visited(id_expression, visited_expression) -%}
{%- if target.type == 'bigquery' -%}
{{ id_expression }} not in unnest({{ visited_expression }})
{%- else -%}
not list_contains({{ visited_expression }}, {{ id_expression }})
{%- endif -%}
{%- endmacro %}


{% macro walk_join_key_unnest(id_expression, cnpj8_expression) -%}
{%- if target.type == 'bigquery' -%}
unnest([{{ id_expression }}, {{ cnpj8_expression }}]) as join_key
{%- else -%}
unnest([{{ id_expression }}, {{ cnpj8_expression }}]) as _walk_jk(join_key)
{%- endif -%}
{%- endmacro %}
