#!/usr/bin/env python3
"""
Compare database query results with Volumes from Xerox.xlsx
Serial numbers are unique per printer - use them as the key for comparison
"""

import mysql.connector
import openpyxl
from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict

# Database credentials
DB_USER = "fortyone"
DB_PASSWORD = "fo123@!"

# Companies list from lib/companies.ts
COMPANIES = [
    {"schema": "corporateprintbms2", "name": "Jetline Corporate", "host": "172.20.251.127", "port": 3306},
    {"schema": "burlingtonbms2", "name": "Burlington", "host": "172.20.251.127", "port": 3306},
    {"schema": "typoprintingbms2", "name": "Typo", "host": "172.20.251.127", "port": 3306},
    {"schema": "anglobms2", "name": "Anglo", "host": "172.20.251.127", "port": 3306},
    {"schema": "formattsolutionsbms2", "name": "Formatt", "host": "172.20.251.127", "port": 3306},
    {"schema": "landkbms2", "name": "L and K", "host": "172.20.251.127", "port": 3306},
    {"schema": "marinsbms2", "name": "Marins", "host": "172.20.251.127", "port": 3306},
    {"schema": "25amcpsbms2", "name": "Corporate Print 25AM", "host": "172.20.251.127", "port": 3306},
    {"schema": "masterskillbms2", "name": "Masterskill", "host": "172.20.251.127", "port": 3306},
    {"schema": "nscbms2", "name": "Fixtrade", "host": "172.20.251.127", "port": 3306},
    {"schema": "pocketmediabms2", "name": "Pocket Media", "host": "172.20.251.127", "port": 3306},
    {"schema": "raptorbms2", "name": "Raptor", "host": "172.20.251.127", "port": 3306},
    {"schema": "systemprintbms2", "name": "SystemPrint", "host": "172.20.251.127", "port": 3306},
    {"schema": "firstlabelsbms2", "name": "First Labels", "host": "172.20.251.127", "port": 3306},
    {"schema": "welkombms2", "name": "Welkom", "host": "172.20.251.127", "port": 3306},
    {"schema": "witbankbms2", "name": "Witbank", "host": "172.20.251.127", "port": 3306},
    {"schema": "gardensbms2", "name": "Gardens", "host": "wizardzgardens.jetlinestores.co.za", "port": 3306},
    {"schema": "printoutsolutionsbms2", "name": "PrintOut", "host": "172.20.251.127", "port": 3306},
    {"schema": "waterfrontbms2", "name": "Waterfront", "host": "wizardzwaterfront.jetlinestores.co.za", "port": 3306},
    {"schema": "centurycitybms2", "name": "Century City", "host": "centurycity.jetlinestores.co.za", "port": 3306},
    {"schema": "albertonbms2", "name": "Alberton", "host": "alberton.jetlinestores.co.za", "port": 3306},
    {"schema": "bedfordviewbms2", "name": "Bedfordview", "host": "bedfordview.jetlinestores.co.za", "port": 3306},
    {"schema": "blackheathbms2", "name": "Blackheath", "host": "blackheath.jetlinestores.co.za", "port": 3306},
    {"schema": "boksburgbms2", "name": "Boksburg", "host": "boksburg.jetlinestores.co.za", "port": 3306},
    {"schema": "benonibms2", "name": "Benoni", "host": "benoni.jetlinestores.co.za", "port": 3306},
    {"schema": "braamfonteinbms2", "name": "Braamfontein", "host": "braamfontein.jetlinestores.co.za", "port": 3306},
    {"schema": "bryanstonbms2", "name": "Bryanston", "host": "bryanston.jetlinestores.co.za", "port": 3306},
    {"schema": "durbanbms2", "name": "Durban", "host": "durban.jetlinestores.co.za", "port": 3306},
    {"schema": "foxstreetbms2", "name": "Foxstreet", "host": "foxstreet.jetlinestores.co.za", "port": 3306},
    {"schema": "parktowncorporateprintbms2", "name": "Hillcrestcps", "host": "parktown.jetlinestores.co.za", "port": 3306},
    {"schema": "hillcrestbms2", "name": "Hillcrest", "host": "hillcrest.jetlinestores.co.za", "port": 3306},
    {"schema": "kyalamibms2", "name": "Kyalami", "host": "kyalami.jetlinestores.co.za", "port": 3306},
    {"schema": "melrosebms2", "name": "Melrose", "host": "melrose.jetlinestores.co.za", "port": 3306},
    {"schema": "menlynbms2", "name": "Menlyn", "host": "menlyn.jetlinestores.co.za", "port": 3306},
    {"schema": "parktownbms2", "name": "Parktown", "host": "parktown.jetlinestores.co.za", "port": 3306},
    {"schema": "pietermaritzburgbms2", "name": "Pietermaritzburg", "host": "pietermaritzburg.jetlinestores.co.za", "port": 3306},
    {"schema": "sunninghillbms2", "name": "Sunninghill", "host": "sunninghill.jetlinestores.co.za", "port": 3306},
    {"schema": "polokwanebms2", "name": "Polokwane", "host": "polokwane.jetlinestores.co.za", "port": 3306},
    {"schema": "rivoniabms2", "name": "Rivonia", "host": "rivonia.jetlinestores.co.za", "port": 3306},
    {"schema": "rosebankbms2", "name": "Rosebank", "host": "rosebank.jetlinestores.co.za", "port": 3306},
    {"schema": "rustenburgbms2", "name": "Rustenburg", "host": "rustenburg.jetlinestores.co.za", "port": 3306},
    {"schema": "sandownbms2", "name": "Sandown", "host": "sandown.jetlinestores.co.za", "port": 3306},
    {"schema": "illovobms2", "name": "Illovo", "host": "illovo.jetlinestores.co.za", "port": 3306},
    {"schema": "montanabms2", "name": "Montana", "host": "montana.jetlinestores.co.za", "port": 3306},
    {"schema": "brooklynbms2", "name": "Brooklyn", "host": "brooklyn.jetlinestores.co.za", "port": 3306},
    {"schema": "potchbms2", "name": "Potchefstroom", "host": "potchefstroom.jetlinestores.co.za", "port": 3306},
    {"schema": "woodmeadbms2", "name": "Woodmead", "host": "woodmead.jetlinestores.co.za", "port": 3306},
    {"schema": "georgebms2", "name": "George", "host": "george.jetlinestores.co.za", "port": 3306},
    {"schema": "modderfonteinbms2", "name": "Modderfontein", "host": "modderfontein.jetlinestores.co.za", "port": 3306},
    {"schema": "vaalreefsbms2", "name": "Vaalreefs", "host": "vaalreefs.jetlinestores.co.za", "port": 3306},
    {"schema": "klerksdorpbms2", "name": "Klerksdorp", "host": "klerksdorp.jetlinestores.co.za", "port": 3306},
    {"schema": "greenpointbms2", "name": "Greenpoint", "host": "greenpoint.jetlinestores.co.za", "port": 3306},
    {"schema": "randburgbms2", "name": "Randburg", "host": "randburg.jetlinestores.co.za", "port": 3306},
    {"schema": "hydeparkbms2", "name": "Hydepark", "host": "hydepark.jetlinestores.co.za", "port": 3306},
    {"schema": "fourwaysbms2", "name": "Fourways", "host": "fourways.jetlinestores.co.za", "port": 3306},
    {"schema": "centurionbms2", "name": "Centurion", "host": "centurion.jetlinestores.co.za", "port": 3306},
    {"schema": "nelspruitbms2", "name": "Nelspruit", "host": "nelspruit.jetlinestores.co.za", "port": 3306},
    {"schema": "witsbms2", "name": "Wits", "host": "wits.jetlinestores.co.za", "port": 3306},
    {"schema": "constantiabms2", "name": "Constantia", "host": "constantia.jetlinestores.co.za", "port": 3306},
    {"schema": "stellenboschbms2", "name": "Stellenbosch", "host": "stellenbosch.jetlinestores.co.za", "port": 3306},
    {"schema": "tygervalleybms2", "name": "Tygervalley", "host": "tygervalley.jetlinestores.co.za", "port": 3306},
    {"schema": "midrandbms2", "name": "Midrand", "host": "midrand.jetlinestores.co.za", "port": 3306},
    {"schema": "mmabathobms2", "name": "Mmabatho", "host": "mmabatho.jetlinestores.co.za", "port": 3306},
    {"schema": "ballitobms2", "name": "Ballito", "host": "ballito.jetlinestores.co.za", "port": 3306}
]

