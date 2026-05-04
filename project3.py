#Use this packages:
#pandas numpy xarray gcsfs cftime nc-time-axis zarr dask aiohttp fsspec matplotlib

import os
import numpy as np
import pandas as pd
import xarray as xr
import gcsfs

# ==========================================================
# Project 3 CMIP6 preprocessing
# Output files:
#   data/anomaly_grid.csv
#   data/regional_anomaly.csv
# ==========================================================

os.makedirs("data", exist_ok=True)

# -----------------------------
# 1. Load CMIP6 catalog
# -----------------------------
catalog_url = "https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv"
df = pd.read_csv(catalog_url)

# -----------------------------
# 2. Choose dataset
# -----------------------------
SOURCE_ID = "CESM2"
EXPERIMENT = "historical"

matches = df.query(
    "activity_id == 'CMIP' and "
    "source_id == @SOURCE_ID and "
    "experiment_id == @EXPERIMENT and "
    "table_id == 'Amon' and "
    "variable_id == 'tas'"
)

print("Matching datasets:")
print(matches[["source_id", "experiment_id", "member_id", "variable_id", "zstore"]].head())

if matches.empty:
    raise ValueError("No matching CMIP6 dataset found. Try another SOURCE_ID.")

# Use the first matching model run
zstore = matches.iloc[0]["zstore"]
print("\nUsing zstore:")
print(zstore)

# -----------------------------
# 3. Open Zarr data from Google Cloud
# -----------------------------
gcs = gcsfs.GCSFileSystem(token="anon")
mapper = gcs.get_mapper(zstore)

# Requires cftime because CMIP6 uses non-standard calendars
ds = xr.open_zarr(mapper, consolidated=True)

print("\nDataset opened successfully:")
print(ds)

# -----------------------------
# 4. Temperature processing
# -----------------------------
tas_C = ds["tas"] - 273.15
tas_C.attrs["units"] = "Celsius"

# Historical CESM2 runs usually end at 2014
tas_C = tas_C.sel(time=slice("1950", "2014"))

# Annual average
annual = tas_C.groupby("time.year").mean("time")

# Convert longitude from 0–360 to -180–180 for D3 map
annual = annual.assign_coords(lon=(((annual.lon + 180) % 360) - 180))
annual = annual.sortby("lon")

# Baseline: 1951–1980
baseline = annual.sel(year=slice(1951, 1980)).mean("year")

# Temperature anomaly
anom = annual - baseline
anom.name = "anomaly_C"

# -----------------------------
# 5. Save grid anomaly data
# -----------------------------
print("\nCreating anomaly grid CSV...")

# Downsample grid so browser/D3 can load it smoothly
anom_small = anom.coarsen(lat=4, lon=4, boundary="trim").mean().compute()

grid_df = anom_small.to_dataframe(name="anomaly_C").reset_index()
grid_df = grid_df.dropna()

grid_df["year"] = grid_df["year"].astype(int)
grid_df["lat"] = grid_df["lat"].round(2)
grid_df["lon"] = grid_df["lon"].round(2)
grid_df["anomaly_C"] = grid_df["anomaly_C"].round(3)

grid_df.to_csv("data/anomaly_grid.csv", index=False)

print("Saved: data/anomaly_grid.csv")
print(grid_df.head())

# -----------------------------
# 6. Save regional anomaly data
# -----------------------------
print("\nCreating regional anomaly CSV...")

weights = np.cos(np.deg2rad(annual["lat"]))

regions = {
    "Arctic": annual["lat"] >= 66.5,
    "Northern Mid-Latitudes": (annual["lat"] >= 30) & (annual["lat"] < 66.5),
    "Tropics": (annual["lat"] >= -23.5) & (annual["lat"] <= 23.5),
    "Southern Mid-Latitudes": (annual["lat"] > -66.5) & (annual["lat"] < -30),
    "Antarctic": annual["lat"] <= -66.5,
}

regional_rows = []

for region_name, mask in regions.items():
    region_anom = anom.where(mask).weighted(weights).mean(("lat", "lon")).compute()

    temp = region_anom.to_dataframe(name="anomaly_C").reset_index()
    temp["region"] = region_name

    regional_rows.append(temp)

regional_df = pd.concat(regional_rows, ignore_index=True)

regional_df["year"] = regional_df["year"].astype(int)
regional_df["anomaly_C"] = regional_df["anomaly_C"].round(3)

regional_df.to_csv("data/regional_anomaly.csv", index=False)

print("Saved: data/regional_anomaly.csv")
print(regional_df.head())

print("\nDone! You can now use these CSV files in your D3 project.")