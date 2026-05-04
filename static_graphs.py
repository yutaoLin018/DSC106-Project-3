import os
import pandas as pd
import matplotlib.pyplot as plt

# -----------------------------
# Setup
# -----------------------------
os.makedirs("static_images", exist_ok=True)

grid_df = pd.read_csv("data/anomaly_grid.csv")
regional_df = pd.read_csv("data/regional_anomaly.csv")

print("Grid data:")
print(grid_df.head())
print(grid_df.shape)

print("\nRegional data:")
print(regional_df.head())
print(regional_df.shape)

# -----------------------------
# Graph 1: Global anomaly over time
# -----------------------------
global_df = (
    grid_df
    .groupby("year", as_index=False)["anomaly_C"]
    .mean()
)

plt.figure(figsize=(10, 5))
plt.plot(global_df["year"], global_df["anomaly_C"])
plt.axhline(0, color="black", linewidth=1)
plt.title("Global Temperature Anomaly Over Time")
plt.xlabel("Year")
plt.ylabel("Average temperature anomaly (°C)")
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("static_images/graph1_global_anomaly.png", dpi=300)
plt.show()

# -----------------------------
# Graph 2: Regional anomaly over time
# -----------------------------
plt.figure(figsize=(11, 6))

for region in regional_df["region"].unique():
    subset = regional_df[regional_df["region"] == region]
    plt.plot(subset["year"], subset["anomaly_C"], label=region)

plt.axhline(0, color="black", linewidth=1)
plt.title("Regional Temperature Anomaly Over Time")
plt.xlabel("Year")
plt.ylabel("Temperature anomaly (°C)")
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("static_images/graph2_regional_anomaly.png", dpi=300)
plt.show()

# -----------------------------
# Graph 3: Map-like scatter for one year
# -----------------------------
year_to_plot = 2014
year_df = grid_df[grid_df["year"] == year_to_plot]

plt.figure(figsize=(12, 6))
scatter = plt.scatter(
    year_df["lon"],
    year_df["lat"],
    c=year_df["anomaly_C"],
    s=8,
    cmap="coolwarm",
    vmin=-4,
    vmax=4
)
plt.colorbar(scatter, label="Temperature anomaly (°C)")
plt.title(f"Temperature Anomaly Map, {year_to_plot}")
plt.xlabel("Longitude")
plt.ylabel("Latitude")
plt.tight_layout()
plt.savefig("static_images/graph3_anomaly_map_2014.png", dpi=300)
plt.show()

# -----------------------------
# Graph 4: Arctic vs Tropics comparison
# -----------------------------
compare_regions = ["Arctic", "Tropics"]

plt.figure(figsize=(10, 5))

for region in compare_regions:
    subset = regional_df[regional_df["region"] == region]
    plt.plot(subset["year"], subset["anomaly_C"], label=region)

plt.axhline(0, color="black", linewidth=1)
plt.title("Arctic vs Tropics Warming")
plt.xlabel("Year")
plt.ylabel("Temperature anomaly (°C)")
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("static_images/graph4_arctic_vs_tropics.png", dpi=300)
plt.show()

# -----------------------------
# Graph 5: Fastest warming grid locations
# -----------------------------
trend_rows = []

for (lat, lon), group in grid_df.groupby(["lat", "lon"]):
    group = group.sort_values("year")
    start = group[group["year"] == group["year"].min()]["anomaly_C"].values[0]
    end = group[group["year"] == group["year"].max()]["anomaly_C"].values[0]
    change = end - start

    trend_rows.append({
        "lat": lat,
        "lon": lon,
        "change_C": change
    })

trend_df = pd.DataFrame(trend_rows)
top = trend_df.sort_values("change_C", ascending=False).head(15)
top["location"] = top.apply(
    lambda row: f"lat {row['lat']:.1f}, lon {row['lon']:.1f}",
    axis=1
)

plt.figure(figsize=(10, 7))
plt.barh(top["location"], top["change_C"])
plt.gca().invert_yaxis()
plt.title("Fastest-Warming Grid Locations, 1950–2014")
plt.xlabel("Temperature anomaly change (°C)")
plt.ylabel("Location")
plt.tight_layout()
plt.savefig("static_images/graph5_fastest_warming_locations.png", dpi=300)
plt.show()

print("\nSaved static images in the static_images/ folder.")