#!/usr/bin/env python3
"""
Compare database query results with Volumes from Xerox.xlsx
FIXED: Calculate incremental volumes from cumulative DB readings
"""

import mysql.connector
import openpyxl
from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict

# Database credentials
DB_USER = "fortyone"
DB_PASSWORD = "fo123@!"

# Companies list from lib/companies.ts (excluding braamfonteinbms2)
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

    # Skip first 2 header rows, skip "Total" rows
    for row in ws.iter_rows(min_row=3, values_only=True):
        customer, model, serial, month_year, volume = row

        if serial and serial != "Total" and month_year and month_year != "Total":
            data[str(serial)][month_year] = volume

    return data


def calculate_incremental_volumes(raw_data: List[Tuple]) -> Dict:
    """
    Convert cumulative totals to incremental monthly volumes
    raw_data: List of (serial, model, date, cumulative_total)
    Returns: {serial: {month: {incremental_volume, model, company}}}
    """
    # First, organize by serial and sort by date
    by_serial = defaultdict(list)
    for serial, model, date, total, company in raw_data:
        if serial and date and total is not None:
            by_serial[str(serial)].append((date, total, model, company))

    # Calculate incremental for each serial
    result = defaultdict(lambda: defaultdict(dict))

    for serial, readings in by_serial.items():
        # Sort by date
        readings.sort(key=lambda x: x[0])

        # Group by month and take max reading per month (handles duplicates)
        monthly_max = {}
        for date, total, model, company in readings:
            month_year = date.strftime("%b-%Y")
            if month_year not in monthly_max or total > monthly_max[month_year][0]:
                monthly_max[month_year] = (total, model, company)

        # Sort months chronologically
        sorted_months = sorted(monthly_max.items(), key=lambda x: datetime.strptime(x[0], "%b-%Y"))

        # Calculate incremental volumes
        prev_total = 0
        for month_year, (total, model, company) in sorted_months:
            incremental = total - prev_total
            if incremental >= 0:  # Only count positive increments
                result[serial][month_year] = {
                    'volume': incremental,
                    'model': model,
                    'company': company,
                    'cumulative': total
                }
            prev_total = total

    return result


def query_all_databases() -> List[Tuple]:
    """Query all company databases and return raw results"""
    all_results = []

    for i, company in enumerate(COMPANIES, 1):
        print(f"[{i}/{len(COMPANIES)}] Querying {company['name']} ({company['schema']})...")

        try:
            conn = mysql.connector.connect(
                host=company["host"],
                port=company["port"],
                user=DB_USER,
                password=DB_PASSWORD,
                database=company["schema"],
                connect_timeout=10
            )
            cursor = conn.cursor()
            cursor.execute(QUERY)
            results = cursor.fetchall()
            cursor.close()
            conn.close()

            # Add company name to each result
            for row in results:
                all_results.append((*row, company['name']))

            print(f"  ✓ Retrieved {len(results)} rows")

        except Exception as e:
            print(f"  ✗ Error: {e}")

    return all_results


def compare_data(excel_data: Dict, db_data: Dict):
    """Compare Excel and database incremental volumes"""
    print("\n" + "="*80)
    print("COMPARISON RESULTS (Incremental Volumes)")
    print("="*80 + "\n")

    all_serials = set(excel_data.keys()) | set(db_data.keys())

    total_matches = 0
    total_mismatches = 0
    total_db_only = 0
    total_excel_only = 0
    serials_in_both = 0
    serials_db_only = 0
    serials_excel_only = 0

    mismatch_details = []

    for serial in sorted(all_serials):
        excel_months = excel_data.get(serial, {})
        db_months = db_data.get(serial, {})

        all_months = set(excel_months.keys()) | set(db_months.keys())

        if excel_months and db_months:
            serials_in_both += 1
        elif db_months:
            serials_db_only += 1
            continue
        elif excel_months:
            serials_excel_only += 1
            continue

        # Compare month by month
        matches = 0
        mismatches = 0
        db_only = 0
        excel_only = 0

        serial_mismatches = []

        for month in sorted(all_months):
            db_info = db_months.get(month, {})
            db_vol = db_info.get('volume')
            excel_vol = excel_months.get(month)

            if db_vol is not None and excel_vol is not None:
                diff = abs(db_vol - excel_vol)
                pct_diff = (diff / excel_vol * 100) if excel_vol > 0 else 0

                # Consider match if within 5% or absolute difference < 100
                if diff < 100 or pct_diff < 5:
                    matches += 1
                else:
                    mismatches += 1
                    serial_mismatches.append({
                        'month': month,
                        'db': db_vol,
                        'excel': excel_vol,
                        'diff': diff,
                        'pct': pct_diff
                    })
            elif db_vol is not None:
                db_only += 1
            elif excel_vol is not None:
                excel_only += 1

        if matches > 0:
            company = list(db_months.values())[0]['company']
            model = list(db_months.values())[0]['model']
            if mismatches == 0:
                print(f"✓ Serial {serial} ({model} - {company}): All {matches} months match")
            else:
                mismatch_details.append({
                    'serial': serial,
                    'model': model,
                    'company': company,
                    'matches': matches,
                    'mismatches': mismatches,
                    'details': serial_mismatches
                })

        total_matches += matches
        total_mismatches += mismatches
        total_db_only += db_only
        total_excel_only += excel_only

    # Print mismatches
    if mismatch_details:
        print(f"\n{'='*80}")
        print(f"SERIALS WITH MISMATCHES ({len(mismatch_details)})")
        print(f"{'='*80}\n")
        for item in mismatch_details[:10]:  # Show first 10
            print(f"\n❌ Serial {item['serial']} ({item['model']} - {item['company']}):")
            print(f"   Matches: {item['matches']} | Mismatches: {item['mismatches']}")
            for detail in item['details'][:5]:  # Show first 5 months
                print(f"   {detail['month']}: DB={detail['db']:,.0f} vs Excel={detail['excel']:,.0f} (diff={detail['diff']:,.0f}, {detail['pct']:.1f}%)")

    # Print summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Serials in both:     {serials_in_both}")
    print(f"Serials DB only:     {serials_db_only}")
    print(f"Serials Excel only:  {serials_excel_only}")
    print(f"\nMonth-by-month comparison (incremental volumes):")
    print(f"  Matches:           {total_matches}")
    print(f"  Mismatches:        {total_mismatches}")
    print(f"  DB only:           {total_db_only}")
    print(f"  Excel only:        {total_excel_only}")

    if total_matches + total_mismatches > 0:
        accuracy = (total_matches / (total_matches + total_mismatches)) * 100
        print(f"\nAccuracy: {accuracy:.1f}%")


def main():
    excel_path = "/Users/alwynkotze/Documents/JDW/jetline-machines-automation/Volumes from Xerox.xlsx"

    print("Loading Excel data...")
    excel_data = load_excel_data(excel_path)
    print(f"✓ Loaded {len(excel_data)} unique serials from Excel\n")

    print("Querying all databases...")
    raw_results = query_all_databases()
    print(f"\n✓ Retrieved {len(raw_results)} total rows\n")

    print("Calculating incremental volumes from cumulative totals...")
    db_data = calculate_incremental_volumes(raw_results)
    print(f"✓ Processed {len(db_data)} unique serials\n")

    compare_data(excel_data, db_data)


if __name__ == "__main__":
    main()
