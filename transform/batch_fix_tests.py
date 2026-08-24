#!/usr/bin/env python3
import yaml
from pathlib import Path
import re

# Define required columns for each model
MODEL_COLS = {
    'identity_facts': ['fact_id', 'person_name', 'fact_kind', 'field', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'control_edge_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'donation_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'association_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name', 'supporting_fact_ids'],
    'published_facts': ['fact_id', 'person_id', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name', 'supporting_fact_ids'],
}

test_file = Path('tests/unit_test_facts.yml')
with open(test_file) as f:
    data = yaml.safe_load(f)

fixed = 0
for test in data['unit_tests']:
    model = test.get('model', '')
    if model not in MODEL_COLS:
        continue
    
    # Skip if already uses fixture
    if 'expect' in test and 'fixture' in test['expect']:
        continue
    
    if 'expect' not in test or 'rows' not in test['expect']:
        continue
        
    sql = test['expect']['rows'].replace('\\n', '\n')
    required_cols = MODEL_COLS[model]
    
    # Simple check: does the SQL have all required columns?
    has_all = all(col in sql.lower() for col in required_cols)
    
    if not has_all:
        test_name = test['name']
        # Write SQL to fixture
        fixture_name = f"{test_name}_expect"
        fixture_path = Path('tests/fixtures') / f"{fixture_name}.sql"
        
        # Add missing columns as NULL at the end
        existing = [col for col in required_cols if f' as {col}' in sql.lower()]
        missing = [col for col in required_cols if col not in existing]
        
        if missing:
            # Find where to insert (before any WHERE/ORDER BY)
            lines = sql.split('\n')
            insert_pos = len(lines)
            for i, line in enumerate(lines):
                if re.search(r'\b(where|order\s+by|limit)\b', line, re.I):
                    insert_pos = i
                    break
            
            # Add missing columns
            for col in missing:
                lines.insert(insert_pos, f",cast(null as varchar) as {col}")
                insert_pos += 1
            
            sql = '\n'.join(lines)
        
        fixture_path.write_text(sql)
        test['expect'] = {'format': 'sql', 'fixture': fixture_name}
        fixed += 1
        print(f"Fixed: {test_name}")

with open(test_file, 'w') as f:
    yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False)

print(f"\nTotal fixed: {fixed}")
