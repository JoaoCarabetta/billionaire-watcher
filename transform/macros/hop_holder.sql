{% macro is_outros_holder(name_col) -%}
(
    {{ normalize_company_name(name_col) }} like 'OUTROS%'
    or {{ normalize_company_name(name_col) }} like '%TESOURARIA%'
)
{%- endmacro %}

{# Company key is prefix-8 of a 14-digit Cadastro only. Eleven-digit
   documents stay persons (name key), never a padded /0001 company. #}
{% macro hop_holder_id(name_col, doc_col, seed_col, fallback_id) -%}
case
    when {{ is_outros_holder(name_col) }} then concat('outros-', {{ seed_col }})
    when length({{ digits_only(doc_col) }}) = 14 then left({{ digits_only(doc_col) }}, 8)
    when {{ normalize_company_name(name_col) }} <> '' then {{ normalize_company_name(name_col) }}
    else concat('id-', cast({{ fallback_id }} as string))
end
{%- endmacro %}

{% macro hop_holder_kind(name_col, doc_col) -%}
case
    when {{ is_outros_holder(name_col) }} then 'outros'
    when length({{ digits_only(doc_col) }}) = 14 then 'company'
    else 'person'
end
{%- endmacro %}
