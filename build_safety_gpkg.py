#!/usr/bin/env python3
"""
Build safety_catalunya.gpkg (3 layers) and web export files.

Inputs:
  data/abp_polygons_clean.geojson   — 59 ABP polygons with abp_c, abp_d, abp_pob, abp_csv
  data/Fets_combined_2019_2026.csv  — raw Mossos crime data, all years
  data/spain_averages.json          — Spain rates from fetch_spain_avg.py

Outputs:
  data/safety_catalunya.gpkg        — 3-layer GeoPackage for QGIS
  web/public/data/abp.geojson       — simplified polygons for MapLibre
  web/public/data/stats.json        — per-ABP per-year stats for popups

Run: arch -arm64 python3 build_safety_gpkg.py
"""

import json
import subprocess
import warnings
from pathlib import Path

import geopandas as gpd
import pandas as pd

warnings.filterwarnings("ignore")

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
WEB_DATA_DIR = SCRIPT_DIR / "web" / "public" / "data"
WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Crime key → Mossos 'Tipus de fet' mapping  (verified against actual CSV)
# ---------------------------------------------------------------------------

CRIME_KEYS: dict[str, list[str]] = {
    "homicide": [
        "Homicidi Consumat",
        "Homicidi Temptativa",
        "Assassinat Consumat",
        "Assassinat Temptativa",
    ],
    "lesions": ["Lesions"],
    "sexual": ["Agressions sexuals i Abusos sexuals"],
    "robbery_violence": ["Robatori amb violència i/o intimidació"],
    "burglary": ["Robatori amb força"],
    "home_intrusion": ["Entrada a vivenda aliena"],
    "theft": ["Furt"],
    "car_breakin": ["Robatori amb força interior vehicle"],
    "car_theft": ["Robatori i furt d'us de vehicle"],
    "vandalism": ["Danys"],
    "drugs": ["Contra la salut pública"],
    "disorder": ["Desordres públics"],
}

# Reverse lookup: Tipus de fet → crime key
_TIPUS_TO_KEY: dict[str, str] = {
    t: key for key, types in CRIME_KEYS.items() for t in types
}

WEIGHTS: dict[str, float] = {
    "homicide": 5.0,
    "sexual": 4.0,
    "robbery_violence": 3.0,
    "lesions": 3.0,
    "burglary": 2.0,
    "home_intrusion": 2.0,
    "car_theft": 1.5,
    "drugs": 1.5,
    "car_breakin": 1.0,
    "theft": 1.0,
    "vandalism": 1.0,
    "disorder": 1.0,
}

# Keys excluded from safety_index_spain (no MdI equivalent)
SPAIN_EXCLUDED = {"home_intrusion", "disorder", "drugs"}


# ---------------------------------------------------------------------------
# Step 1: diagnostics — print unmapped Tipus de fet values
# ---------------------------------------------------------------------------

def run_diagnostics(df: pd.DataFrame) -> None:
    all_tipus = set(df["Tipus de fet"].dropna().unique())
    mapped = set(_TIPUS_TO_KEY.keys())
    unmapped = sorted(all_tipus - mapped)
    mapped_found = sorted(all_tipus & mapped)

    print("\n=== Diagnostic: Tipus de fet mapping ===")
    print(f"  Total unique Tipus de fet in CSV: {len(all_tipus)}")
    print(f"  Mapped to a crime key:            {len(mapped_found)}")
    print(f"  Unmapped (excluded from index):   {len(unmapped)}")
    print("\n  Mapped values:")
    for t in mapped_found:
        print(f"    [{_TIPUS_TO_KEY[t]:20s}] {t}")
    print("\n  Unmapped values (top 20):")
    for t in unmapped[:20]:
        print(f"    {t}")
    if len(unmapped) > 20:
        print(f"    ... and {len(unmapped) - 20} more")


# ---------------------------------------------------------------------------
# Step 2: load and prepare crime data
# ---------------------------------------------------------------------------

def load_crime_data() -> pd.DataFrame:
    """Load combined CSV → long-format with crime_key column."""
    path = DATA_DIR / "Fets_combined_2019_2026.csv"
    df = pd.read_csv(path, encoding="utf-8")
    df["Coneguts"] = pd.to_numeric(df["Coneguts"], errors="coerce").fillna(0).astype(int)
    df["crime_key"] = df["Tipus de fet"].map(_TIPUS_TO_KEY)
    return df


