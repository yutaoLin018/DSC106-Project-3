import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


os.makedirs("exploratory_images", exist_ok=True)

# Use the smaller CSV for faster plotting / GitHub Pages compatibility
DATA_PATH = "data/modis_lst_all_years_small.csv"

# If you want to use the full file locally, change to:
# DATA_PATH = "data/modis_lst_all_years.csv"

df = pd.read_csv(DATA_PATH)

# Basic cleaning
df = df.dropna(subset=["lat", "lon", "lst_C", "year"])
df["year"] = df["year"].astype(int)

print(df.head())
print(df.shape)
print(df["year"].unique())


# ==========================================================
# Graph 1: Global July Land Surface Temperature Maps
# ==========================================================

def graph1_key_year_maps():
    years = sorted(df["year"].unique())

    # 2 rows x 3 columns:
    # 2012, 2015, 2018
    # 2020, 2023, colorbar space
    fig, axes = plt.subplots(
        2, 3,
        figsize=(18, 9),
        sharex=True,
        sharey=True,
        constrained_layout=True
    )

    axes = axes.flatten()

    mappable = None

    for i, year in enumerate(years):
        ax = axes[i]
        year_df = df[df["year"] == year].copy()

        grid = year_df.pivot(index="lat", columns="lon", values="lst_C")
        grid = grid.sort_index()
        grid = grid.reindex(sorted(grid.columns), axis=1)

        lon_vals = grid.columns.values
        lat_vals = grid.index.values
        Z = grid.values

        mappable = ax.pcolormesh(
            lon_vals,
            lat_vals,
            Z,
            shading="auto",
            cmap="inferno",
            vmin=-30,
            vmax=60
        )

        ax.set_title(str(year), fontsize=12)
        ax.set_xlabel("Longitude")
        ax.set_ylabel("Latitude")
        ax.set_xlim(-180, 180)
        ax.set_ylim(-90, 90)

    # Hide unused 6th panel
    axes[5].axis("off")

    cbar = fig.colorbar(
        mappable,
        ax=axes[:5],
        shrink=0.8,
        pad=0.02
    )
    cbar.set_label("Land surface temperature (°C)")

    fig.suptitle("July Land Surface Temperature Across Key Years", fontsize=18)

    plt.savefig(
        "exploratory_images/graph1_key_year_temperature_maps.png",
        dpi=300,
        bbox_inches="tight"
    )
    plt.show()


# ==========================================================
# Graph 2: Temperature Difference Map, 2023 - 2012
# ==========================================================

def graph2_difference_map():
    start_year = df["year"].min()
    end_year = df["year"].max()

    start_df = df[df["year"] == start_year][["lat", "lon", "lst_C"]].rename(
        columns={"lst_C": "lst_start"}
    )
    end_df = df[df["year"] == end_year][["lat", "lon", "lst_C"]].rename(
        columns={"lst_C": "lst_end"}
    )

    merged = pd.merge(start_df, end_df, on=["lat", "lon"], how="inner")
    merged["change_C"] = merged["lst_end"] - merged["lst_start"]

    print("Difference map data:")
    print(merged.head())
    print(merged["change_C"].describe())

    plt.figure(figsize=(14, 7))

    sc = plt.scatter(
        merged["lon"],
        merged["lat"],
        c=merged["change_C"],
        cmap="coolwarm",
        s=3,
        vmin=-10,
        vmax=10
    )

    plt.colorbar(sc, label=f"Temperature change, {end_year} - {start_year} (°C)")
    plt.title(f"Where Did July Land Surface Temperature Increase Most? ({end_year} - {start_year})")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.xlim(-180, 180)
    plt.ylim(-90, 90)
    plt.tight_layout()
    plt.savefig("exploratory_images/graph2_temperature_difference_map.png", dpi=300)
    plt.show()

    merged.to_csv("data/modis_lst_difference.csv", index=False)


# ==========================================================
# Graph 3: Regional Average Temperature Over Time
# ==========================================================

