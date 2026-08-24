#!/usr/bin/env python3
"""
Automatically fix all dbt unit tests by adding missing columns.
This script processes all test files and ensures complete column lists.
"""

import re
import yaml

# Complete column definitions for all models
COLUMNS = {
    'freeze_persons_with_forbes_all': """cast(null as integer) as group_rank,
            cast(null as varchar) as group_name,
            cast(null as varchar) as cnpj_basico,
            cast(null as varchar) as ranking_source,
            cast(null as varchar) as receita_fy2024_brl,
            cast(null as boolean) as listed_flag,
            cast(null as boolean) as soe_flag,
            cast(null as varchar) as controlador_tipo,
            cast(null as varchar) as person_name,
            cast(null as varchar) as role,
            cast(null as varchar) as edge_label,
            cast(null as varchar) as acordo_acionistas,
            cast(null as varchar) as source_doc,
            cast(null as varchar) as fre_item,
            cast(null as boolean) as hole,
            cast(null as varchar) as cpf_masked,
            cast(null as varchar) as freeze_status,
            cast(null as varchar) as notes""",
    
    'donation_facts_all': """cast(null as varchar) as fact_id,
            cast(null as varchar) as person_name,
            cast(null as varchar) as fact_kind,
            cast(null as varchar) as value,
            cast(null as varchar) as source_publisher,
            cast(null as varchar) as source_locator,
            cast(null as varchar) as source_retrieved_at,
            cast(null as varchar) as cpf_masked,
            cast(null as varchar) as cnpj_basico,
            cast(null as varchar) as group_name"""
}

def ensure_freeze_columns(rows_sql):
    """Add missing columns to freeze_persons_with_forbes given input."""
    needed_cols = ['group_rank', 'ranking_source', 'receita_fy2024_brl', 'listed_flag', 
                   'soe_flag', 'controlador_tipo', 'edge_label', 'acordo_acionistas', 
                   'fre_item', 'hole', 'notes']
    
    missing = [col for col in needed_cols if col not in rows_sql]
    
    if not missing:
        return rows_sql
    
    # Add each missing column
    for col in missing:
        if col in ['group_rank']:
            add_col = f",\\n            cast(null as integer) as {col}"
        elif col in ['listed_flag', 'soe_flag', 'hole']:
            add_col = f",\\n            cast(null as boolean) as {col}"
        else:
            add_col = f",\\n            cast(null as varchar) as {col}"
        
        # Find a good insertion point (before 'union all' or end of select)
        if 'union all' in rows_sql:
            rows_sql = rows_sql.replace('union all', add_col + '\\n          union all')
        elif 'where false' in rows_sql:
            rows_sql = rows_sql.replace('where false', add_col + '\\n          where false')
        else:
            rows_sql = rows_sql.rstrip('"') + add_col + '"'
    
    return rows_sql

def ensure_donation_expect_columns(rows_sql):
    """Add all columns to donation_facts expect output."""
    needed_cols = ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 
                   'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name']
    
    # Check if we're missing columns
    missing = [col for col in needed_cols if f'{col}' not in rows_sql or rows_sql.count(col) < 2]
    
    if len(missing) > 5:  # If many are missing, need comprehensive fix
        # This needs manual attention - just note it
        print(f"Note: donation expect needs manual fix - missing {len(missing)} columns")
    
    return rows_sql

# Process files
print("This automated fix is complex - manual fixes recommended")
print("Pattern identified: All tests need complete column lists in given/expect")

