from app.database import execute_query

print("Equipment columns:")
try:
    cols = execute_query("DESCRIBE Equipment")
    for c in cols:
        print(f"  {c['Field']}: {c['Type']}")
except Exception as e:
    print(f"ERROR: {e}")

print("\nSecurityLog columns:")
try:
    cols = execute_query("DESCRIBE SecurityLog")
    for c in cols:
        print(f"  {c['Field']}: {c['Type']}")
except Exception as e:
    print(f"ERROR: {e}")
