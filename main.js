const DATA_PATH = "data/modis_lst_july_2012_2023_small.csv";

// ======================================================
// State
// ======================================================

let rawData = [];
let dataByYear = new Map();
let baselineByLocation = new Map();
let regionalData = [];

let currentYear = 2023;
let currentMode = "change";
let currentRegion = "All";
let currentTransform = d3.zoomIdentity;

let worldFeatures = [];
let featureRegionLookup = [];
let zoomBehavior = null;

let playTimer = null;
let isPlaying = false;

// ======================================================
// DOM
// ======================================================

const canvas = document.querySelector("#map-canvas");
const context = canvas.getContext("2d");
const overlay = d3.select("#map-overlay");
const tooltip = d3.select("#tooltip");
const mapWrap = document.querySelector("#map-wrap");

// ======================================================
// Projection
// ======================================================

let width = 1000;
let height = 500;

const projection = d3.geoEquirectangular();
const path = d3.geoPath(projection);

// ======================================================
// Color scales
// ======================================================

const tempColor = d3.scaleSequential()
  .domain([-30, 60])
  .interpolator(d3.interpolateInferno);

// Binned diverging scale for change map
const changeThresholds = [-5, -2, 0, 2, 5];

const changeLabels = [
  "≤ -5",
  "-5 to -2",
  "-2 to 0",
  "0 to 2",
  "2 to 5",
  "≥ 5"
];

const changeColors = [
  "#2166ac",
  "#67a9cf",
  "#d1e5f0",
  "#fddbc7",
  "#ef8a62",
  "#b2182b"
];

const changeColor = d3.scaleThreshold()
  .domain(changeThresholds)
  .range(changeColors);

// ======================================================
// Regions
// ======================================================

const regionCountries = {
  "North America": [
    "Canada",
    "United States of America",
    "United States",
    "Mexico"
  ],

  "Central America & Caribbean": [
    "Guatemala", "Belize", "Honduras", "El Salvador", "Nicaragua",
    "Costa Rica", "Panama", "Cuba", "Haiti", "Dominican Republic",
    "Jamaica", "Puerto Rico", "The Bahamas", "Bahamas", "Trinidad and Tobago"
  ],

  "South America": [
    "Colombia", "Venezuela", "Guyana", "Suriname", "Ecuador",
    "Peru", "Bolivia", "Brazil", "Paraguay", "Chile",
    "Argentina", "Uruguay"
  ],

  "Europe": [
    "United Kingdom", "Ireland", "France", "Spain", "Portugal",
    "Germany", "Belgium", "Netherlands", "Luxembourg", "Switzerland",
    "Italy", "Austria", "Poland", "Czechia", "Czech Republic",
    "Slovakia", "Hungary", "Romania", "Bulgaria", "Greece",
    "Norway", "Sweden", "Finland", "Denmark", "Iceland",
    "Estonia", "Latvia", "Lithuania", "Ukraine", "Belarus",
    "Moldova", "Serbia", "Croatia", "Slovenia", "Bosnia and Herzegovina",
    "Montenegro", "Albania", "North Macedonia", "Kosovo"
  ],

  "Africa": [
    "Morocco", "Algeria", "Tunisia", "Libya", "Egypt",
    "Mauritania", "Mali", "Niger", "Chad", "Sudan", "South Sudan",
    "Eritrea", "Djibouti", "Ethiopia", "Somalia",
    "Senegal", "Gambia", "Guinea-Bissau", "Guinea", "Sierra Leone",
    "Liberia", "Côte d'Ivoire", "Ivory Coast", "Ghana", "Togo", "Benin",
    "Burkina Faso", "Nigeria", "Cameroon", "Central African Republic",
    "Equatorial Guinea", "Gabon", "Republic of the Congo", "Congo",
    "Democratic Republic of the Congo", "Angola", "Zambia", "Zimbabwe",
    "Botswana", "Namibia", "South Africa", "Lesotho", "Eswatini", "Swaziland",
    "Mozambique", "Malawi", "Tanzania", "Kenya", "Uganda", "Rwanda",
    "Burundi", "Madagascar"
  ],

  "South Asia": [
    "India", "Pakistan", "Bangladesh", "Nepal", "Bhutan",
    "Sri Lanka", "Afghanistan"
  ],

  "East Asia": [
    "China", "Mongolia", "Japan", "South Korea", "North Korea",
    "Taiwan"
  ],

  "North Asia": [
    "Russia",
    "Russian Federation",
    "Russian Fed.",
    "Russian Federation (the)"
  ],

  "Australia": [
    "Australia", "New Zealand"
  ],

  "Arctic Land": [
    "Greenland"
  ]
};

