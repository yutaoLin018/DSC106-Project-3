import pandas as pd
import os

os.makedirs("data", exist_ok=True)

df = pd.read_csv("data/modis_lst_all_years.csv")

print("Original shape:", df.shape)

# Sort first
df = df.sort_values(["date", "lat", "lon"]).reset_index(drop=True)

# Keep every nth unique latitude and longitude
n = 8

keep_lats = sorted(df["lat"].unique())[::n]
keep_lons = sorted(df["lon"].unique())[::n]

df_small = df[
    df["lat"].isin(keep_lats) &
    df["lon"].isin(keep_lons)
].copy()

print("Small shape:", df_small.shape)

df_small.to_csv("data/modis_lst_all_years_small.csv", index=False)

print("Saved: data/modis_lst_all_years_small.csv")