def assign_region(row):
    lat = row["lat"]
    lon = row["lon"]

    # Arctic first, so far-north land is grouped consistently
    if lat >= 66.5:
        return "Arctic Land"

    # North America
    elif 15 <= lat < 66.5 and -170 <= lon <= -50:
        return "North America"

    # South America
    elif -60 <= lat <= 15 and -90 <= lon <= -30:
        return "South America"

    # Europe
    elif 35 <= lat < 66.5 and -10 <= lon <= 40:
        return "Europe"

    # Africa, whole continent approximation
    elif -35 <= lat <= 37 and -20 <= lon <= 55:
        return "Africa"

    # South Asia
    elif 5 <= lat <= 35 and 60 <= lon <= 100:
        return "South Asia"

    # North Asia / Siberia / Central-North Asia
    elif 35 <= lat < 66.5 and 40 < lon <= 150:
        return "North Asia"

    # Australia
    elif -45 <= lat <= -10 and 110 <= lon <= 155:
        return "Australia"

    else:
        return "Other"

def graph3_regional_trends():
    temp = df.copy()
    temp["region"] = temp.apply(assign_region, axis=1)

    region_df = (
        temp[temp["region"] != "Other"]
        .groupby(["year", "region"], as_index=False)["lst_C"]
        .mean()
    )

    plt.figure(figsize=(11, 6))

    for region in region_df["region"].unique():
        subset = region_df[region_df["region"] == region]
        plt.plot(subset["year"], subset["lst_C"], marker="o", label=region)

    plt.title("Regional July Land Surface Temperature Trends")
    plt.xlabel("Year")
    plt.ylabel("Average land surface temperature (°C)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("exploratory_images/graph3_regional_temperature_trends.png", dpi=300)
    plt.show()

    region_df.to_csv("data/modis_regional_trends.csv", index=False)



# ==========================================================
# Graph 4: Temperature Distribution Comparison
# ==========================================================

def graph4_distribution_comparison():
    start_year = df["year"].min()
    end_year = df["year"].max()

    start_vals = df[df["year"] == start_year]["lst_C"]
    end_vals = df[df["year"] == end_year]["lst_C"]

    plt.figure(figsize=(10, 6))

    plt.hist(
        start_vals,
        bins=40,
        alpha=0.6,
        label=str(start_year),
        density=True
    )

    plt.hist(
        end_vals,
        bins=40,
        alpha=0.6,
        label=str(end_year),
        density=True
    )

    plt.title("Are More Land Areas Experiencing Extreme Heat?")
    plt.xlabel("Land surface temperature (°C)")
    plt.ylabel("Density")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("exploratory_images/graph4_temperature_distribution.png", dpi=300)
    plt.show()


# ==========================================================
# Graph 5: Hotspot Change Map
# ==========================================================

def graph5_hotspot_change_map():
    start_year = df["year"].min()
    end_year = df["year"].max()

    start_df = df[df["year"] == start_year][["lat", "lon", "lst_C"]].rename(
        columns={"lst_C": "lst_start"}
    )
    end_df = df[df["year"] == end_year][["lat", "lon", "lst_C"]].rename(
        columns={"lst_C": "lst_end"}
    )

    merged = pd.merge(start_df, end_df, on=["lat", "lon"], how="inner")
    merged["change_C"] = merged["lst_end"] - merged["lst_start"]

    # Choose a threshold for strong warming
    threshold = 5
    hotspots = merged[merged["change_C"] >= threshold]

    plt.figure(figsize=(14, 7))

    # Background: all available points in light gray
    plt.scatter(
        merged["lon"],
        merged["lat"],
        c="lightgray",
        s=1,
        alpha=0.4
    )

    # Hotspots: colored by amount of warming
    sc = plt.scatter(
        hotspots["lon"],
        hotspots["lat"],
        c=hotspots["change_C"],
        cmap="Reds",
        s=5,
        vmin=threshold,
        vmax=max(threshold + 1, hotspots["change_C"].max())
    )

    plt.colorbar(sc, label=f"Temperature increase since {start_year} (°C)")
    plt.title(f"Emerging Land Surface Heat Hotspots: Areas Warming ≥ {threshold}°C")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.xlim(-180, 180)
    plt.ylim(-90, 90)
    plt.tight_layout()
    plt.savefig("exploratory_images/graph5_hotspot_change_map.png", dpi=300)
    plt.show()

    hotspots.to_csv("data/modis_hotspots.csv", index=False)


# ==========================================================
# Run all graphs
# ==========================================================

graph1_key_year_maps()
graph2_difference_map()
graph3_regional_trends()
graph4_distribution_comparison()
graph5_hotspot_change_map()

print("Done. Saved graphs in exploratory_images/")