# ---------------------------------------------------------------------------
# Step 3: load ABP polygons
# ---------------------------------------------------------------------------

_ICGC_GEOJSON_URL = (
    "https://raw.githubusercontent.com/OpenICGC/mapa-delinquencial"
    "/master/data/Arees_Basiques_Policia.geojson"
)

# Official ICGC name → our abp_d (only entries that differ after normalization)
_ICGC_NAME_OVERRIDES: dict[str, str] = {
    "ABP Segrià - Garrigues - Pla d'Urgell": "ABP Segrià",
}


def _norm_abp_name(s: str) -> str:
    return s.strip().lower().replace("abp ", "").replace("  ", " ")


def load_polygons() -> gpd.GeoDataFrame:
    # Download official ICGC geometry if not cached
    icgc_path = DATA_DIR / "Arees_Basiques_Policia.geojson"
    if not icgc_path.exists():
        print("  Downloading official ABP geometry from OpenICGC...")
        subprocess.run(["curl", "-L", "-o", str(icgc_path), _ICGC_GEOJSON_URL], check=True)
        print(f"  Saved → {icgc_path.name}")

    geom_gdf = gpd.read_file(icgc_path)[["abp", "geometry"]].copy()
    geom_gdf["_join"] = geom_gdf["abp"].apply(
        lambda n: _norm_abp_name(_ICGC_NAME_OVERRIDES.get(n, n))
    )

    # Attributes (abp_c, abp_d, abp_pob, abp_csv) from vector-tile-derived file
    attr_gdf = gpd.read_file(DATA_DIR / "abp_polygons_clean.geojson")
    attr_gdf = attr_gdf[attr_gdf["abp_c"].notna() & (attr_gdf["abp_pob"] > 0)].copy()
    attr_gdf["_join"] = attr_gdf["abp_d"].apply(_norm_abp_name)

    # Replace tile geometry with official ICGC geometry (join by normalized name)
    merged = attr_gdf.drop(columns="geometry").merge(
        geom_gdf[["_join", "geometry"]], on="_join", how="left"
    ).drop(columns="_join")
    gdf = gpd.GeoDataFrame(merged, geometry="geometry", crs="EPSG:4326")

    # Fall back to tile geometry for zones missing from official file (e.g. newer ABPs)
    missing = gdf.geometry.isna() | gdf.geometry.is_empty
    if missing.any():
        tile_geom = gpd.read_file(DATA_DIR / "abp_polygons_clean.geojson").set_index("abp_c")["geometry"]
        for idx in gdf[missing].index:
            fallback = tile_geom.get(gdf.at[idx, "abp_c"])
            if fallback is not None:
                gdf.at[idx, "geometry"] = fallback
        print(f"  Tile geometry fallback for: {list(gdf.loc[missing, 'abp_d'])}")

    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    return gdf


# ---------------------------------------------------------------------------
# Step 4: aggregate crime counts per (abp_csv, year, crime_key)
# ---------------------------------------------------------------------------

def aggregate_crimes(df: pd.DataFrame) -> pd.DataFrame:
    """Returns DataFrame with columns: abp_csv, year, crime_key, count."""
    mapped = df[df["crime_key"].notna()].copy()
    agg = (
        mapped
        .groupby(["Àrea Bàsica Policial (ABP)", "Any", "crime_key"], as_index=False)["Coneguts"]
        .sum()
        .rename(columns={"Àrea Bàsica Policial (ABP)": "abp_csv", "Any": "year", "Coneguts": "count"})
    )
    return agg


# ---------------------------------------------------------------------------
# Step 5: compute rates and catalonia averages
# ---------------------------------------------------------------------------

