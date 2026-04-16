#!/usr/bin/env python3
"""Test script for API endpoints"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import execute_query

# Test 1: Check Equipment table
print("=" * 50)
print("TEST 1: Equipment Table Structure")
print("=" * 50)
try:
    result = execute_query("DESCRIBE Equipment")
    print("Equipment table exists. Columns:")
    for row in result:
        print(f"  - {row.get('Field', 'N/A')}: {row.get('Type', 'N/A')}")
except Exception as e:
    print(f"ERROR: {e}")

# Test 2: Check if SecurityLog table exists
print("\n" + "=" * 50)
print("TEST 2: SecurityLog Table Structure")
print("=" * 50)
try:
    result = execute_query("DESCRIBE SecurityLog")
    print("SecurityLog table exists. Columns:")
    for row in result:
        print(f"  - {row.get('Field', 'N/A')}: {row.get('Type', 'N/A')}")
except Exception as e:
    print(f"ERROR: {e}")

# Test 3: Check User table
print("\n" + "=" * 50)
print("TEST 3: User Table Structure")
print("=" * 50)
try:
    result = execute_query("DESCRIBE User")
    print("User table exists. Columns:")
    for row in result:
        print(f"  - {row.get('Field', 'N/A')}: {row.get('Type', 'N/A')}")
except Exception as e:
    print(f"ERROR: {e}")

# Test 4: Check sample Equipment records
print("\n" + "=" * 50)
print("TEST 4: Sample Equipment Records")
print("=" * 50)
try:
    result = execute_query("SELECT id, model, status, assignedTo FROM Equipment LIMIT 2")
    print(f"Found {len(result)} equipment records")
    for row in result:
        print(f"  - ID: {row.get('id')}, Model: {row.get('model')}, Status: {row.get('status')}")
except Exception as e:
    print(f"ERROR: {e}")

print("\nTest complete!")
