import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const width = 600;
const height = 600;
const ease = d3.easeCubic;

const colors = d3.schemeCategory10.slice();
let colorMap = new Map();

const dimensions = ['longitude_of_geo_degrees','perigee_km','apogee_km','eccentricity','inclination_degrees','period_minutes','launch_mass_kg' ];
const domain = {};
const radarRadius = 200;

let radarAxesAngle = Math.PI * 2 / dimensions.length;
let radarData = [];

let countryCoords = new Map();
let nameToAlpha3 = new Map();

let bubbleSvg, mapSvg, radarSvg;
let bubbleGroup, mapGroup;
let slider, yearLabel;

let tooltip = d3.select("#tooltip");
let radarLegend;

let fullData = [];

d3.csv('./country_codes_simple_cleaned.csv').then(mapping => {
    mapping.forEach(d => {
        nameToAlpha3.set(d.name, d.alpha3);
        countryCoords.set(d.alpha3, { lat: +d.latitude, lon: +d.longitude });
    });

    d3.csv('./UCSDB.csv').then(data => {
        
        init(data);
    });
});

function init(data) {
    fullData = data.map(d => ({
        satellite_name: d.satellite_name,
        operator_country: d.operator_country,
        owner: d.owner,
        date_of_launch: new Date(d.date_of_launch),
        launch_mass_kg: +d.launch_mass_kg,
        expected_lifetime_yrs: +d.expected_lifetime_yrs
    }));

    dimensions.forEach(dim => {
        const vals = fullData.map(d => d[dim]).filter(v => !isNaN(v));
        domain[dim] = [d3.min(vals), d3.max(vals)];
    });

    createColorMap();
    createControls();
    createCharts();
    updateCharts();
}

function createColorMap() {
    const countries = [...new Set(fullData.map(d => d.operator_country))];
    const scale = d3.scaleSequential().domain([0, countries.length]).interpolator(d3.interpolateRainbow);
    countries.forEach((c, i) => colorMap.set(c, scale(i)));
}

function createControls() {
    slider = d3.select("#controls").append("input")
        .attr("type", "range")
        .attr("min", 1970)
        .attr("max", 2025)
        .attr("value", 2025)
        .on("input", () => {
            yearLabel.text(slider.property("value"));
            updateCharts(+slider.property("value"));
        });

    yearLabel = d3.select("#controls").append("span").text("2025");
}

function createCharts() {
    bubbleSvg = d3.select("#chart1").append("svg").attr("width", width).attr("height", height);
    bubbleGroup = bubbleSvg.append("g");

    mapSvg = d3.select("#chart2").append("svg").attr("width", width).attr("height", height);
    mapGroup = mapSvg.append("g");

    radarSvg = d3.select("#chart3").append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${width/2},${height/2})`);

    drawRadarBase();
    radarLegend = d3.select("#chart3").append("div").attr("id", "radar-legend");
}

function updateCharts(year = 2023) {
    const filtered = fullData.filter(d => d.date_of_launch.getFullYear() <= year);
    updateBubbleChart(filtered);
    updateMapChart(filtered);
    renderRadarChart();
}

function updateBubbleChart(data) {
    const grouped = d3.rollups(data, v => v.length, d => d.owner)
        .map(([owner, count]) => ({ owner, count }));

    const pack = d3.pack()
        .size([width, height])
        .padding(5);

    const root = d3.hierarchy({ children: grouped }).sum(d => d.count);
    const nodes = pack(root).leaves();

    const sel = bubbleGroup.selectAll("g").data(nodes, d => d.data.owner);

    const enter = sel.enter().append("g")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .on("click", (e, d) => addToRadar(d.data.owner));

    enter.append("circle").attr("r", 0)
        .attr("fill", d => colorMap.get(d.data.owner) || "grey");

    enter.append("text")
        .text(d => d.data.owner)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .style("font-size", "10px");

    sel.merge(enter).select("circle")
        .transition().ease(ease).duration(500)
        .attr("r", d => d.r);

    sel.merge(enter)
        .transition().ease(ease).duration(500)
        .attr("transform", d => `translate(${d.x},${d.y})`);

    sel.exit().remove();
}

function updateMapChart(data) {
    const grouped = d3.rollups(data, v => v.length, d => d.operator_country)
        .map(([country, count]) => ({ country, count }));

    const points = grouped.map(d => {
        const iso = nameToAlpha3.get(d.country) || "UNK";
        const coords = countryCoords.get(iso);
        if (!coords) return null;
        return {
            country: d.country,
            count: d.count,
            x: ((coords.lon + 180) / 360) * width,
            y: height - ((coords.lat + 90) / 180) * height
        };
    }).filter(Boolean);

    const sel = mapGroup.selectAll("circle").data(points, d => d.country);

    const enter = sel.enter().append("circle")
        .attr("r", 0)
        .attr("fill", d => colorMap.get(d.country) || "grey")
        .on("click", (e, d) => addToRadar(d.country));

    sel.merge(enter)
        .transition().ease(ease).duration(500)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => Math.sqrt(d.count));

    sel.exit().remove();
}

function drawRadarBase() {
    dimensions.forEach((dim, i) => {
        radarSvg.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", radarX(1, i)).attr("y2", radarY(1, i))
            .attr("stroke", "black");

        radarSvg.append("text")
            .attr("x", radarX(1.1, i)).attr("y", radarY(1.1, i))
            .text(dim)
            .attr("text-anchor", "middle");
    });

    for (let i = 0; i < 5; i++) {
        const r = (i + 1) / 5 * radarRadius;
        const points = dimensions.map((_, j) => [radarX(r, j), radarY(r, j)]);
        points.push(points[0]);
        radarSvg.append("path")
            .attr("d", d3.line()(points))
            .attr("stroke", "grey")
            .attr("fill", "none");
    }
}

function radarX(r, i) {
    return r * Math.cos(radarAxesAngle * i - Math.PI/2);
}

function radarY(r, i) {
    return r * Math.sin(radarAxesAngle * i - Math.PI/2);
}

function addToRadar(name) {
    if (radarData.find(d => d.name === name)) return;

    const color = colors.pop();
    const relevant = fullData.filter(d => d.owner === name || d.operator_country === name);

    const avg = {};
    dimensions.forEach(dim => {
        const vals = relevant.map(d => d[dim]).filter(v => !isNaN(v));
        avg[dim] = vals.length ? d3.mean(vals) : 0;
    });

    radarData.push({ name, avg, color });
    renderRadarChart();
}

function renderRadarChart() {
    radarSvg.selectAll(".radar-item").remove();

    radarData.forEach(d => {
        const points = dimensions.map((dim, i) => {
            const scale = d3.scaleLinear().domain(domain[dim]).range([0, radarRadius]);
            const r = scale(d.avg[dim]);
            return [radarX(r, i), radarY(r, i)];
        });
        points.push(points[0]);

        radarSvg.append("path")
            .datum(points)
            .attr("class", "radar-item")
            .attr("d", d3.line())
            .attr("stroke", d.color)
            .attr("fill", d.color)
            .attr("fill-opacity", 0.1)
            .attr("stroke-width", 2);
    });

    const items = radarLegend.selectAll("div").data(radarData, d => d.name);

    const enter = items.enter().append("div");
    enter.append("span").text(d => d.name);
    enter.append("button").text("Remove").on("click", (e, d) => removeRadarItem(d));

    items.exit().remove();
}

function removeRadarItem(d) {
    radarData = radarData.filter(x => x.name !== d.name);
    colors.push(d.color);
    renderRadarChart();
}
