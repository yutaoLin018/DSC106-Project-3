import os
import pandas as pd

os.makedirs("data", exist_ok=True)

INPUT = "data/modis_lst_july_2012_2023_full.csv"
OUTPUT = "data/modis_lst_july_2012_2023_small.csv"

df = pd.read_csv(INPUT)

print("Original shape:", df.shape)

# Try n = 6 first. If the file is still too large, use 8 or 10.
n = 6

df = df.sort_values(["date", "lat", "lon"]).reset_index(drop=True)

keep_lats = sorted(df["lat"].unique())[::n]
keep_lons = sorted(df["lon"].unique())[::n]

df_small = df[
    df["lat"].isin(keep_lats) &
    df["lon"].isin(keep_lons)
].copy()

# Round values to reduce file size
df_small["lat"] = df_small["lat"].round(2)
df_small["lon"] = df_small["lon"].round(2)
df_small["lst_C"] = df_small["lst_C"].round(1)

df_small.to_csv(OUTPUT, index=False)

print("Small shape:", df_small.shape)
print("Saved:", OUTPUT)

size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
print(f"File size: {size_mb:.2f} MB")