const regionViewBoxes = {
  "Africa": [[-20, -35], [55, 37]],
  "Arctic Land": [[-180, 66.5], [180, 90]],
  "Australia": [[110, -45], [155, -10]],
  "Central America & Caribbean": [[-115, 7], [-60, 24]],
  "East Asia": [[73, 18], [135, 54]],
  "Europe": [[-10, 35], [40, 66.5]],
  "North America": [[-170, 14], [-50, 66.5]],
  "North Asia": [[40, 40], [180, 66.5]],
  "South America": [[-90, -60], [-30, 15]],
  "South Asia": [[60, 5], [100, 35]]
};

// ======================================================
// Load data
// ======================================================

Promise.all([
  d3.csv(DATA_PATH, d3.autoType),
  d3.json("data/world.geojson")
]).then(([modis, world]) => {
  rawData = modis.filter(d =>
    Number.isFinite(d.lat) &&
    Number.isFinite(d.lon) &&
    Number.isFinite(d.lst_C) &&
    Number.isFinite(d.year)
  );

  worldFeatures = world.features;

  prepareGeoRegions(worldFeatures);
  prepareData();

  setupMap(world);
  setupControls();

  drawLegend();
  drawMap();
  drawSmallMultiples();
  drawLineChart();
  updateText();
});

// ======================================================
// Data processing
// ======================================================

function locationKey(d) {
  return `${d.lat},${d.lon}`;
}

function getCountryName(feature) {
  const p = feature.properties;

  return (
    p.ADMIN ||
    p.NAME ||
    p.NAME_EN ||
    p.NAME_LONG ||
    p.SOVEREIGNT ||
    p.BRK_NAME ||
    p.NAME_SORT ||
    p.FORMAL_EN ||
    p.name ||
    p.sovereignt ||
    ""
  );
}

function prepareGeoRegions(features) {
  featureRegionLookup = [];

  features.forEach(feature => {
    const countryName = getCountryName(feature);
    let matchedRegion = "Other";

    for (const [region, countries] of Object.entries(regionCountries)) {
      if (countries.includes(countryName)) {
        matchedRegion = region;
        break;
      }
    }

    featureRegionLookup.push({
      feature,
      countryName,
      region: matchedRegion,
      bounds: d3.geoBounds(feature)
    });
  });
}

function prepareData() {
  dataByYear = d3.group(rawData, d => d.year);

  const baseline = dataByYear.get(2012) || [];
  baseline.forEach(d => {
    baselineByLocation.set(locationKey(d), d.lst_C);
  });

  rawData.forEach(d => {
    const base = baselineByLocation.get(locationKey(d));
    d.change_C = Number.isFinite(base) ? d.lst_C - base : null;
    d.region = assignRegion(d);
  });

  regionalData = Array.from(
    d3.rollup(
      rawData.filter(d => d.region !== "Other"),
      v => d3.mean(v, d => d.lst_C),
      d => d.region,
      d => d.year
    ),
    ([region, yearMap]) => {
      return Array.from(yearMap, ([year, avg]) => ({
        region,
        year,
        avg
      }));
    }
  ).flat();
}

function assignRegion(d) {
  const lon = d.lon;
  const lat = d.lat;
  const point = [lon, lat];

  // Split Asian Russia / Siberia before GeoJSON matching.
  if (lat >= 40 && lat < 66.5 && lon >= 40 && lon <= 180) {
    return "North Asia";
  }

  // Arctic land, including northern Russia and Greenland.
  if (lat >= 66.5) {
    return "Arctic Land";
  }

  for (const item of featureRegionLookup) {
    if (item.region === "Other") continue;

    const [[minLon, minLat], [maxLon, maxLat]] = item.bounds;

    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
      continue;
    }

    if (d3.geoContains(item.feature, point)) {
      return item.region;
    }
  }

  return "Other";
}

