#!/usr/bin/env python3
"""
Fix unit test YAML files by:
1. Adding missing inputs (donation_facts, association_facts) with empty fixtures
2. Fixing malformed SQL strings
3. Ensuring all columns are present in fixtures
"""

import yaml
import json
import re
from pathlib import Path

def get_model_columns(model_name):
    """Return the column schema for common models."""
    schemas = {
        'donation_facts': [
            'fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher',
            'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'
        ],
        'association_facts': [
            'fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher',
            'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico',
            'group_name', 'supporting_fact_ids'
        ],
        'control_edge_facts': [
            'fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher',
            'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'
        ],
        'identity_facts': [
            'fact_id', 'person_name', 'fact_kind', 'field', 'value', 'source_publisher',
            'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'
        ],
    }
    return schemas.get(model_name, [])

def create_empty_fixture(columns):
    """Create an empty SQL fixture with proper column list."""
    if not columns:
        return "select null as dummy_col where false"
    
    col_list = ", ".join([f"cast(null as varchar) as {col}" for col in columns])
    return f"select {col_list} where false"

def fix_sql_string(sql_str):
    """Fix common SQL string issues."""
    # If it's already clean SQL (no embedded newlines), return as-is
    if '\n' not in sql_str and 'select' in sql_str.lower():
        return sql_str
    
    # Unescape newlines
    sql_str = sql_str.replace('\\n', '\n')
    
    # Fix quoted strings (ensure proper quoting)
    # This is a simplified fix; may need adjustment
    return sql_str.strip()

def process_test_file(filepath):
    """Process a single unit test YAML file."""
    print(f"Processing {filepath.name}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse YAML
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError as e:
        print(f"  YAML parse error: {e}")
        return False
    
    if not data or 'unit_tests' not in data:
        print(f"  No unit_tests found")
        return False
    
    modified = False
    for test in data['unit_tests']:
        test_name = test.get('name', 'unknown')
        model_name = test.get('model', '')
        
        # Check if this is a published_facts or other model that needs all fact inputs
        if model_name == 'published_facts':
            required_inputs = ['identity_facts', 'control_edge_facts', 'donation_facts', 'association_facts']
            
            given = test.get('given', [])
            existing_inputs = {g['input'].replace("ref('", "").replace("')", "") for g in given if 'input' in g}
            
            missing_inputs = set(required_inputs) - existing_inputs
            
            if missing_inputs:
                print(f"  {test_name}: adding empty fixtures for {missing_inputs}")
                for missing in sorted(missing_inputs):
                    columns = get_model_columns(missing)
                    empty_sql = create_empty_fixture(columns)
                    given.append({
                        'input': f"ref('{missing}')",
                        'format': 'sql',
                        'rows': empty_sql
                    })
                test['given'] = given
                modified = True
        
        # Fix malformed SQL strings in rows
        if 'given' in test:
            for input_def in test['given']:
                if 'rows' in input_def and isinstance(input_def['rows'], str):
                    original = input_def['rows']
                    fixed = fix_sql_string(original)
                    if fixed != original:
                        input_def['rows'] = fixed
                        modified = True
        
        if 'expect' in test and 'rows' in test['expect'] and isinstance(test['expect']['rows'], str):
            original = test['expect']['rows']
            fixed = fix_sql_string(original)
            if fixed != original:
                test['expect']['rows'] = fixed
                modified = True
    
    if modified:
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        print(f"  ✓ Modified")
        return True
    else:
        print(f"  No changes needed")
        return False

def main():
    test_dir = Path('/workspace/billionaire-watcher/transform/tests')
    test_files = [
        test_dir / 'unit_test_facts.yml',
        test_dir / 'unit_test_freeze.yml',
        test_dir / 'unit_test_forbes.yml',
    ]
    
    for test_file in test_files:
        if test_file.exists():
            process_test_file(test_file)
        else:
            print(f"File not found: {test_file}")

if __name__ == '__main__':
    main()
