select
    cast(null as varchar) as fact_id,
    cast(null as varchar) as person_name,
    cast(null as varchar) as fact_kind,
    cast(null as varchar) as value,
    cast(null as varchar) as source_publisher,
    cast(null as varchar) as source_locator,
    cast(null as varchar) as source_retrieved_at,
    cast(null as varchar) as cpf_masked,
    cast(null as varchar) as cnpj_basico,
    cast(null as varchar) as group_name,
    NULL::VARCHAR[] as supporting_fact_ids
where false