// ======================================================
// Map setup
// ======================================================

function setupMap(world) {
  resizeMap();

  projection.fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });
  path.projection(projection);

  overlay.attr("viewBox", `0 0 ${width} ${height}`);

  overlay.append("g")
    .attr("class", "countries")
    .selectAll("path")
    .data(world.features)
    .join("path")
    .attr("class", "country")
    .attr("d", path);

  overlay.append("g")
    .attr("class", "region-layer");

  zoomBehavior = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", event => {
      currentTransform = event.transform;
      overlay.select(".countries").attr("transform", currentTransform);
      overlay.select(".region-layer").attr("transform", currentTransform);
      drawMap();
    });

  overlay.call(zoomBehavior);

  d3.select("#reset-zoom").on("click", () => {
    currentRegion = "All";
    d3.select("#region-select").property("value", "All");

    overlay.transition()
      .duration(500)
      .call(zoomBehavior.transform, d3.zoomIdentity);

    drawMap();
    drawSmallMultiples();
    drawLineChart();
    updateText();
  });

  overlay
    .on("mousemove", handleMouseMove)
    .on("mouseleave", () => tooltip.style("opacity", 0));

  window.addEventListener("resize", () => {
    resizeMap();
    projection.fitExtent([[10, 10], [width - 10, height - 10]], { type: "Sphere" });
    path.projection(projection);
    overlay.attr("viewBox", `0 0 ${width} ${height}`);
    overlay.selectAll(".country").attr("d", path);
    drawMap();
    drawSmallMultiples();
    drawLineChart();
    drawRegionBox();
  });
}

function resizeMap() {
  const rect = mapWrap.getBoundingClientRect();
  width = Math.max(600, Math.floor(rect.width));
  height = Math.floor(width / 2);

  canvas.width = width;
  canvas.height = height;
}

function zoomToRegion(region) {
  if (!zoomBehavior) return;

  if (region === "All" || !regionViewBoxes[region]) {
    overlay.transition()
      .duration(650)
      .call(zoomBehavior.transform, d3.zoomIdentity);
    return;
  }

  const [[lonMin, latMin], [lonMax, latMax]] = regionViewBoxes[region];

  const p1 = projection([lonMin, latMin]);
  const p2 = projection([lonMax, latMax]);

  if (!p1 || !p2) return;

  const x0 = Math.min(p1[0], p2[0]);
  const x1 = Math.max(p1[0], p2[0]);
  const y0 = Math.min(p1[1], p2[1]);
  const y1 = Math.max(p1[1], p2[1]);

  const dx = x1 - x0;
  const dy = y1 - y0;

  const scale = Math.min(6, 0.85 / Math.max(dx / width, dy / height));
  const tx = width / 2 - scale * (x0 + x1) / 2;
  const ty = height / 2 - scale * (y0 + y1) / 2;

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

  overlay.transition()
    .duration(650)
    .call(zoomBehavior.transform, transform);
}

// ======================================================
// Main map drawing
// ======================================================

function drawMap() {
  const yearData = dataByYear.get(currentYear) || [];

  context.save();
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#e9eef2";
  context.fillRect(0, 0, width, height);

  context.translate(currentTransform.x, currentTransform.y);
  context.scale(currentTransform.k, currentTransform.k);

  const radius = currentTransform.k > 3 ? 2.4 : 1.8;

  yearData.forEach(d => {
    if (currentRegion !== "All" && d.region !== currentRegion) {
      context.globalAlpha = 0.04;
    } else {
      context.globalAlpha = 1.0;
    }

    const value = currentMode === "absolute" ? d.lst_C : d.change_C;
    if (!Number.isFinite(value)) return;

    const p = projection([d.lon, d.lat]);
    if (!p) return;

    context.beginPath();
    context.arc(p[0], p[1], radius, 0, 2 * Math.PI);

    if (currentMode === "absolute") {
      context.fillStyle = tempColor(value);
    } else {
      context.fillStyle = Math.abs(value) < 0.5 ? "#eeeeee" : changeColor(value);
    }

    context.fill();
  });

  context.globalAlpha = 1;
  context.restore();

  drawRegionBox();
}