QUERY = """
SELECT
    ma.serialnumber,
    ma.machine_model_name,
    mrd.reading_date,
    mrd.total as totalamt
FROM bms_machines ma
LEFT JOIN vtiger_crmentity crm on crm.crmid = ma.machinesid
LEFT JOIN bms_meterreading mrd on mrd.asset = ma.machinesid
LEFT JOIN vtiger_crmentity crme on crme.crmid = mrd.meterreadingid
WHERE crm.deleted <> 1
    AND ma.serialnumber IS NOT NULL
    AND mrd.total IS NOT NULL
    AND mrd.reading_date IS NOT NULL
ORDER BY ma.serialnumber, mrd.reading_date;
"""


def load_excel_data(filepath: str) -> Dict:
    """Load and parse Excel file - key by serial number"""
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active

    # Structure: {serial: {month: volume}}
    data = defaultdict(lambda: defaultdict(float))

    # Skip first 2 header rows
    for row in ws.iter_rows(min_row=3, values_only=True):
        customer, model, serial, month_year, volume = row

        # Skip aggregate rows (where serial is None or "Total")
        if serial and serial != "Total" and month_year and month_year != "Total":
            data[str(serial)][month_year] = volume

    return data


def query_all_databases() -> Dict:
    """Query all company databases and return combined results by serial"""
    # Structure: {serial: {month: {volume, model, schema}}}
    all_data = defaultdict(lambda: defaultdict(dict))

    for i, company in enumerate(COMPANIES, 1):
        print(f"[{i}/{len(COMPANIES)}] Querying {company['name']} ({company['schema']})...")

        try:
            conn = mysql.connector.connect(
                host=company["host"],
                port=company["port"],
                user=DB_USER,
                password=DB_PASSWORD,
                database=company["schema"]
            )
            cursor = conn.cursor()
            cursor.execute(QUERY)
            results = cursor.fetchall()
            cursor.close()
            conn.close()

            # Process results
            for serial, model, reading_date, total in results:
                if serial and reading_date and total:
                    try:
                        month_year = reading_date.strftime("%b-%Y")
                        all_data[str(serial)][month_year] = {
                            'volume': total,
                            'model': model,
                            'schema': company['schema'],
                            'company': company['name']
                        }
                    except:
                        continue

            print(f"  ✓ Retrieved {len(results)} rows")

        except Exception as e:
            print(f"  ✗ Error: {e}")

    return all_data


