Question:
How did July land surface temperature change across the world from 2012 to 2023?

DATASET:
NASA MODIS Land Surface Temperature dataset, specifically the MOD_LSTD_M monthly daytime land surface temperature product
The dataset contains global monthly daytime land surface temperature values
Use three main aspects of the data:
Spatial location: latitude and longitude allow us to map temperature across the world.
Time: snapshots from 2012–2023 allow us to compare changes across about a decade.
Temperature value: land surface temperature in degrees Celsius.


The final interactive visualization will use a world map, year selector, hover tooltips, and a toggle between absolute temperature and change from 2012.



Use this packages:
pandas numpy xarray gcsfs cftime nc-time-axis zarr dask aiohttp fsspec matplotlib geopandas