function drawRegionBox() {
  const layer = overlay.select(".region-layer");
  layer.selectAll("*").remove();

  if (currentRegion === "All") return;

  if (currentRegion === "North Asia") {
    const r = {
      latMin: 40,
      latMax: 66.5,
      lonMin: 40,
      lonMax: 180
    };

    const feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [r.lonMin, r.latMin],
          [r.lonMax, r.latMin],
          [r.lonMax, r.latMax],
          [r.lonMin, r.latMax],
          [r.lonMin, r.latMin]
        ]]
      }
    };

    layer.append("path")
      .datum(feature)
      .attr("class", "region-box")
      .attr("d", path);

    return;
  }

  const selectedFeatures = featureRegionLookup
    .filter(d => d.region === currentRegion)
    .map(d => d.feature);

  layer.selectAll("path")
    .data(selectedFeatures)
    .join("path")
    .attr("class", "region-box")
    .attr("d", path);
}

// ======================================================
// Tooltip
// ======================================================

function handleMouseMove(event) {
  const [mx, my] = d3.pointer(event, overlay.node());

  const invX = (mx - currentTransform.x) / currentTransform.k;
  const invY = (my - currentTransform.y) / currentTransform.k;

  const lonLat = projection.invert([invX, invY]);
  if (!lonLat) return;

  const [lon, lat] = lonLat;
  const yearData = dataByYear.get(currentYear) || [];

  let nearest = null;
  let bestDist = Infinity;

  for (const d of yearData) {
    if (currentRegion !== "All" && d.region !== currentRegion) continue;

    const dist = Math.abs(d.lat - lat) + Math.abs(d.lon - lon);

    if (dist < bestDist) {
      bestDist = dist;
      nearest = d;
    }
  }

  if (!nearest || bestDist > 2.5) {
    tooltip.style("opacity", 0);
    return;
  }

  const changeText = Number.isFinite(nearest.change_C)
    ? nearest.change_C >= 0
      ? `${nearest.change_C.toFixed(1)}°C warmer than 2012 at this location`
      : `${Math.abs(nearest.change_C).toFixed(1)}°C cooler than 2012 at this location`
    : "No 2012 comparison available";

  tooltip
    .style("opacity", 1)
    .style("left", event.pageX + 14 + "px")
    .style("top", event.pageY - 28 + "px")
    .html(`
      <strong>${nearest.year} July</strong><br>
      Region: ${nearest.region}<br>
      Location: ${nearest.lat.toFixed(2)}, ${nearest.lon.toFixed(2)}<br>
      Temperature: ${nearest.lst_C.toFixed(1)}°C<br>
      <strong>${changeText}</strong>
    `);
}

// ======================================================
// Legend
// ======================================================

