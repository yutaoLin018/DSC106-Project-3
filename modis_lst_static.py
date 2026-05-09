import os
import gzip
import requests
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from io import BytesIO, StringIO

os.makedirs("modis_lst_images", exist_ok=True)
os.makedirs("data", exist_ok=True)

DATASET = "MOD_LSTD_M"

# July of every year from 2012 through 2023
DATES = [f"{year}-07" for year in range(2012, 2024)]

def download_neo_csv_gz(date):
    url = f"https://neo.gsfc.nasa.gov/archive/csv/{DATASET}/{DATASET}_{date}.CSV.gz"
    print("Downloading:", url)

    r = requests.get(url, timeout=60)
    r.raise_for_status()

    with gzip.GzipFile(fileobj=BytesIO(r.content)) as gz:
        csv_text = gz.read().decode("utf-8", errors="replace")

    return csv_text

def parse_neo_grid(csv_text):
    df = pd.read_csv(StringIO(csv_text), header=None)
    values = df.values.astype(float)

    # 99999 is missing data
    values = np.where(values >= 99999, np.nan, values)
    values = np.where(values <= -9999, np.nan, values)

    nlat, nlon = values.shape

    # Generate latitude and longitude cell centers
    lats = np.linspace(90 - 90 / nlat, -90 + 90 / nlat, nlat)
    lons = np.linspace(-180 + 180 / nlon, 180 - 180 / nlon, nlon)

    print("Grid shape:", values.shape)
    print("Valid pixels:", np.isfinite(values).sum())
    print("Value range:", np.nanmin(values), np.nanmax(values))

    return lons, lats, values

def save_flat_csv(date, lons, lats, values):
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    flat = pd.DataFrame({
        "date": date,
        "year": int(date[:4]),
        "month": int(date[5:7]),
        "lat": lat_grid.ravel(),
        "lon": lon_grid.ravel(),
        "lst_C": values.ravel()
    })

    flat = flat.dropna()
    flat["lat"] = flat["lat"].round(2)
    flat["lon"] = flat["lon"].round(2)
    flat["lst_C"] = flat["lst_C"].round(2)

    out_path = f"data/modis_lst_{date}.csv"
    flat.to_csv(out_path, index=False)

    print("Saved:", out_path)
    return flat

def plot_lst_map(date, values):
    plt.figure(figsize=(14, 7))

    img = plt.imshow(
        values,
        extent=[-180, 180, -90, 90],
        origin="upper",
        cmap="inferno",
        vmin=-30,
        vmax=60,
        aspect="auto"
    )

    plt.colorbar(img, label="Land surface temperature (°C)")
    plt.title(f"MODIS Land Surface Temperature, {date}")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.xlim(-180, 180)
    plt.ylim(-90, 90)

    plt.tight_layout()

    out_path = f"modis_lst_images/modis_lst_{date}.png"
    plt.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close()

    print("Saved:", out_path)

all_rows = []

for date in DATES:
    csv_text = download_neo_csv_gz(date)
    lons, lats, values = parse_neo_grid(csv_text)

    flat = save_flat_csv(date, lons, lats, values)
    all_rows.append(flat)

    plot_lst_map(date, values)

combined = pd.concat(all_rows, ignore_index=True)
combined.to_csv("data/modis_lst_july_2012_2023_full.csv", index=False)

print("\nSaved full data:")
print("data/modis_lst_july_2012_2023_full.csv")
print(combined.head())
print(combined.shape)