def compute_rates(
    agg: pd.DataFrame,
    gdf: gpd.GeoDataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Returns:
      stats_df  — (abp_c, year, crime_key, count, rate)
      cat_avg   — (year, crime_key, cat_avg_rate)
    """
    # Join abp_c and abp_pob via abp_csv
    pop_map = gdf.set_index("abp_csv")[["abp_c", "abp_pob"]].to_dict("index")

    rows = []
    for _, row in agg.iterrows():
        info = pop_map.get(row["abp_csv"])
        if not info or info["abp_pob"] <= 0:
            continue
        rate = row["count"] / info["abp_pob"] * 1000
        rows.append({
            "abp_c": info["abp_c"],
            "year": row["year"],
            "crime_key": row["crime_key"],
            "count": int(row["count"]),
            "rate": round(rate, 6),
        })

    stats_df = pd.DataFrame(rows)

    # Catalonia averages: sum(counts) / sum(pops) per (year, crime_key)
    pops = gdf.set_index("abp_c")["abp_pob"].to_dict()
    cat_rows = []
    for (year, key), grp in stats_df.groupby(["year", "crime_key"]):
        total_count = grp["count"].sum()
        total_pop = sum(pops.get(c, 0) for c in grp["abp_c"])
        if total_pop > 0:
            cat_rows.append({
                "year": year,
                "crime_key": key,
                "cat_avg": round(total_count / total_pop * 1000, 6),
            })

    cat_avg = pd.DataFrame(cat_rows)
    return stats_df, cat_avg


# ---------------------------------------------------------------------------
# Step 6: safety indices
# ---------------------------------------------------------------------------

def compute_safety_index_cat(
    stats_df: pd.DataFrame,
    cat_avg: pd.DataFrame,
    year: int,
    abp_c: str,
) -> float | None:
    """Weighted mean of (abp_rate / cat_avg) for all 12 keys in a given year."""
    cat = cat_avg[cat_avg["year"] == year].set_index("crime_key")["cat_avg"]
    abp = stats_df[(stats_df["abp_c"] == abp_c) & (stats_df["year"] == year)].set_index("crime_key")["rate"]

    weighted_sum = 0.0
    weight_sum = 0.0
    for key, w in WEIGHTS.items():
        avg = cat.get(key)
        rate = abp.get(key)
        if avg and avg > 0 and rate is not None:
            weighted_sum += w * (rate / avg)
            weight_sum += w

    if weight_sum == 0:
        return None
    return round(weighted_sum / weight_sum, 4)


def compute_safety_index_spain(
    stats_df: pd.DataFrame,
    spain_rates: dict[str, float | None],
    abp_c: str,
) -> float | None:
    """Weighted mean of (abp_rate_2025 / spain_rate) for keys with Spain data."""
    abp = stats_df[(stats_df["abp_c"] == abp_c) & (stats_df["year"] == 2025)].set_index("crime_key")["rate"]

    weighted_sum = 0.0
    weight_sum = 0.0
    for key, w in WEIGHTS.items():
        if key in SPAIN_EXCLUDED:
            continue
        spain_rate = spain_rates.get(key)
        abp_rate = abp.get(key)
        if spain_rate and spain_rate > 0 and abp_rate is not None:
            weighted_sum += w * (abp_rate / spain_rate)
            weight_sum += w

    if weight_sum == 0:
        return None
    return round(weighted_sum / weight_sum, 4)


# ---------------------------------------------------------------------------
# Step 7: build GeoPackage layers
# ---------------------------------------------------------------------------

def build_gpkg(
    gdf: gpd.GeoDataFrame,
    stats_df: pd.DataFrame,
    cat_avg: pd.DataFrame,
    spain_rates: dict[str, float | None],
) -> None:
    gpkg_path = DATA_DIR / "safety_catalunya.gpkg"
    years = sorted(stats_df["year"].unique())
    abp_codes = gdf["abp_c"].dropna().tolist()

    # --- Layer 1: abp_polygons (2025 indices for default QGIS view) ---
    poly_rows = []
    for _, feat in gdf.iterrows():
        abp_c = feat["abp_c"]
        idx_cat = compute_safety_index_cat(stats_df, cat_avg, 2025, abp_c)
        idx_spain = compute_safety_index_spain(stats_df, spain_rates, abp_c)
        poly_rows.append({
            "abp_c": abp_c,
            "abp_d": feat.get("abp_d", ""),
            "abp_pob": int(feat.get("abp_pob", 0)),
            "safety_index_cat": idx_cat,
            "safety_index_spain": idx_spain,
            "geometry": feat.geometry,
        })

    poly_df = gpd.GeoDataFrame(poly_rows, crs="EPSG:4326")

    # Ranks (1 = safest)
    poly_df["safety_rank_cat"] = (
        poly_df["safety_index_cat"].rank(method="min", na_option="bottom").astype("Int64")
    )
    poly_df["safety_rank_spain"] = (
        poly_df["safety_index_spain"].rank(method="min", na_option="bottom").astype("Int64")
    )

    poly_df.to_file(gpkg_path, layer="abp_polygons", driver="GPKG")
    print(f"  Layer 'abp_polygons': {len(poly_df)} rows")

    # --- Layer 2: crime_stats (no geometry) ---
    null_geom = gpd.GeoSeries([None] * len(stats_df), crs="EPSG:4326")
    stats_gdf = gpd.GeoDataFrame(stats_df, geometry=null_geom, crs="EPSG:4326")
    stats_gdf.to_file(gpkg_path, layer="crime_stats", driver="GPKG")
    print(f"  Layer 'crime_stats': {len(stats_df)} rows")

    # --- Layer 3: reference_rates ---
    ref_rows = []
    for _, row in cat_avg.iterrows():
        ref_rows.append({
            "crime_key": row["crime_key"],
            "year": int(row["year"]),
            "scope": "catalonia",
            "rate": row["cat_avg"],
        })
    for key, rate in spain_rates.items():
        if rate is not None:
            ref_rows.append({
                "crime_key": key,
                "year": 2025,
                "scope": "spain",
                "rate": rate,
            })

    ref_df = pd.DataFrame(ref_rows)
    null_geom_ref = gpd.GeoSeries([None] * len(ref_df), crs="EPSG:4326")
    ref_gdf = gpd.GeoDataFrame(ref_df, geometry=null_geom_ref, crs="EPSG:4326")
    ref_gdf.to_file(gpkg_path, layer="reference_rates", driver="GPKG")
    print(f"  Layer 'reference_rates': {len(ref_df)} rows")
    print(f"  Saved → {gpkg_path.name}")


# ---------------------------------------------------------------------------
# Step 8: build web export files
# ---------------------------------------------------------------------------

def build_web_exports(
    gdf: gpd.GeoDataFrame,
    stats_df: pd.DataFrame,
    cat_avg: pd.DataFrame,
    spain_rates: dict[str, float | None],
) -> None:
    years = sorted(int(y) for y in stats_df["year"].unique())
    all_keys = list(CRIME_KEYS.keys())

    # cat_avg lookup: (year, crime_key) → rate
    cat_lookup: dict[tuple[int, str], float] = {
        (int(r["year"]), r["crime_key"]): r["cat_avg"]
        for _, r in cat_avg.iterrows()
    }

    # stats lookup: (abp_c, year, crime_key) → (count, rate)
    stats_lookup: dict[tuple[str, int, str], tuple[int, float]] = {
        (r["abp_c"], int(r["year"]), r["crime_key"]): (r["count"], r["rate"])
        for _, r in stats_df.iterrows()
    }

    # --- abp.geojson (topologically simplified polygons via mapshaper) ---
    # Build a minimal GeoDataFrame with only the properties needed for the web export
    web_gdf = gdf[["abp_c", "abp_d", "abp_pob", "geometry"]].copy()
    web_gdf["abp_pob"] = web_gdf["abp_pob"].astype(int)
    web_gdf = web_gdf[web_gdf.geometry.notna() & ~web_gdf.geometry.is_empty]

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".geojson", delete=False) as tmp:
        tmp_in = tmp.name
    tmp_out = tmp_in.replace(".geojson", "_simplified.geojson")

    web_gdf.to_file(tmp_in, driver="GeoJSON")
    # mapshaper topology-preserving simplification (no gaps at shared boundaries)
    subprocess.run(
        ["npx", "--yes", "mapshaper", tmp_in, "-simplify", "5%",
         "-o", f"format=geojson", tmp_out],
        check=True, capture_output=True,
    )
    abp_path = WEB_DATA_DIR / "abp.geojson"
    Path(tmp_out).rename(abp_path)
    Path(tmp_in).unlink(missing_ok=True)

    size_kb = abp_path.stat().st_size // 1024
    print(f"  Saved → web/public/data/abp.geojson ({len(web_gdf)} features, {size_kb} KB)")

    # --- stats.json ---
    stats_out: dict = {}

    for _, feat in gdf.iterrows():
        abp_c = feat["abp_c"]
        if not abp_c:
            continue

        abp_years: dict[str, dict] = {}
        for year in years:
            year_data: dict[str, dict] = {}
            for key in all_keys:
                cr = stats_lookup.get((abp_c, year, key))
                count = cr[0] if cr else 0
                rate = round(cr[1], 4) if cr else 0.0
                c_avg = cat_lookup.get((year, key))
                s_avg = spain_rates.get(key)

                ratio_cat = round(rate / c_avg, 4) if c_avg and c_avg > 0 and rate > 0 else None
                ratio_spain = (
                    round(rate / s_avg, 4)
                    if s_avg and s_avg > 0 and rate > 0 and key not in SPAIN_EXCLUDED
                    else None
                )

                year_data[key] = {
                    "count": count,
                    "rate": rate,
                    "cat_avg": round(c_avg, 4) if c_avg else None,
                    "spain_avg": round(s_avg, 5) if s_avg else None,
                    "ratio_cat": ratio_cat,
                    "ratio_spain": ratio_spain,
                }

            # Per-year safety index
            idx_cat = compute_safety_index_cat(stats_df, cat_avg, year, abp_c)
            year_obj = {
                "safety_index_cat": idx_cat,
                **year_data,
            }
            abp_years[str(year)] = year_obj

        # 2025 rank among all ABP
        idx_spain = compute_safety_index_spain(stats_df, spain_rates, abp_c)

        stats_out[abp_c] = {
            "abp_d": feat.get("abp_d", ""),
            "abp_pob": int(feat.get("abp_pob", 0)),
            "safety_index_spain": idx_spain,
            "years": abp_years,
        }

    # Add per-year safety ranks across all ABPs
    for year in years:
        year_str = str(year)
        indices = [
            (abp_c, data["years"][year_str]["safety_index_cat"])
            for abp_c, data in stats_out.items()
            if year_str in data["years"] and data["years"][year_str]["safety_index_cat"] is not None
        ]
        indices.sort(key=lambda x: x[1])
        for rank, (abp_c, _) in enumerate(indices, 1):
            stats_out[abp_c]["years"][year_str]["safety_rank_cat"] = rank

    stats_path = WEB_DATA_DIR / "stats.json"
    stats_path.write_text(json.dumps(stats_out, ensure_ascii=False, separators=(",", ":")))
    size_kb = stats_path.stat().st_size // 1024
    print(f"  Saved → web/public/data/stats.json ({size_kb} KB, {len(stats_out)} ABPs)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=== build_safety_gpkg.py ===")

    print("\n[1/5] Loading data...")
    gdf = load_polygons()
    df = load_crime_data()
    print(f"  Polygons: {len(gdf)} ABP zones")
    print(f"  Crime rows: {len(df):,}")

    run_diagnostics(df)

    spain_path = DATA_DIR / "spain_averages.json"
    if spain_path.exists():
        spain_data = json.loads(spain_path.read_text())
        spain_rates: dict[str, float | None] = spain_data.get("rates", {})
        print(f"\n  Spain rates loaded ({sum(1 for v in spain_rates.values() if v)} non-null)")
    else:
        print("\n  WARNING: spain_averages.json not found — run fetch_spain_avg.py first")
        print("  Continuing without Spain comparison data.")
        spain_rates = {k: None for k in CRIME_KEYS}

    print("\n[2/5] Aggregating crime counts...")
    agg = aggregate_crimes(df)
    print(f"  Aggregated rows: {len(agg):,}")

    print("\n[3/5] Computing rates and Catalonia averages...")
    stats_df, cat_avg = compute_rates(agg, gdf)
    print(f"  Stats rows: {len(stats_df):,}")
    print(f"  Cat avg rows: {len(cat_avg):,}")

    print("\n[4/5] Writing GeoPackage...")
    build_gpkg(gdf, stats_df, cat_avg, spain_rates)

    print("\n[5/5] Writing web export files...")
    build_web_exports(gdf, stats_df, cat_avg, spain_rates)

    print("\nDone.")


if __name__ == "__main__":
    main()
