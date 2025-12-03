#!/usr/bin/env python3
"""
Export comparison results to Excel with multiple sheets
"""

import mysql.connector
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict
import os
from dotenv import load_dotenv

load_dotenv()

# Database credentials
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not DB_USER or not DB_PASSWORD:
    raise ValueError("DB_USER and DB_PASSWORD must be set in .env file")

# Companies list (excluding braamfonteinbms2)
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
    ma.machinestatus,
    mrd.reading_date,
    crme.createdtime as reading_date_time,
    mrd.total as totalamt,
    mrd.a3,
    mrd.black,
    mrd.large,
    mrd.colour,
    mrd.extralarge
FROM bms_machines ma
LEFT JOIN vtiger_crmentity crm on crm.crmid = ma.machinesid
LEFT JOIN bms_meterreading mrd on mrd.asset = ma.machinesid
LEFT JOIN vtiger_crmentity crme on crme.crmid = mrd.meterreadingid
WHERE crm.deleted <> 1
    AND ma.serialnumber IS NOT NULL
    AND mrd.total IS NOT NULL
    AND mrd.reading_date IS NOT NULL
    AND ma.machinestatus = 1
ORDER BY ma.serialnumber, mrd.reading_date, crme.createdtime;
"""


def load_excel_data(filepath: str) -> Dict:
    """Load Excel data with sub-meters - filter to specific months only"""
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    data = defaultdict(lambda: defaultdict(dict))

    # Only these months from 2025
    allowed_months = {'Mar-2025', 'Apr-2025', 'May-2025', 'Jun-2025',
                     'Jul-2025', 'Aug-2025', 'Sep-2025', 'Nov-2025'}

    for row in ws.iter_rows(min_row=2, values_only=True):
        customer, model, serial, month_year, a3_mono, a4_mono, a3_color, a4_color, total = row
        if serial and month_year in allowed_months:
            data[str(serial)][month_year] = {
                'customer': customer,
                'a3_mono': a3_mono or 0,
                'a4_mono': a4_mono or 0,
                'a3_color': a3_color or 0,
                'a4_color': a4_color or 0,
                'total': total or 0
            }

    return data


def calculate_incremental_volumes(raw_data: List[Tuple]) -> Dict:
    """
    Convert cumulative to incremental with sub-meters - matches Qlik logic
    Takes last reading per date (FirstSortedValue), then calculates monthly movement
    Process ALL historical data but only return 2025 months for reporting
    """
    from collections import OrderedDict

    # Only report these months (but calculate from beginning of time)
    report_months = {'Mar-2025', 'Apr-2025', 'May-2025', 'Jun-2025',
                     'Jul-2025', 'Aug-2025', 'Sep-2025', 'Nov-2025'}

    # Step 1: Group by serial+date, take LAST reading per date (by createdtime)
    by_serial_date = defaultdict(lambda: defaultdict(list))

    for serial, model, status, date, date_time, total, a3, black, large, colour, extralarge, company in raw_data:
        if serial and date and total is not None:
            date_key = date.strftime("%Y-%m-%d")
            by_serial_date[str(serial)][date_key].append((
                date_time, total, a3 or 0, black or 0, large or 0, colour or 0, extralarge or 0, model, company
            ))

    # Step 2: Get latest reading per date
    daily_readings = defaultdict(dict)
    for serial, dates in by_serial_date.items():
        for date_key, readings in dates.items():
            # Sort by datetime desc, take first (latest)
            readings.sort(key=lambda x: x[0] if x[0] else datetime.min, reverse=True)
            latest = readings[0]
            daily_readings[serial][date_key] = {
                'total': latest[1],
                'a3': latest[2],
                'black': latest[3],
                'large': latest[4],
                'colour': latest[5],
                'extralarge': latest[6],
                'model': latest[7],
                'company': latest[8]
            }

    # Step 3: Group by month, take last day's reading of month
    result = defaultdict(lambda: defaultdict(dict))

    for serial, dates in daily_readings.items():
        sorted_dates = sorted(dates.items(), key=lambda x: x[0])
        monthly_readings = OrderedDict()

        for date_str, reading in sorted_dates:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            month_year = date_obj.strftime("%b-%Y")
            # Take latest day in month
            monthly_readings[month_year] = reading

        # Step 4: Calculate incremental movement from ALL history, but only store 2025 months
        # Get list of months to iterate with next month lookup
        month_list = list(monthly_readings.keys())

        for i, month_year in enumerate(month_list):
            reading = monthly_readings[month_year]

            # Get previous month's reading for baseline
            if i > 0:
                prev_reading = monthly_readings[month_list[i-1]]
                prev_total = prev_reading['total']
                prev_a3 = prev_reading['a3']
                prev_black = prev_reading['black']
                prev_large = prev_reading['large']
                prev_colour = prev_reading['colour']
                prev_extralarge = prev_reading['extralarge']
            else:
                prev_total = 0
                prev_a3 = 0
                prev_black = 0
                prev_large = 0
                prev_colour = 0
                prev_extralarge = 0

            cumulative = reading['total']
            incremental = cumulative - prev_total

            incr_a3 = reading['a3'] - prev_a3
            incr_black = reading['black'] - prev_black
            incr_large = reading['large'] - prev_large
            incr_colour = reading['colour'] - prev_colour
            incr_extralarge = reading['extralarge'] - prev_extralarge

            # Calculate total from sum of sub-meters
            incr_total_from_subs = incr_a3 + incr_black + incr_large + incr_colour + incr_extralarge

            # Shift to next month to match Xerox reporting (they report on first day of next month)
            # Get next month for reporting
            if i + 1 < len(month_list):
                report_as_month = month_list[i + 1]
            else:
                report_as_month = None

            # Only store if the NEXT month is in our report range
            if incremental >= 0 and report_as_month and report_as_month in report_months:
                result[serial][report_as_month] = {
                    'volume': incr_total_from_subs,  # Use sum of sub-meters
                    'a3': incr_a3,
                    'black': incr_black,
                    'large': incr_large,
                    'colour': incr_colour,
                    'extralarge': incr_extralarge,
                    'model': reading['model'],
                    'company': reading['company'],
                    'cumulative': cumulative
                }

    return result


def query_all_databases() -> List[Tuple]:
    """Query all databases"""
    all_results = []
    print("Querying databases...")

    for i, company in enumerate(COMPANIES, 1):
        print(f"[{i}/{len(COMPANIES)}] {company['name']}...", end=" ")
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

            for row in results:
                all_results.append((*row, company['name']))
            print(f"✓ {len(results)} rows")
        except Exception as e:
            print(f"✗ {str(e)[:50]}")

    return all_results


def create_excel_report(excel_data: Dict, db_data: Dict, output_path: str):
    """Create Excel report - only serials in both systems"""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # Styles
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    red_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")

    # Only serials in both systems
    common_serials = set(excel_data.keys()) & set(db_data.keys())

    # Single sheet: Comparison
    ws = wb.create_sheet("Volume Comparison", 0)

    # Styles for total columns
    total_fill = PatternFill(start_color="FFD966", end_color="FFD966", fill_type="solid")
    total_header_fill = PatternFill(start_color="F4B084", end_color="F4B084", fill_type="solid")
    total_header_font = Font(bold=True, color="FFFFFF")

    headers = [
        "Serial", "Model", "BMS Company", "Xerox Customer", "Month",
        "", # Spacer
        "BMS A3", "BMS Black", "BMS Large", "BMS Colour", "BMS XL", "BMS Total",
        "", # Spacer
        "Xerox A3 Mono", "Xerox A4 Mono", "Xerox A3 Color", "Xerox A4 Color", "Xerox Total",
        "", # Spacer
        "Difference", "BMS Balance"
    ]
    ws.append(headers)

    for idx, cell in enumerate(ws[1], 1):
        if cell.value in ["BMS Total", "Xerox Total"]:
            cell.fill = total_header_fill
            cell.font = total_header_font
        elif cell.value:
            cell.fill = header_fill
            cell.font = header_font

    # Month order for sorting
    month_order = {'Mar-2025': 1, 'Apr-2025': 2, 'May-2025': 3, 'Jun-2025': 4,
                   'Jul-2025': 5, 'Aug-2025': 6, 'Sep-2025': 7, 'Nov-2025': 8}

    for serial in sorted(common_serials):
        excel_months = excel_data[serial]
        db_months = db_data[serial]
        all_months = sorted(set(excel_months.keys()) | set(db_months.keys()),
                           key=lambda x: month_order.get(x, 99))

        # Get model and company from any available month for this serial
        serial_model = 'N/A'
        serial_company = 'N/A'
        for month_data in db_months.values():
            if month_data.get('model'):
                serial_model = month_data['model']
            if month_data.get('company'):
                serial_company = month_data['company']
            if serial_model != 'N/A' and serial_company != 'N/A':
                break

        # Get Xerox customer name from any available month for this serial
        xerox_customer = 'N/A'
        for month_data in excel_months.values():
            if month_data.get('customer'):
                xerox_customer = month_data['customer']
                break

        for month in all_months:
            db_info = db_months.get(month, {})
            xerox_info = excel_months.get(month, {})

            model = serial_model
            company = serial_company
            customer = xerox_customer

            bms_a3 = db_info.get('a3', 0)
            bms_black = db_info.get('black', 0)
            bms_large = db_info.get('large', 0)
            bms_colour = db_info.get('colour', 0)
            bms_xl = db_info.get('extralarge', 0)
            bms_total = db_info.get('volume', 0)
            bms_balance = db_info.get('cumulative', 0)

            xerox_a3_mono = xerox_info.get('a3_mono', 0)
            xerox_a4_mono = xerox_info.get('a4_mono', 0)
            xerox_a3_color = xerox_info.get('a3_color', 0)
            xerox_a4_color = xerox_info.get('a4_color', 0)
            xerox_total = xerox_info.get('total', 0)

            difference = bms_total - xerox_total

            row = [
                serial, model, company, customer, month,
                "", # Spacer
                bms_a3, bms_black, bms_large, bms_colour, bms_xl, bms_total,
                "", # Spacer
                xerox_a3_mono, xerox_a4_mono, xerox_a3_color, xerox_a4_color, xerox_total,
                "", # Spacer
                difference, bms_balance
            ]
            ws.append(row)

            # Highlight total columns
            row_num = ws.max_row
            ws[f'L{row_num}'].fill = total_fill  # BMS Total (now column L)
            ws[f'R{row_num}'].fill = total_fill  # Xerox Total (now column R)

    # Auto-size columns
    for column in ws.columns:
        max_length = 0
        column_letter = get_column_letter(column[0].column)
        for cell in column:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        ws.column_dimensions[column_letter].width = min(max_length + 2, 50)

    wb.save(output_path)

    # Print summary
    print(f"\n✓ Excel report saved: {output_path}")
    print(f"  Serials compared: {len(common_serials)}")
    total_rows = ws.max_row - 1  # Exclude header
    print(f"  Total comparisons: {total_rows}")


def main():
    excel_path = "/Users/alwynkotze/Documents/JDW/jetline-machines-automation/Volumes from Xerox.xlsx"
    output_path = "/Users/alwynkotze/Documents/JDW/jetline-machines-automation/Volume_Comparison_Report.xlsx"

    print("Loading Excel data...")
    excel_data = load_excel_data(excel_path)
    print(f"✓ Loaded {len(excel_data)} serials from Excel\n")

    raw_results = query_all_databases()
    print(f"\n✓ Retrieved {len(raw_results)} total rows\n")

    print("Calculating incremental volumes...")
    db_data = calculate_incremental_volumes(raw_results)
    print(f"✓ Processed {len(db_data)} unique serials\n")

    print("Creating Excel report...")
    create_excel_report(excel_data, db_data, output_path)


if __name__ == "__main__":
    main()
