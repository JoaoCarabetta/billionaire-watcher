#!/usr/bin/env python3
"""
Systematically fix all unit test expect fixtures by ensuring complete column lists.
Works by reading model SQL files to extract exact output columns.
"""
import yaml
import re
from pathlib import Path

def extract_select_columns_from_model(model_file):
    """Extract final SELECT columns from a dbt model SQL file."""
    if not model_file.exists():
        return []
    
    content = model_file.read_text()
    
    # Find the final select statement (usually "select * from final_cte" or "select col1, col2...")
    # Look for the last select that's not inside a CTE
    lines = content.split('\n')
    
    # Simple heuristic: find "select * from <cte_name>" at the end
    # or parse the CTE that's being selected
    
    # For now, return known schemas (this would need model-specific logic)
    return []

# Manual model column definitions (extracted from model SQL files)
MODEL_COLUMNS = {
    'identity_facts': ['fact_id', 'person_name', 'fact_kind', 'field', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'control_edge_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'donation_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name'],
    'association_facts': ['fact_id', 'person_name', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name', 'supporting_fact_ids'],
    'published_facts': ['fact_id', 'person_id', 'fact_kind', 'value', 'source_publisher', 'source_locator', 'source_retrieved_at', 'cpf_masked', 'cnpj_basico', 'group_name', 'supporting_fact_ids'],
    'freeze_persons': ['person_name', 'freeze_status', 'cnpj_basico', 'group_name', 'role', 'source_doc', 'cpf_masked'],
    'freeze_persons_with_forbes': ['person_name', 'freeze_status', 'cnpj_basico', 'group_name', 'role', 'source_doc', 'cpf_masked', 'forbes_rank', 'forbes_wealth_brl'],
    'int_freeze_soe': ['person_name', 'cpf_masked', 'cnpj_basico', 'group_name', 'role', 'freeze_status', 'source_doc'],
    'int_freeze_listed_controllers': ['person_name', 'cpf_masked', 'cnpj_basico', 'group_name', 'role', 'freeze_status', 'source_doc'],
    'int_freeze_unlisted_rf': ['person_name', 'cpf_masked', 'cnpj_basico', 'group_name', 'role', 'freeze_status', 'source_doc'],
    'int_forbes_candidates': ['person_name', 'forbes_rank', 'forbes_wealth_brl', 'freeze_status'],
}

def parse_sql_columns(sql):
    """Extract column names from SQL."""
    sql = sql.replace('\\n', '\n').strip()
    # Find "as column_name" patterns
    matches = re.findall(r'\bas\s+([a-zA-Z_][a-zA-Z0-9_]*)', sql, re.IGNORECASE)
    return [m.lower() for m in matches]

def add_columns_to_select(sql_block, required_cols):
    """Add missing columns to a single SELECT statement."""
    lines = sql_block.strip().split('\n')
    existing_cols = parse_sql_columns(sql_block)
    missing_cols = [c for c in required_cols if c.lower() not in existing_cols]
    
    if not missing_cols:
        return sql_block
    
    # Find last line with a column (has "as")
    last_col_idx = -1
    for i in range(len(lines) - 1, -1, -1):
        if ' as ' in lines[i].lower() and not lines[i].strip().startswith('--'):
            last_col_idx = i
            break
    
    if last_col_idx < 0:
        return sql_block
    
    # Add comma to last column if it doesn't have one
    if not lines[last_col_idx].rstrip().endswith(','):
        lines[last_col_idx] = lines[last_col_idx].rstrip() + ','
    
    # Add missing columns
    indent = '  '
    for col in missing_cols:
        lines.insert(last_col_idx + 1, f"{indent}cast(null as varchar) as {col},")
        last_col_idx += 1
    
    # Remove trailing comma from last column
    lines[last_col_idx] = lines[last_col_idx].rstrip().rstrip(',')
    
    return '\n'.join(lines)

def fix_expect_sql(sql, required_cols):
    """Fix expect SQL to include all required columns."""
    sql = sql.replace('\\n', '\n').strip()
    
    # Split by UNION ALL
    parts = re.split(r'\bunion\s+all\b', sql, flags=re.IGNORECASE)
    
    fixed_parts = []
    for part in parts:
        fixed_part = add_columns_to_select(part.strip(), required_cols)
        fixed_parts.append(fixed_part)
    
    return '\nunion all\n'.join(fixed_parts)

def process_test_file(test_file, fixtures_dir):
    """Process a single test file."""
    print(f"\n{'='*60}")
    print(f"Processing {test_file.name}")
    print('='*60)
    
    with open(test_file) as f:
        data = yaml.safe_load(f)
    
    if not data or 'unit_tests' not in data:
        return 0
    
    fixed_count = 0
    
    for test in data['unit_tests']:
        test_name = test.get('name', 'unknown')
        model = test.get('model', '')
        
        if model not in MODEL_COLUMNS:
            print(f"⚠️  {test_name}: model '{model}' not in known models, skipping")
            continue
        
        required_cols = MODEL_COLUMNS[model]
        
        # Check if already uses fixture
        if 'expect' in test and 'fixture' in test['expect']:
            print(f"✓  {test_name}: already uses fixture")
            continue
        
        # Check if has rows to fix
        if 'expect' not in test or 'rows' not in test['expect']:
            print(f"⚠️  {test_name}: no expect rows, skipping")
            continue
        
        sql = test['expect']['rows']
        existing_cols = parse_sql_columns(sql)
        
        if len(existing_cols) >= len(required_cols):
            print(f"✓  {test_name}: already has all {len(required_cols)} columns")
            continue
        
        print(f"🔧 {test_name}: fixing ({len(existing_cols)} -> {len(required_cols)} cols)")
        
        # Fix the SQL
        fixed_sql = fix_expect_sql(sql, required_cols)
        
        # Write to fixture file
        fixture_name = f"{test_name}_expect"
        fixture_file = fixtures_dir / f"{fixture_name}.sql"
        fixture_file.write_text(fixed_sql)
        
        # Update YAML
        test['expect'] = {
            'format': 'sql',
            'fixture': fixture_name
        }
        
        fixed_count += 1
    
    # Write back YAML
    with open(test_file, 'w') as f:
        yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    
    return fixed_count

def main():
    test_dir = Path('tests')
    fixtures_dir = test_dir / 'fixtures'
    fixtures_dir.mkdir(exist_ok=True)
    
    test_files = [
        test_dir / 'unit_test_facts.yml',
        test_dir / 'unit_test_freeze.yml',
        test_dir / 'unit_test_forbes.yml',
    ]
    
    total_fixed = 0
    for test_file in test_files:
        if test_file.exists():
            fixed = process_test_file(test_file, fixtures_dir)
            total_fixed += fixed
    
    print(f"\n{'='*60}")
    print(f"✅ Total tests fixed: {total_fixed}")
    print('='*60)

if __name__ == '__main__':
    main()
