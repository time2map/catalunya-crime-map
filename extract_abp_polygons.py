#!/usr/bin/env python3
"""
Download Catalonia crime data from ICGC and build a GeoPackage for QGIS.

What it does:
  1. Downloads CSV crime stats (2019–current year) from visors.icgc.cat
  2. Downloads police station points (comissaries.geojson)
  3. Downloads ABP polygon boundaries from ICGC vector tile service (zoom 12)
     using GDAL for correct georeferencing, then dissolves by ABP code
  4. Joins crime stats to polygons and exports crimes_catalunya.gpkg

Output (all files go to data/):
  data/Fets_YYYY.csv              — crime stats per year
  data/Fets_combined_2019_YYYY.csv — all years merged
  data/comissaries.geojson        — police station points
  data/abp_polygons_clean.geojson — ABP zone polygons (GeoJSON)
  data/crimes_catalunya.gpkg      — GeoPackage with abp_polygons layer

Requirements:
  pip install geopandas shapely pandas
  gdal (ogr2ogr must be on PATH)
"""

import csv
import gzip
import json
import math
import os
import subprocess
import urllib.request
import warnings
from collections import defaultdict
from datetime import date
from pathlib import Path
from shapely.geometry import shape, MultiPolygon
from shapely.ops import unary_union
from shapely.validation import make_valid

warnings.filterwarnings('ignore')

import geopandas as gpd
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://visors.icgc.cat/mapa-delinquencial/assets/data"
TILE_URL = "https://tilemaps.icgc.cat/vt/tiles/limits_vigentv42/{z}/{x}/{y}.pbf"
TILE_ZOOM = 12
LAYER_NAME = "arees_basiques_policials_vigent_2024"

# Catalonia bounding box (with small buffer)
MIN_LON, MAX_LON = 0.1, 3.4
MIN_LAT, MAX_LAT = 40.4, 43.0

# Buffer to snap tile-boundary seams (~33 m)
SNAP_BUF = 0.0003

# Minimum polygon part area to keep (filters tile artefacts)
MIN_PART_AREA = 0.0001  # ~1 km²

# Manual name mapping: CSV name → vector tile abp_d name
MANUAL_MAPPINGS = {
    'ABP Bages - Moianès': 'ABP Bages',
}

CURRENT_YEAR = date.today().year


# ---------------------------------------------------------------------------
# Step 1 – Download CSVs
# ---------------------------------------------------------------------------

def download_csvs():
    print("=== Downloading crime CSVs ===")
    for year in range(2019, CURRENT_YEAR + 1):
        dest = DATA_DIR / f"Fets_{year}.csv"
        url = f"{BASE_URL}/Fets_{year}.csv"
        try:
            urllib.request.urlretrieve(url, dest)
            with open(dest, encoding='utf-8-sig') as f:
                rows = sum(1 for _ in f) - 1
            print(f"  Fets_{year}.csv — {rows:,} rows")
        except Exception as e:
            if dest.exists():
                dest.unlink()
            print(f"  Fets_{year}.csv — not available ({e})")


def download_comissaries():
    print("=== Downloading comissaries.geojson ===")
    dest = DATA_DIR / "comissaries.geojson"
    urllib.request.urlretrieve(f"{BASE_URL}/comissaries.geojson", dest)

    with open(dest) as f:
        geo = json.load(f)

    # Fix two known bad coordinates (latitude stored without decimal point)
    fixed = 0
    for feature in geo['features']:
        coords = feature['geometry']['coordinates']
        if coords[1] > 1000:
            lat_str = feature['properties'].get('latitud', '')
            if lat_str:
                feature['geometry']['coordinates'][1] = float(lat_str) / 1000000
                feature['properties']['latitud'] = str(feature['geometry']['coordinates'][1])
                fixed += 1

    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(geo, f, ensure_ascii=False)

    print(f"  {len(geo['features'])} features, {fixed} coordinates fixed")


# ---------------------------------------------------------------------------
# Step 2 – Build combined CSV
# ---------------------------------------------------------------------------

