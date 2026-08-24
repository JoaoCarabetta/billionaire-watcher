#!/usr/bin/env python3
"""
Bulk fix all dbt unit tests by adding missing inputs and columns.
"""

import re

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

# Read current test files
facts_content = read_file('/workspace/transform/tests/unit_test_facts.yml')

# Pattern: Add missing inputs to published_facts tests
# Find tests where model: published_facts but missing donation_facts or association_facts

lines = facts_content.split('\n')
output_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    output_lines.append(line)
    
    # Check if this is a published_facts test
    if line.strip() == 'model: published_facts':
        # Scan ahead to find the given section
        given_start = i + 1
        while given_start < len(lines) and lines[given_start].strip() != 'given:':
            given_start += 1
        
        # Scan for expect section
        expect_start = given_start + 1
        has_donation = False
        has_association = False
        
        while expect_start < len(lines) and lines[expect_start].strip() != 'expect:':
            if 'donation_facts' in lines[expect_start]:
                has_donation = True
            if 'association_facts' in lines[expect_start]:
                has_association = True
            expect_start += 1
        
        # If we're now at the expect line and we're missing inputs
        if expect_start < len(lines) and lines[expect_start].strip() == 'expect:':
            i += 1
            # Copy lines until we hit expect
            while i < expect_start:
                output_lines.append(lines[i])
                i += 1
            
            # Add missing inputs before expect
            if not has_donation:
                output_lines.append('  - input: ref(\'donation_facts\')')
                output_lines.append('    format: sql')
                output_lines.append('    fixture: empty_donation_facts')
            
            if not has_association:
                output_lines.append('  - input: ref(\'association_facts\')')
                output_lines.append('    format: sql')
                output_lines.append('    fixture: empty_association_facts')
            
            # Now add the expect line
            output_lines.append(lines[i])
            i += 1
            continue
    
    i += 1

# Write back
write_file('/workspace/transform/tests/unit_test_facts.yml', '\n'.join(output_lines))
print("Fixed published_facts tests")

