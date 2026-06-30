"""Cross-check Kasulu Machines and LMVs.xlsx against dashboard + Wialon APIs."""

import json
import re
import urllib.request
from pathlib import Path

EXCEL_JSON = Path(__file__).resolve().parent / "kasulu-fleet-register.json"
DASHBOARD_URL = (
    "http://localhost:3000/api/dashboard"
    "?from=2026-06-22T00:00:00.000Z&to=2026-06-29T23:59:59.999Z"
)
WIALON_URL = (
    "http://localhost:3000/api/telematics/unit-locations"
    "?from=2026-06-22T00:00:00.000Z&to=2026-06-29T23:59:59.999Z"
)


def norm(s: str) -> str:
    s = s.upper().strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("MUFINDI - ", "MUFINDI: ").replace("MUFINDI-", "MUFINDI: ")
    s = re.sub(r"MUFINDI:\s*", "MUFINDI: ", s)
    s = s.replace("FTT O8", "FTT 08")
    return s


def fetch(url: str) -> dict | list:
    with urllib.request.urlopen(url, timeout=180) as response:
        return json.loads(response.read())


def main() -> None:
    excel = json.loads(EXCEL_JSON.read_text(encoding="utf-8"))["byName"]
    excel_norm = {norm(k): (k, v) for k, v in excel.items()}

    dash = fetch(DASHBOARD_URL)
    sheet_units = dash["fleet"]["units"]
    sheet_names = [u["name"] for u in sheet_units]
    sheet_norm = {norm(n): n for n in sheet_names}
    cat_by_name = {u["name"]: u.get("category", "") for u in sheet_units}

    wialon = fetch(WIALON_URL)
    wialon_names = [u["reg"] for u in wialon]
    wialon_norm = {norm(n): n for n in wialon_names}

    machine_count = sum(1 for v in excel.values() if v == "Machine")
    lmv_count = len(excel) - machine_count

    print("=== COUNTS ===")
    print(f"Excel register: {len(excel)} (Machine={machine_count}, Truck/LMV={lmv_count})")
    print(f"Google Sheet (dashboard): {len(sheet_names)}")
    print(f"Wialon live: {len(wialon_names)}")

    excel_keys = set(excel_norm)
    sheet_keys = set(sheet_norm)
    wialon_keys = set(wialon_norm)

    print(f"In all three (normalized): {len(excel_keys & sheet_keys & wialon_keys)}")

    only_excel = sorted(excel_keys - sheet_keys)
    only_sheet = sorted(sheet_keys - excel_keys)
    only_wialon = sorted(wialon_keys - excel_keys)

    print(f"\nIn Excel but NOT in Sheet ({len(only_excel)}):")
    for key in only_excel:
        print(f"  {excel_norm[key][0]} -> {excel_norm[key][1]}")

    print(f"\nIn Sheet but NOT in Excel ({len(only_sheet)}):")
    for key in only_sheet:
        print(f"  {sheet_norm[key]}")

    print(f"\nIn Wialon but NOT in Excel ({len(only_wialon)}):")
    for key in only_wialon:
        print(f"  {wialon_norm[key]}")

    empty_cat = [n for n in sheet_names if cat_by_name.get(n) in ("—", None, "")]
    print(f"\n=== CATEGORY ON SHEET ===")
    print(f"Empty category on sheet: {len(empty_cat)} / {len(sheet_names)}")

    mapped = machine = lmv = 0
    unmatched: list[str] = []
    for name in sheet_names:
        key = norm(name)
        if key in excel_norm:
            mapped += 1
            if excel_norm[key][1] == "Machine":
                machine += 1
            else:
                lmv += 1
        else:
            unmatched.append(name)

    print(f"\nSheet names matchable to Excel: {mapped}/{len(sheet_names)}")
    print(f"  Machine: {machine}")
    print(f"  Truck/LMV: {lmv}")
    print(f"  Unmatched: {len(unmatched)}")
    for name in unmatched:
        print(f"    {name}")

    print("\n=== NAMING VARIANTS (normalized match, different spelling) ===")
    variants = 0
    for key in sorted(excel_keys & sheet_keys):
        excel_name = excel_norm[key][0]
        sheet_name = sheet_norm[key]
        if excel_name != sheet_name:
            variants += 1
            print(f"  Excel: {excel_name}")
            print(f"  Sheet: {sheet_name}")
    print(f"Total naming variants: {variants}")

    # Prefix patterns in Wialon
    print("\n=== WIALON NAMING PATTERNS ===")
    patterns: dict[str, int] = {}
    for name in wialon_names:
        if "OPTIM" in name.upper():
            patterns["OPTIM subgroup"] = patterns.get("OPTIM subgroup", 0) + 1
        elif "MUFINDI:" in name:
            patterns["MUFINDI: (colon)"] = patterns.get("MUFINDI: (colon)", 0) + 1
        elif "MUFINDI -" in name:
            patterns["MUFINDI - (dash)"] = patterns.get("MUFINDI - (dash)", 0) + 1
        else:
            patterns["other"] = patterns.get("other", 0) + 1
    for label, count in sorted(patterns.items(), key=lambda x: -x[1]):
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()