def build_combined_csv():
    print("=== Building combined CSV ===")
    dfs = []
    for p in sorted(DATA_DIR.glob("Fets_*.csv")):
        if "combined" in p.name:
            continue
        try:
            dfs.append(pd.read_csv(p, sep=';', encoding='utf-8-sig'))
        except Exception as e:
            print(f"  Skipping {p.name}: {e}")

    if not dfs:
        print("  No CSV files found — skipping")
        return

    combined = pd.concat(dfs, ignore_index=True)
    years = sorted(combined['Any'].unique())
    dest = DATA_DIR / f"Fets_combined_{years[0]}_{years[-1]}.csv"
    combined.to_csv(dest, index=False, encoding='utf-8')
    print(f"  {len(combined):,} rows → {dest.name}")


# ---------------------------------------------------------------------------
# Step 3 – Download ABP polygon tiles
# ---------------------------------------------------------------------------

def _lon_to_x(lon, z): return int((lon + 180) / 360 * 2 ** z)
def _lat_to_y(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z)


def download_tiles(tmp_dir: Path) -> list[tuple[int, int, Path]]:
    z = TILE_ZOOM
    x_min, x_max = _lon_to_x(MIN_LON, z), _lon_to_x(MAX_LON, z)
    y_min, y_max = _lat_to_y(MAX_LAT, z), _lat_to_y(MIN_LAT, z)
    total = (x_max - x_min + 1) * (y_max - y_min + 1)
    print(f"=== Downloading {total} vector tiles (zoom {z}) ===")

    tiles = []
    count = 0
    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            dest = tmp_dir / f"{x}_{y}.pbf"
            url = TILE_URL.format(z=z, x=x, y=y)
            try:
                urllib.request.urlretrieve(url, dest)
                tiles.append((x, y, dest))
            except Exception:
                pass
            count += 1
            if count % 200 == 0:
                print(f"  {count}/{total}...")

    print(f"  {len(tiles)} tiles downloaded")
    return tiles


# ---------------------------------------------------------------------------
# Step 4 – Extract and dissolve ABP polygons
# ---------------------------------------------------------------------------

def extract_abp_polygons(tiles: list[tuple[int, int, Path]]) -> gpd.GeoDataFrame:
    print("=== Extracting ABP polygons from tiles ===")
    pieces_by_abp = defaultdict(list)
    props_by_abp = {}

    for x, y, pbf in tiles:
        result = subprocess.run([
            "ogr2ogr", "-f", "GeoJSON", "/vsistdout/",
            "-t_srs", "EPSG:4326",
            str(pbf),
            LAYER_NAME,
            "-where", "abp_c IS NOT NULL",
            "-oo", f"X={x}", "-oo", f"Y={y}", "-oo", f"Z={TILE_ZOOM}",
        ], capture_output=True, text=True)

        if result.returncode != 0 or not result.stdout.strip():
            continue

        try:
            fc = json.loads(result.stdout)
        except Exception:
            continue

        for feat in fc.get("features", []):
            props = feat['properties']
            abp_c = props.get('abp_c', '')
            if not abp_c:
                continue
            try:
                g = make_valid(shape(feat['geometry']))
                if not g.is_empty:
                    pieces_by_abp[abp_c].append(g)
                    props_by_abp.setdefault(abp_c, props)
            except Exception:
                pass

    print(f"  {len(pieces_by_abp)} unique ABP codes found")
    print("  Dissolving tile pieces...")

    records = []
    for abp_c, pieces in pieces_by_abp.items():
        merged = unary_union([g.buffer(SNAP_BUF) for g in pieces]).buffer(-SNAP_BUF)
        merged = make_valid(merged)

        # Drop micro-fragments left by the buffer round-trip
        if merged.geom_type == 'MultiPolygon':
            parts = [p for p in merged.geoms if p.area >= MIN_PART_AREA]
            if parts:
                merged = parts[0] if len(parts) == 1 else MultiPolygon(parts)

        props = props_by_abp[abp_c]
        records.append({
            'abp_c': abp_c,
            'abp_d': props.get('abp_d', ''),
            'abp_name': props.get('Àrea bàsica policial', ''),
            'regio_c': props.get('regio_c', ''),
            'abp_pob': int(props.get('abp_pob') or 0),
            'geometry': merged,
        })

    gdf = gpd.GeoDataFrame(records, crs="EPSG:4326")
    types = gdf.geometry.geom_type.value_counts().to_dict()
    print(f"  {len(gdf)} polygons: {types}")
    return gdf


