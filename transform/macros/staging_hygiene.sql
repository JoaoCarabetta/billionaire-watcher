{% macro clean_string(col) -%}
nullif(trim(cast({{ col }} as string)), '')
{%- endmacro %}

{% macro cnpj14(col) -%}
case
    when length({{ digits_only(col) }}) between 1 and 14
        and not {{ is_placeholder_cnpj(col) }}
    then lpad({{ digits_only(col) }}, 14, '0')
    else cast(null as string)
end
{%- endmacro %}

{% macro cnpj8(col) -%}
case
    when length({{ digits_only(col) }}) between 1 and 8
    then lpad({{ digits_only(col) }}, 8, '0')
    else cast(null as string)
end
{%- endmacro %}

{% macro documento_identificador(col) -%}
case
    when length({{ digits_only(col) }}) = 14
        then lpad({{ digits_only(col) }}, 14, '0')
    when length({{ digits_only(col) }}) = 11
        then lpad({{ digits_only(col) }}, 11, '0')
    when length({{ digits_only(col) }}) = 8
        then lpad({{ digits_only(col) }}, 8, '0')
    else {{ clean_string(col) }}
end
{%- endmacro %}

{% macro to_int64(col) -%}
{%- if target.type == 'duckdb' -%}
try_cast({{ clean_string(col) }} as bigint)
{%- else -%}
safe_cast({{ clean_string(col) }} as int64)
{%- endif -%}
{%- endmacro %}

{% macro to_float64(col) -%}
{%- if target.type == 'duckdb' -%}
try_cast({{ clean_string(col) }} as double)
{%- else -%}
safe_cast({{ clean_string(col) }} as float64)
{%- endif -%}
{%- endmacro %}

{% macro to_numeric(col) -%}
{%- if target.type == 'duckdb' -%}
try_cast({{ clean_string(col) }} as decimal(38, 9))
{%- else -%}
safe_cast({{ clean_string(col) }} as numeric)
{%- endif -%}
{%- endmacro %}

{% macro parse_br_numeric(col) -%}
{%- if target.type == 'duckdb' -%}
try_cast(
    case
        when {{ clean_string(col) }} is null then null
        when position(',' in {{ clean_string(col) }}) > 0
            then replace(replace({{ clean_string(col) }}, '.', ''), ',', '.')
        else {{ clean_string(col) }}
    end as decimal(38, 9)
)
{%- else -%}
safe_cast(
    case
        when {{ clean_string(col) }} is null then null
        when regexp_contains({{ clean_string(col) }}, r',')
            then replace(replace({{ clean_string(col) }}, '.', ''), ',', '.')
        else {{ clean_string(col) }}
    end as numeric
)
{%- endif -%}
{%- endmacro %}

{% macro to_date(col) -%}
{%- if target.type == 'duckdb' -%}
coalesce(
    try_cast({{ clean_string(col) }} as date),
    cast(try_strptime({{ clean_string(col) }}, '%Y-%m-%d') as date),
    cast(try_strptime({{ clean_string(col) }}, '%d/%m/%Y') as date),
    cast(    try_strptime({{ clean_string(col) }}, '%Y%m%d') as date),
    cast(try_strptime({{ clean_string(col) }}, '%m-%d-%Y') as date)
)
{%- else -%}
coalesce(
    safe_cast({{ clean_string(col) }} as date),
    safe.parse_date('%Y-%m-%d', {{ clean_string(col) }}),
    safe.parse_date('%d/%m/%Y', {{ clean_string(col) }}),
    safe.parse_date('%Y%m%d', {{ clean_string(col) }}),
    safe.parse_date('%m-%d-%Y', {{ clean_string(col) }})
)
{%- endif -%}
{%- endmacro %}

{% macro to_date_yyyymmdd(col) -%}
{%- if target.type == 'duckdb' -%}
cast(try_strptime({{ clean_string(col) }}, '%Y%m%d') as date)
{%- else -%}
safe.parse_date('%Y%m%d', {{ clean_string(col) }})
{%- endif -%}
{%- endmacro %}
