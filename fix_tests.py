#!/usr/bin/env python3
import re

def fix_test_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Fix source_retrieved_at dates
    content = re.sub(
        r"'2026-08-24' as source_retrieved_at",
        "cast(null as varchar) as source_retrieved_at",
        content
    )
    
    # Fix array syntax
    content = re.sub(
        r'cast\(null as varchar\[\]\) as supporting_fact_ids',
        'NULL::VARCHAR[] as supporting_fact_ids',
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")

# Fix all test files
for f in ['/workspace/transform/tests/unit_test_facts.yml',
          '/workspace/transform/tests/unit_test_freeze.yml',
          '/workspace/transform/tests/unit_test_forbes.yml']:
    try:
        fix_test_file(f)
    except Exception as e:
        print(f"Error: {e}")
