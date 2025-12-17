#!/usr/bin/env python3
"""
Explore BMS database schema - get full table structures and sample data
"""
import mysql.connector
import json
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER", "fortyone")
DB_PASSWORD = os.getenv("DB_PASSWORD", "fo123@!")

# Use one store database
DB_CONFIG = {
    "host": "menlyn.jetlinestores.co.za",
    "user": DB_USER,
    "password": DB_PASSWORD,
    "database": "menlynbms2",
    "charset": "utf8mb4",
    "collation": "utf8mb4_general_ci",
    "connect_timeout": 30
}

def get_table_structure(cursor, table_name):
    """Get full column info for a table"""
    cursor.execute(f"DESCRIBE {table_name}")
    return cursor.fetchall()

def get_sample_data(cursor, query, limit=5):
    """Get sample data from query"""
    cursor.execute(f"{query} LIMIT {limit}")
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    return columns, rows

def main():
    print("Connecting to BMS database...")
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    output = {
        "tables": {},
        "sample_data": {}
    }

    # Tables to explore
    tables = ["bms_machines", "bms_meterreading", "vtiger_crmentity"]

    print("\n=== TABLE STRUCTURES ===\n")
    for table in tables:
        print(f"\n--- {table} ---")
        try:
            structure = get_table_structure(cursor, table)
            output["tables"][table] = []
            for col in structure:
                col_info = {
                    "name": col[0],
                    "type": col[1],
                    "null": col[2],
                    "key": col[3],
                    "default": str(col[4]) if col[4] else None,
                    "extra": col[5]
                }
                output["tables"][table].append(col_info)
                print(f"  {col[0]:40} {col[1]:20} {col[2]:5} {col[3]:5}")
        except Exception as e:
            print(f"  Error: {e}")

    # Get full join sample
    print("\n\n=== FULL JOIN SAMPLE DATA ===\n")

    full_query = """
    SELECT *
    FROM bms_machines ma
    LEFT JOIN vtiger_crmentity crm ON crm.crmid = ma.machinesid
    LEFT JOIN bms_meterreading mrd ON mrd.asset = ma.machinesid
    LEFT JOIN vtiger_crmentity crme ON crme.crmid = mrd.meterreadingid
    WHERE ma.serialnumber IS NOT NULL
    """

    try:
        columns, rows = get_sample_data(cursor, full_query, limit=2)
        print(f"Total columns: {len(columns)}")
        print("\nColumn names:")
        for i, col in enumerate(columns):
            print(f"  [{i:3}] {col}")

        output["sample_data"]["full_join"] = {
            "columns": columns,
            "sample_count": len(rows)
        }

        print(f"\n\nSample row values (first row):")
        if rows:
            for i, (col, val) in enumerate(zip(columns, rows[0])):
                val_str = str(val)[:80] if val else "NULL"
                print(f"  [{i:3}] {col:40} = {val_str}")
    except Exception as e:
        print(f"Error: {e}")

    # Save to JSON
    with open("bms_schema_exploration.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print("\n\nSchema exploration saved to bms_schema_exploration.json")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
