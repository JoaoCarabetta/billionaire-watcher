#!/usr/bin/env python3
"""Comprehensive fix for all remaining unit tests."""

import re

def add_missing_freeze_columns(freeze_sql):
    """Add all missing columns to a freeze_persons_with_forbes given input."""
    # Required columns for freeze_persons_with_forbes
    required = [
        'group_rank', 'group_name', 'cnpj_basico', 'ranking_source', 'receita_fy2024_brl',
        'listed_flag', 'soe_flag', 'controlador_tipo', 'person_name', 'role', 'edge_label',
        'acordo_acionistas', 'source_doc', 'fre_item', 'hole', 'cpf_masked', 'freeze_status', 'notes'
    ]
    
    # Check which columns are missing
    missing = []
    for col in required:
        if f'{col} as' not in freeze_sql and f'as {col}' not in freeze_sql:
            missing.append(col)
    
    if not missing:
        return freeze_sql
    
    # Add missing columns at the end (before any union or where clause)
    additions = []
    for col in missing:
        if col in ['group_rank']:
            additions.append(f"cast(null as integer) as {col}")
        elif col in ['listed_flag', 'soe_flag', 'hole']:
            additions.append(f"cast(null as boolean) as {col}")
        else:
            additions.append(f"cast(null as varchar) as {col}")
    
    # Find the last column definition before union/where
    lines = freeze_sql.split('\\n')
    # Insert before the last closing quote or where clause
    insert_pos = -1
    for i, line in enumerate(lines):
        if 'where false' in line or 'union all' in line:
            insert_pos = i
            break
    
    if insert_pos > 0:
        for add in additions:
            lines.insert(insert_pos, f"            {add},")
        # Remove trailing comma from what's now the last column
        if lines[insert_pos-1].rstrip().endswith(','):
            lines[insert_pos-1] = lines[insert_pos-1].rstrip()[:-1]
    
    return '\\n'.join(lines)

# Read test file
with open('/workspace/transform/tests/unit_test_facts.yml', 'r') as f:
    content = f.read()

# Fix all freeze_persons_with_forbes inputs that are missing columns
pattern = r"(input: ref\('freeze_persons_with_forbes'\).*?rows: \")(.*?)(\"\\s*format: sql)"
matches = list(re.finditer(pattern, content, re.DOTALL))

for match in reversed(matches):  # Reverse to maintain positions
    current_sql = match.group(2)
    fixed_sql = add_missing_freeze_columns(current_sql)
    if fixed_sql != current_sql:
        content = content[:match.start(2)] + fixed_sql + content[match.end(2):]
        print(f"Fixed a freeze_persons_with_forbes input")

# Write back
with open('/workspace/transform/tests/unit_test_facts.yml', 'w') as f:
    f.write(content)

print("Done fixing freeze inputs")
