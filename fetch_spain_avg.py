#!/usr/bin/env python3
"""
Download Balance de Criminalidad Q4 2025 from Ministerio del Interior
and extract Spain-wide crime rates for comparison with Catalonia ABP data.

Output: data/spain_averages.json
Run:    arch -arm64 python3 fetch_spain_avg.py

Note: the MdI website is behind Cloudflare.
If download fails, save the PDF manually to data/Balance_Q4_2025.pdf and re-run.
PDF URL: https://www.interior.gob.es/opencms/export/sites/default/.galleries/
         galeria-de-prensa/documentos-y-multimedia/balances-e-informes/2025/
         Balance-de-Criminalidad_Cuarto_Trimestre_2025.pdf
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import pdfplumber

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

PDF_URL = (
    "https://www.interior.gob.es/opencms/export/sites/default/.galleries/"
    "galeria-de-prensa/documentos-y-multimedia/balances-e-informes/2025/"
    "Balance-de-Criminalidad_Cuarto_Trimestre_2025.pdf"
)
PDF_PATH = DATA_DIR / "Balance_Q4_2025.pdf"
OUTPUT_PATH = DATA_DIR / "spain_averages.json"

SPAIN_POP_2025 = 48_600_000

# ---------------------------------------------------------------------------
# Summary table row numbers → our crime keys.
# Source: NACIONAL table, "enero a diciembre" columns (page 4 in PDF, index 3).
#
# Row  | Label in PDF                                          | Key
# 1    | Homicidios dolosos y asesinatos consumados            | homicide (sum with 2)
# 2    | Homicidios dolosos y asesinatos en grado tentativa    | homicide (sum with 1)
# 3    | Delitos graves y menos graves de lesiones             | lesions
# 5    | Delitos contra la libertad sexual                     | sexual
# 6    | Robos con violencia e intimidación                    | robbery_violence
# 7    | Robos con fuerza en domicilios, establecimientos...   | burglary
# 8    | Hurtos                                                | theft
# 9    | Sustracciones de vehículos                           | car_theft
# 10   | Tráfico de drogas                                    | drugs
#
# Not in summary table (null in Spain averages):
#   car_breakin  — not a separate category in MdI national summary
#   vandalism    — not in MdI national summary
#   home_intrusion, disorder — no MdI equivalent per plan
# ---------------------------------------------------------------------------

SUMMARY_ROW_MAP: dict[int, str] = {
    1: "homicide",
    2: "homicide",   # accumulated with row 1
    3: "lesions",
    5: "sexual",
    6: "robbery_violence",
    7: "burglary",
    8: "theft",
    9: "car_theft",
    10: "drugs",
}

# Keys always null (no MdI equivalent or not in summary table)
ALWAYS_NULL = {"home_intrusion", "disorder", "car_breakin", "vandalism"}


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def download_pdf() -> None:
    if PDF_PATH.exists() and PDF_PATH.stat().st_size > 100_000:
        print(f"  PDF already at {PDF_PATH.name} ({PDF_PATH.stat().st_size // 1024} KB)")
        return
    print(f"  Trying download via curl …")
    try:
        subprocess.run(
            ["curl", "-sL", "--max-time", "60",
             "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
             "-o", str(PDF_PATH), PDF_URL],
            check=False, capture_output=True,
        )
        if PDF_PATH.exists() and PDF_PATH.stat().st_size > 100_000:
            print(f"  Saved {PDF_PATH.stat().st_size // 1024} KB")
            return
        if PDF_PATH.exists():
            PDF_PATH.unlink()
    except Exception:
        pass

    print(
        "\n  The MdI website is behind Cloudflare — automated download blocked.\n"
        "\n  Manual steps:\n"
        "  1. Open this URL in your browser and save the PDF:\n"
        f"     {PDF_URL}\n"
        "  2. Move to: data/Balance_Q4_2025.pdf\n"
        "  3. Re-run this script."
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _parse_spanish_int(s: str) -> int:
    """Convert Spanish number string to int: '1.346' → 1346, '104.628' → 104628."""
    return int(s.replace(".", ""))


def _parse_summary_line(line: str) -> tuple[int, int] | None:
    """
    Parse a summary-table line of the form:
      'N. Category text  2024_count  2025_count  variation%'
    where N is an integer, counts use period as thousands separator,
    and variation uses comma as decimal.

    Returns (row_number, count_2025) or None.
    Sub-rows like '7.1.-...' are skipped.
    """
    # Must start with integer row number followed by dot/space
    m = re.match(r"^(\d+)\.\s", line)
    if not m:
        return None
    row_num = int(m.group(1))

    tokens = line.split()
    if len(tokens) < 4:
        return None

    # The variation is the last token and contains a comma (Spanish decimal)
    if "," not in tokens[-1]:
        return None

    # Counts are the two tokens before variation
    try:
        count_2024 = _parse_spanish_int(tokens[-3])
        count_2025 = _parse_spanish_int(tokens[-2])
    except (ValueError, IndexError):
        return None

    # Sanity: counts should be positive integers
    if count_2025 <= 0 or count_2024 <= 0:
        return None

    return row_num, count_2025


def _find_summary_page() -> int | None:
    """Find page index containing the NACIONAL summary table (page 4 = index 3)."""
    with pdfplumber.open(PDF_PATH) as pdf:
        for i, page in enumerate(pdf.pages[:20]):
            text = page.extract_text() or ""
            if ("Homicidios dolosos" in text and "Hurtos" in text and "NACIONAL" in text):
                return i
    return None


def parse_pdf() -> dict[str, float | None]:
    print("  Locating summary table …")
    page_idx = _find_summary_page()
    if page_idx is None:
        print("  ERROR: could not find NACIONAL summary table in first 20 pages.")
        return {}

    print(f"  Found on page {page_idx + 1}")

    with pdfplumber.open(PDF_PATH) as pdf:
        text = pdf.pages[page_idx].extract_text() or ""

    counts: dict[str, int] = {}

    for line in text.splitlines():
        line = line.strip()
        result = _parse_summary_line(line)
        if result is None:
            continue
        row_num, count_2025 = result
        key = SUMMARY_ROW_MAP.get(row_num)
        if key is None:
            continue
        # homicide accumulates rows 1 + 2
        counts[key] = counts.get(key, 0) + count_2025
        print(f"    row {row_num:2d} [{key:18s}] count={count_2025:,}")

    return counts


def counts_to_rates(counts: dict[str, int]) -> dict[str, float | None]:
    all_keys = list(SUMMARY_ROW_MAP.values()) + list(ALWAYS_NULL)
    seen = set()
    unique_keys = [k for k in all_keys if not (k in seen or seen.add(k))]
    rates = {}
    for key in unique_keys:
        if key in ALWAYS_NULL or key not in counts:
            rates[key] = None
        else:
            rates[key] = round(counts[key] / SPAIN_POP_2025 * 1000, 6)
    return rates


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=== fetch_spain_avg.py ===")
    download_pdf()

    print("  Parsing PDF …")
    counts = parse_pdf()

    if not counts:
        print("  WARNING: no data extracted. Check the PDF structure.")

    rates = counts_to_rates(counts)

    print(f"\n  Results:")
    for key, val in rates.items():
        if val is not None:
            # Show count and rate
            cnt = counts.get(key, 0)
            print(f"    {key:20s} {cnt:>10,} crimes → {val:.6f} /1k")
        else:
            print(f"    {key:20s} null")

    found = sum(1 for v in rates.values() if v is not None)
    if found < 5:
        print(f"\n  WARNING: only {found} keys extracted. PDF may have changed layout.")

    output = {
        "year": 2025,
        "population": SPAIN_POP_2025,
        "source": "Balance de Criminalidad Q4 2025, Ministerio del Interior",
        "note": (
            "home_intrusion excluded (no MdI equivalent). "
            "car_breakin/vandalism/disorder not in MdI national summary table."
        ),
        "rates": rates,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\n  Saved → {OUTPUT_PATH.name}")


if __name__ == "__main__":
    main()