def compare_data(excel_data: Dict, db_data: Dict):
    """Compare Excel and database data by serial number"""
    print("\n" + "="*80)
    print("COMPARISON RESULTS")
    print("="*80 + "\n")

    # Get all serial numbers from both sources
    all_serials = set(excel_data.keys()) | set(db_data.keys())

    total_matches = 0
    total_mismatches = 0
    total_db_only = 0
    total_excel_only = 0
    serials_in_both = 0
    serials_db_only = 0
    serials_excel_only = 0

    for serial in sorted(all_serials):
        excel_months = excel_data.get(serial, {})
        db_months = db_data.get(serial, {})

        # Get all months for this serial
        all_months = set(excel_months.keys()) | set(db_months.keys())

        if excel_months and db_months:
            serials_in_both += 1
        elif db_months:
            serials_db_only += 1
            print(f"\n⚠️  Serial {serial} only in DB ({db_months[list(db_months.keys())[0]]['company']})")
            continue
        elif excel_months:
            serials_excel_only += 1
            print(f"\n⚠️  Serial {serial} only in Excel")
            continue

        # Compare month by month for this serial
        matches = 0
        mismatches = 0
        db_only = 0
        excel_only = 0

        for month in sorted(all_months):
            db_info = db_months.get(month, {})
            db_vol = db_info.get('volume')
            excel_vol = excel_months.get(month)

            if db_vol and excel_vol:
                if abs(db_vol - excel_vol) < 1:  # Allow small rounding differences
                    matches += 1
                else:
                    mismatches += 1
                    if mismatches == 1:  # Print header on first mismatch
                        print(f"\n❌ Serial {serial} ({db_info.get('model', 'Unknown')} - {db_info.get('company', 'Unknown')}):")
                    print(f"  {month}: DB={db_vol:,.0f} vs Excel={excel_vol:,.0f} (diff={abs(db_vol - excel_vol):,.0f})")
            elif db_vol:
                db_only += 1
            elif excel_vol:
                excel_only += 1

        # Only print if there were differences
        if matches > 0 and mismatches == 0 and db_only == 0 and excel_only == 0:
            company = db_months[list(db_months.keys())[0]]['company']
            model = db_months[list(db_months.keys())[0]]['model']
            print(f"✓ Serial {serial} ({model} - {company}): All {matches} months match")

        total_matches += matches
        total_mismatches += mismatches
        total_db_only += db_only
        total_excel_only += excel_only

    # Print summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Serials in both:     {serials_in_both}")
    print(f"Serials DB only:     {serials_db_only}")
    print(f"Serials Excel only:  {serials_excel_only}")
    print(f"\nMonth-by-month comparison:")
    print(f"  Matches:           {total_matches}")
    print(f"  Mismatches:        {total_mismatches}")
    print(f"  DB only:           {total_db_only}")
    print(f"  Excel only:        {total_excel_only}")


def main():
    excel_path = "/Users/alwynkotze/Documents/JDW/jetline-machines-automation/Volumes from Xerox.xlsx"

    print("Loading Excel data...")
    excel_data = load_excel_data(excel_path)
    print(f"✓ Loaded {len(excel_data)} unique serials from Excel\n")

    print("Querying all databases...")
    db_data = query_all_databases()
    print(f"\n✓ Loaded {len(db_data)} unique serials from databases\n")

    compare_data(excel_data, db_data)


if __name__ == "__main__":
    main()