function drawLegend() {
  const legendWidth = 620;
  const legendHeight = 135;

  const svg = d3.select("#legend")
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${legendWidth} ${legendHeight}`)
    .attr("width", "100%")
    .attr("height", 135);

  svg.append("g").attr("class", "legend-body");

  updateLegend();
}

function updateLegend() {
  const svg = d3.select("#legend svg");
  const body = svg.select(".legend-body");
  body.selectAll("*").remove();

  const yearData = dataByYear.get(currentYear) || [];

  if (currentMode === "absolute") {
    drawHistogramLegendAbsolute(body, yearData);
  } else {
    drawHistogramLegendChange(body, yearData);
  }
}

function drawHistogramLegendAbsolute(body, yearData) {
  const x0 = 70;
  const y0 = 68;
  const legendWidth = 460;
  const colorHeight = 16;
  const histHeight = 42;

  const values = yearData
    .map(d => d.lst_C)
    .filter(Number.isFinite);

  const x = d3.scaleLinear()
    .domain([-30, 60])
    .range([x0, x0 + legendWidth]);

  const bins = d3.bin()
    .domain(x.domain())
    .thresholds(30)(values);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length) || 1])
    .range([y0 - 8, y0 - histHeight]);

  // Histogram bars
  body.selectAll(".hist-bar")
    .data(bins)
    .join("rect")
    .attr("class", "hist-bar")
    .attr("x", d => x(d.x0))
    .attr("y", d => y(d.length))
    .attr("width", d => Math.max(1, x(d.x1) - x(d.x0) - 1))
    .attr("height", d => y0 - 8 - y(d.length))
    .attr("fill", "#777")
    .attr("opacity", 0.45);

  // Color gradient
  const defs = d3.select("#legend svg").select("defs").empty()
    ? d3.select("#legend svg").append("defs")
    : d3.select("#legend svg").select("defs");

  defs.selectAll("*").remove();

  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  d3.range(0, 1.01, 0.05).forEach(t => {
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", tempColor(-30 + t * 90));
  });

  body.append("rect")
    .attr("x", x0)
    .attr("y", y0)
    .attr("width", legendWidth)
    .attr("height", colorHeight)
    .attr("fill", "url(#legend-gradient)");

  body.append("g")
    .attr("class", "legend-axis")
    .attr("transform", `translate(0, ${y0 + colorHeight})`)
    .call(d3.axisBottom(x).ticks(7));

  body.append("text")
    .attr("x", x0 + legendWidth / 2)
    .attr("y", 123)
    .attr("text-anchor", "middle")
    .attr("font-size", 13)
    .text("Land surface temperature (°C)");

  body.append("text")
    .attr("x", x0)
    .attr("y", 14)
    .attr("font-size", 12)
    .attr("fill", "#555")
    .text(`Distribution of ${currentYear} July land surface temperatures`);
}

function drawHistogramLegendChange(body, yearData) {
  const x0 = 70;
  const y0 = 68;
  const boxW = 76;
  const colorHeight = 16;
  const histHeight = 42;

  const values = yearData
    .map(d => d.change_C)
    .filter(Number.isFinite);

  const bins = [
    { label: "≤ -5", min: -Infinity, max: -5, color: changeColors[0] },
    { label: "-5 to -2", min: -5, max: -2, color: changeColors[1] },
    { label: "-2 to 0", min: -2, max: 0, color: changeColors[2] },
    { label: "0 to 2", min: 0, max: 2, color: changeColors[3] },
    { label: "2 to 5", min: 2, max: 5, color: changeColors[4] },
    { label: "≥ 5", min: 5, max: Infinity, color: changeColors[5] }
  ];

  bins.forEach(bin => {
    bin.count = values.filter(v => v >= bin.min && v < bin.max).length;
  });

  // Make sure exact high values are counted in final bin
  bins[bins.length - 1].count = values.filter(v => v >= 5).length;

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.count) || 1])
    .range([y0 - 8, y0 - histHeight]);

  // Histogram bars above color bins
  body.selectAll(".hist-bar")
    .data(bins)
    .join("rect")
    .attr("class", "hist-bar")
    .attr("x", (d, i) => x0 + i * boxW)
    .attr("y", d => y(d.count))
    .attr("width", boxW - 2)
    .attr("height", d => y0 - 8 - y(d.count))
    .attr("fill", d => d.color)
    .attr("opacity", 0.75);

  // Color bins
  body.selectAll(".legend-color-bin")
    .data(bins)
    .join("rect")
    .attr("class", "legend-color-bin")
    .attr("x", (d, i) => x0 + i * boxW)
    .attr("y", y0)
    .attr("width", boxW)
    .attr("height", colorHeight)
    .attr("fill", d => d.color);

  // Bin labels
  body.selectAll(".legend-bin-label")
    .data(bins)
    .join("text")
    .attr("class", "legend-bin-label")
    .attr("x", (d, i) => x0 + i * boxW + boxW / 2)
    .attr("y", y0 + 36)
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .text(d => d.label);

  body.append("text")
    .attr("x", x0 + (boxW * bins.length) / 2)
    .attr("y", 123)
    .attr("text-anchor", "middle")
    .attr("font-size", 13)
    .text("Temperature change from 2012 (°C)");

  body.append("text")
    .attr("x", x0)
    .attr("y", 14)
    .attr("font-size", 12)
    .attr("fill", "#555")
    .text(`Distribution of ${currentYear} July temperature changes`);

  body.append("text")
    .attr("x", x0 + boxW * bins.length + 12)
    .attr("y", y0 - histHeight + 8)
    .attr("font-size", 11)
    .attr("fill", "#777")
    .text("More pixels");

  body.append("text")
    .attr("x", x0 + boxW * bins.length + 12)
    .attr("y", y0 - 8)
    .attr("font-size", 11)
    .attr("fill", "#777")
    .text("Fewer pixels");
}

// ======================================================
// Small multiples
// ======================================================

function drawSmallMultiples() {
  const panels = [
    {
      title: "2012 baseline",
      year: 2012,
      mode: "absolute"
    },
    {
      title: `${currentYear} selected year`,
      year: currentYear,
      mode: "absolute"
    },
    {
      title: `${currentYear} change from 2012`,
      year: currentYear,
      mode: "change"
    }
  ];

  const container = d3.select("#small-multiples").html("");

  panels.forEach(panel => {
    const card = container.append("div")
      .attr("class", "small-map-card");

    card.append("div")
      .attr("class", "small-map-title")
      .text(panel.title);

    const smallCanvas = card.append("canvas").node();

    const cardWidth = 520;
    const cardHeight = 260;

    smallCanvas.width = cardWidth;
    smallCanvas.height = cardHeight;

    const smallContext = smallCanvas.getContext("2d");

    const smallProjection = d3.geoEquirectangular()
      .fitExtent([[5, 5], [cardWidth - 5, cardHeight - 5]], { type: "Sphere" });

    const yearData = dataByYear.get(panel.year) || [];

    smallContext.fillStyle = "#e9eef2";
    smallContext.fillRect(0, 0, cardWidth, cardHeight);

    yearData.forEach(d => {
      if (currentRegion !== "All" && d.region !== currentRegion) {
        smallContext.globalAlpha = 0.06;
      } else {
        smallContext.globalAlpha = 0.95;
      }

      const value = panel.mode === "absolute" ? d.lst_C : d.change_C;
      if (!Number.isFinite(value)) return;

      const p = smallProjection([d.lon, d.lat]);
      if (!p) return;

      smallContext.beginPath();
      smallContext.arc(p[0], p[1], 1.05, 0, 2 * Math.PI);

      if (panel.mode === "absolute") {
        smallContext.fillStyle = tempColor(value);
      } else {
        smallContext.fillStyle = Math.abs(value) < 0.5 ? "#eeeeee" : changeColor(value);
      }

      smallContext.fill();
    });

    smallContext.globalAlpha = 1;
  });
}

// ======================================================
// Line chart
// ======================================================

function drawLineChart() {
  const margin = { top: 25, right: 150, bottom: 45, left: 65 };
  const chartWidth = 980;
  const chartHeight = 430;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const svg = d3.select("#line-chart")
    .html("")
    .append("svg")
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

  if (!regionalData.length) {
    svg.append("text")
      .attr("class", "no-data")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .attr("text-anchor", "middle")
      .text("No regional data available.");
    return;
  }

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const regionsList = Array.from(new Set(regionalData.map(d => d.region))).sort();

  const x = d3.scaleLinear()
    .domain(d3.extent(regionalData, d => d.year))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(regionalData, d => d.avg) - 2,
      d3.max(regionalData, d => d.avg) + 2
    ])
    .nice()
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(regionsList)
    .range(d3.schemeTableau10);

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.avg));

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 38)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Average land surface temperature (°C)");

  const byRegion = d3.group(regionalData, d => d.region);

  byRegion.forEach((values, region) => {
    values.sort((a, b) => d3.ascending(a.year, b.year));

    g.append("path")
      .datum(values)
      .attr("class", "line")
      .attr("stroke", color(region))
      .attr("opacity", currentRegion === "All" || currentRegion === region ? 1 : 0.12)
      .attr("d", line);

    g.selectAll(`.point-${safeClass(region)}`)
      .data(values)
      .join("circle")
      .attr("class", "line-point")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.avg))
      .attr("r", 4)
      .attr("fill", color(region))
      .attr("opacity", currentRegion === "All" || currentRegion === region ? 1 : 0.12);
  });

  g.append("line")
    .attr("x1", x(currentYear))
    .attr("x2", x(currentYear))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#222")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "5 4");

  const years = d3.range(2012, 2024);
  const hoverWidth = innerWidth / years.length;

  g.selectAll(".year-hover")
    .data(years)
    .join("rect")
    .attr("class", "year-hover")
    .attr("x", d => x(d) - hoverWidth / 2)
    .attr("y", 0)
    .attr("width", hoverWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mouseenter", (event, year) => {
      currentYear = year;

      d3.select("#year-slider").property("value", currentYear);
      d3.select("#year-label").text(currentYear);

      drawMap();
      drawSmallMultiples();
      updateLegend();
      updateText();
    })
    .on("click", (event, year) => {
      currentYear = year;

      d3.select("#year-slider").property("value", currentYear);
      d3.select("#year-label").text(currentYear);

      drawMap();
      drawSmallMultiples();
      drawLineChart();
      updateText();
    });

  const legend = svg.append("g")
    .attr("transform", `translate(${chartWidth - 135}, ${margin.top})`);

  regionsList.forEach((region, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0, ${i * 22})`);

    row.append("circle")
      .attr("r", 5)
      .attr("fill", color(region));

    row.append("text")
      .attr("x", 12)
      .attr("y", 4)
      .attr("font-size", 12)
      .text(region);
  });
}

