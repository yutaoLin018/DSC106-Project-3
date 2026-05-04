import os
import pandas as pd
import matplotlib.pyplot as plt
import geopandas as gpd

# -----------------------------
# Setup
# -----------------------------
os.makedirs("static_images", exist_ok=True)

# Load anomaly grid data
grid_df = pd.read_csv("data/anomaly_grid.csv")

# Key years to compare
years_to_plot = [1950, 1975, 2000, 2014]

# Load built-in world map from GeoPandas
world_url = "https://naturalearth.s3.amazonaws.com/110m_cultural/ne_110m_admin_0_countries.zip"
world = gpd.read_file(world_url)

# -----------------------------
# Function to draw one world map
# -----------------------------
def draw_world_map(year, ax):
    year_df = grid_df[grid_df["year"] == year]

    # Draw world map background
    world.plot(ax=ax, color="whitesmoke", edgecolor="gray", linewidth=0.5)

    # Overlay anomaly points
    scatter = ax.scatter(
        year_df["lon"],
        year_df["lat"],
        c=year_df["anomaly_C"],
        cmap="coolwarm",
        vmin=-4,
        vmax=4,
        s=12,
        alpha=0.9
    )

    ax.set_title(str(year), fontsize=14)
    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")

    return scatter

# -----------------------------
# 2x2 comparison figure
# -----------------------------
fig, axes = plt.subplots(2, 2, figsize=(18, 10))
axes = axes.flatten()

scatter = None
for ax, year in zip(axes, years_to_plot):
    scatter = draw_world_map(year, ax)

# Leave room on the right for the shared colorbar
fig.subplots_adjust(right=0.88, top=0.90, wspace=0.12, hspace=0.20)

# Create a dedicated axis for the colorbar
cbar_ax = fig.add_axes([0.90, 0.15, 0.02, 0.70])  # [left, bottom, width, height]
cbar = fig.colorbar(scatter, cax=cbar_ax)
cbar.set_label("Temperature anomaly (°C)")

fig.suptitle("Global Temperature Anomaly Maps for Key Years", fontsize=20)

plt.savefig("static_images/world_maps_key_years.png", dpi=300, bbox_inches="tight")
plt.show()

# -----------------------------
# Save each year separately too
# -----------------------------
for year in years_to_plot:
    fig, ax = plt.subplots(figsize=(14, 7))
    scatter = draw_world_map(year, ax)
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label("Temperature anomaly (°C)")
    plt.title(f"Global Temperature Anomaly Map, {year}", fontsize=18)
    plt.tight_layout()
    plt.savefig(f"static_images/world_map_{year}.png", dpi=300, bbox_inches="tight")
    plt.show()

print("Saved static world maps in the static_images/ folder.")