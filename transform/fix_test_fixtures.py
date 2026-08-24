#!/usr/bin/env python3
"""
Extract inline SQL to fixture files and add missing columns.
"""

import yaml
import re
from pathlib import Path

# Model output columns
MODEL_COLUMNS = {
    'identity_facts': ['fact_id', 'person_name', 'fact_kind', 'field', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'control_edge_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'donation_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'association_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name', 'supporting_fact_ids'],
    'published_facts': ['fact_id', 'person_id', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name', 'supporting_fact_ids'],
}

def extract_columns_from_sql(sql_str):
    """Extract column names from a SQL SELECT statement."""
    sql_str = sql_str.replace('\\n', '\n').strip()
    
    # Find all "as column_name" patterns (case insensitive)
    pattern = r'as\s+([a-zA-Z_][a-zA-Z0-9_]*)'
    matches = re.findall(pattern, sql_str, re.IGNORECASE)
    
    return matches

def add_missing_columns_to_sql(sql_str, required_cols):
    """Add missing columns to SQL with null values."""
    sql_str = sql_str.replace('\\n', '\n').strip()
    existing_cols = extract_columns_from_sql(sql_str)
    missing_cols = [c for c in required_cols if c not in existing_cols]
    
    if not missing_cols:
        return sql_str
    
    # Add missing columns as cast(null as varchar)
    # Find the last column definition and add after it
    # This is a simplified approach - for complex SQL might need refinement
    
    # Split by union all
    parts = re.split(r'\bunion\s+all\b', sql_str, flags=re.IGNORECASE)
    
    fixed_parts = []
    for part in parts:
        part = part.strip()
        if not part.lower().startswith('select'):
            fixed_parts.append(part)
            continue
        
        # Find where to insert (before any trailing clauses like where/order by)
        # For simplicity, assume the SELECT ends at the last column
        lines = part.split('\n')
        
        # Find the last line with a column definition
        last_col_idx = -1
        for i in range(len(lines) - 1, -1, -1):
            if ' as ' in lines[i].lower():
                last_col_idx = i
                break
        
        if last_col_idx >= 0:
            # Add missing columns after the last column
            for col in missing_cols:
                lines.insert(last_col_idx + 1, f"            cast(null as varchar) as {col},")
            
            # Remove trailing comma from original last column
            if lines[last_col_idx].rstrip().endswith(','):
                pass  # Already has comma
            else:
                lines[last_col_idx] = lines[last_col_idx].rstrip() + ','
            
            # Remove comma from new last column
            if lines[last_col_idx + len(missing_cols)].rstrip().endswith(','):
                lines[last_col_idx + len(missing_cols)] = lines[last_col_idx + len(missing_cols)].rstrip()[:-1]
        
        fixed_parts.append('\n'.join(lines))
    
    return '\nunion all\n'.join(fixed_parts)

def process_test_file(filepath, fixtures_dir):
    """Process a test file and extract/fix fixtures."""
    print(f"Processing {filepath.name}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError as e:
        print(f"  YAML error: {e}")
        return
    
    if not data or 'unit_tests' not in data:
        return
    
    test_counter = {}
    
    for test in data['unit_tests']:
        test_name = test.get('name', 'unknown')
        model_name = test.get('model', '')
        
        if model_name not in MODEL_COLUMNS:
            continue
        
        required_cols = MODEL_COLUMNS[model_name]
        
        # Process expect
        if 'expect' in test and 'rows' in test['expect'] and isinstance(test['expect']['rows'], str):
            sql_str = test['expect']['rows']
            existing_cols = extract_columns_from_sql(sql_str)
            
            if len(existing_cols) < len(required_cols):
                print(f"  {test_name}: adding {len(required_cols) - len(existing_cols)} missing columns to expect")
                
                fixed_sql = add_missing_columns_to_sql(sql_str, required_cols)
                
                # Write to fixture file
                fixture_name = f"{test_name}_expect"
                counter = test_counter.get(fixture_name, 0) + 1
                test_counter[fixture_name] = counter
                
                fixture_file = fixtures_dir / f"{fixture_name}.sql"
                with open(fixture_file, 'w', encoding='utf-8') as f:
                    f.write(fixed_sql)
                
                # Update YAML to reference fixture
                test['expect'] = {
                    'format': 'sql',
                    'fixture': fixture_name
                }
    
    # Write back YAML
    with open(filepath, 'w', encoding='utf-8') as f:
        yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    
    print(f"  ✓ Done")

def main():
    test_dir = Path('/workspace/billionaire-watcher/transform/tests')
    fixtures_dir = test_dir / 'fixtures'
    fixtures_dir.mkdir(exist_ok=True)
    
    test_files = [
        test_dir / 'unit_test_facts.yml',
    ]
    
    for test_file in test_files:
        if test_file.exists():
            process_test_file(test_file, fixtures_dir)

if __name__ == '__main__':
    main()