function safeClass(s) {
  return s.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

// ======================================================
// Controls
// ======================================================

function setupControls() {
    d3.select("#year-slider").on("input", function () {
        currentYear = +this.value;
        d3.select("#year-label").text(currentYear);

        drawMap();
        drawSmallMultiples();
        drawLineChart();
        updateLegend();
        updateText();
    });

  d3.select("#mode-select").on("change", function () {
    currentMode = this.value;

    drawMap();
    drawSmallMultiples();
    updateLegend();
    updateText();
  });

  d3.select("#region-select").on("change", function () {
    currentRegion = this.value;

    zoomToRegion(currentRegion);
    drawMap();
    drawSmallMultiples();
    drawLineChart();
    updateText();
  });

  d3.select("#play-button").on("click", function () {
  const button = d3.select(this);

  if (isPlaying) {
    clearInterval(playTimer);
    playTimer = null;
    isPlaying = false;

    button.text("▶")
      .attr("aria-label", "Start animation")
      .attr("title", "Start animation");

    return;
  }

  isPlaying = true;

  button.text("⏸")
    .attr("aria-label", "Pause animation")
    .attr("title", "Pause animation");

  playTimer = setInterval(() => {
    currentYear = currentYear >= 2023 ? 2012 : currentYear + 1;

    d3.select("#year-slider").property("value", currentYear);
    d3.select("#year-label").text(currentYear);

    drawMap();
    drawSmallMultiples();
    drawLineChart();
    updateLegend();
    updateText();
  }, 900);
});
}

// ======================================================
// Narrative text
// ======================================================

function updateText() {
  const modeText = currentMode === "absolute"
    ? `July Land Surface Temperature, ${currentYear}`
    : `Change in July Land Surface Temperature Since 2012, ${currentYear}`;

  d3.select("#map-title").text(modeText);

  const caption = currentMode === "absolute"
    ? "Warmer colors show hotter land surface temperatures. Use the slider, play button, or line chart hover to compare years."
    : "Colors are binned: red areas are warmer than they were in 2012, while blue areas are cooler.";

  d3.select("#map-caption").text(caption);

  let regionText;

  if (currentRegion === "All") {
    regionText =
      "The change view highlights where July land surface temperatures shifted most compared with 2012, instead of only showing already-hot regions.";
  } else {
    const selected = regionalData.filter(d => d.region === currentRegion);
    const y2012 = selected.find(d => d.year === 2012);
    const yNow = selected.find(d => d.year === currentYear);

    if (y2012 && yNow) {
      const diff = yNow.avg - y2012.avg;
      const direction = diff >= 0 ? "warmer" : "cooler";

      regionText =
        `${currentRegion} is about ${Math.abs(diff).toFixed(1)}°C ${direction} in July ${currentYear} compared with July 2012 based on the regional average.`;
    } else {
      regionText =
        `No regional average is available for ${currentRegion} in ${currentYear}.`;
    }
  }

  d3.select("#takeaway-text").text(regionText);
}