# ---------------------------------------------------------------------------
# Step 5 – Join crime stats and export
# ---------------------------------------------------------------------------

def _norm(s: str) -> str:
    if not s:
        return ''
    s = MANUAL_MAPPINGS.get(s.strip(), s.strip())
    s = s.lower()
    for k, v in [('àrea bàsica policial ', ''), ('abp ', ''), ('abp', ''),
                 ('l·', 'l'), ('·', 'l'), (' - ', ' '), ('-', ' '), ('  ', ' ')]:
        s = s.replace(k, v)
    return s.strip()


def aggregate_crimes() -> pd.DataFrame:
    dfs = []
    for p in sorted(DATA_DIR.glob("Fets_[0-9]*.csv")):
        try:
            dfs.append(pd.read_csv(p, sep=';', encoding='utf-8-sig'))
        except Exception:
            pass
    crimes = pd.concat(dfs, ignore_index=True)
    for col in ['Coneguts', 'Resolts', 'Detencions']:
        crimes[col] = pd.to_numeric(crimes[col], errors='coerce').fillna(0).astype(int)

    totals = crimes.groupby('Àrea Bàsica Policial (ABP)').agg(
        total_coneguts=('Coneguts', 'sum'),
        total_resolts=('Resolts', 'sum'),
        total_detencions=('Detencions', 'sum'),
        regio_policial=('Regió Policial (RP)', 'first'),
    ).reset_index().rename(columns={'Àrea Bàsica Policial (ABP)': 'abp_csv'})

    pivot = (crimes
             .groupby(['Àrea Bàsica Policial (ABP)', 'Any'])
             .agg(coneguts=('Coneguts', 'sum'))
             .reset_index()
             .pivot(index='Àrea Bàsica Policial (ABP)', columns='Any', values='coneguts')
             .fillna(0).astype(int))
    pivot.columns = [f'coneguts_{y}' for y in pivot.columns]
    pivot = pivot.reset_index().rename(columns={'Àrea Bàsica Policial (ABP)': 'abp_csv'})

    return totals.merge(pivot, on='abp_csv', how='left')


def join_and_export(gdf_abp: gpd.GeoDataFrame):
    print("=== Joining crime data ===")
    crimes_agg = aggregate_crimes()

    gdf_abp['_n'] = gdf_abp['abp_d'].apply(_norm)
    crimes_agg['_n'] = crimes_agg['abp_csv'].apply(_norm)
    final = gdf_abp.merge(crimes_agg, on='_n', how='left')
    final.drop(columns=['_n'], inplace=True)

    matched = final['abp_csv'].notna().sum()
    print(f"  Matched: {matched}/{len(gdf_abp)}")

    geojson_path = DATA_DIR / "abp_polygons_clean.geojson"
    gpkg_path = DATA_DIR / "crimes_catalunya.gpkg"

    print("=== Exporting ===")
    final.to_file(geojson_path, driver='GeoJSON')
    print(f"  {geojson_path.name}")
    final.to_file(gpkg_path, layer='abp_polygons', driver='GPKG')
    print(f"  {gpkg_path.name}")

    print()
    print("Top 10 ABPs by total crimes (all years):")
    cols = ['abp_d', 'total_coneguts', 'total_resolts', 'total_detencions']
    print(final[cols].sort_values('total_coneguts', ascending=False).head(10).to_string(index=False))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import tempfile

    download_csvs()
    download_comissaries()
    build_combined_csv()

    with tempfile.TemporaryDirectory() as tmp:
        tiles = download_tiles(Path(tmp))
        gdf_abp = extract_abp_polygons(tiles)

    join_and_export(gdf_abp)
    print("\nDone. All files written to data/")


if __name__ == '__main__':
    main()
