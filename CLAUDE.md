# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

Single-script data pipeline that downloads Catalonia crime statistics from [Mossos d'Esquadra open data](https://visors.icgc.cat/mapa-delinquencial/) and produces geospatial files for a future React + MapLibre interactive crime map.

## Data files

`data/` is git-ignored and not tracked — the pipeline regenerates everything from source. Do not read the actual files in `data/` for context; the full schema (field names, types, row counts, CRS, limitations) is documented in `README.md`.

## Planned next step

The `docs/PROJECT_BRIEF.md` describes a React + MapLibre web interface that consumes the output files — time slider, crime type filter, composite safety index. No web code exists yet.
