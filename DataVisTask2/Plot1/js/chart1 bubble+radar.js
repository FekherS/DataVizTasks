const width = 500;
const height = 500;
const margin = 1;
const radius = 500;

const ease = d3.easeCubic;
const colors = d3.schemeCategory10.slice(0, 6);

let radarAxesAngle;
let chart1, chart4;
let data, fullData;
let tooltip = d3.select("#tooltip");
let slider, yearLabel, playBtn, pauseBtn, nodesGroup;
let intervalId = null;
let legendContainer, countryColorMap, legend;

let radarData = [];
const dimensions = ['Launch Mass (kg.)', 'Dry Mass (kg.)', 'Power (watts)', 'Expected Lifetime (yrs.)'];
const domain = {};

export default function initChart1(_data) {
    fullData = _data;
    configureData(_data);
    configureChart();
    createCountryColorMap();
    updateChart();
    initChart4();
}

function configureData(_data) {
    data = _data.map(d => {
        const [day, month, year] = d["Date of Launch"].split(' ')[0].split('/').map(Number);
        const countryStr = d["Country of Operator/Owner"] || "";
        const countries = countryStr.split('/').map(c => c.trim()).filter(Boolean);
        return {
            name: d["Operator/Owner"],
            country: countries[0] || "Unknown",
            year: new Date(year, month - 1, day).getFullYear()
        };
    });

    dimensions.forEach(dim => {
        const values = fullData.map(d => +d[dim]).filter(v => !isNaN(v));
        domain[dim] = [d3.min(values), d3.max(values) / 2];
    });
}

function createCountryColorMap() {
    const uniqueCountries = [...new Set(data.map(d => d.country))];
    const colorScale = d3.scaleSequential()
        .domain([0, uniqueCountries.length])
        .interpolator(d3.interpolateRainbow);

    countryColorMap = new Map();
    uniqueCountries.forEach((country, i) => {
        countryColorMap.set(country, colorScale(i));
    });

    drawLegend();
}

function drawLegend() {
    d3.select("#legend").remove();

    d3.select("#chart1").append("div")
        .attr("id", "legend")
        .style("max-height", "400px")
        .style("overflow-y", "auto")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("width", "200px")
        .style("font", "12px sans-serif");

    const legend = d3.select("#legend").append("div")
        .attr("class", "legend-grid")
        .style("display", "flex")
        .style("flex-direction", "column");

    countryColorMap.forEach((color, country) => {
        const item = legend.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin-bottom", "5px");

        item.append("span")
            .style("display", "inline-block")
            .style("width", "15px")
            .style("height", "15px")
            .style("background-color", color)
            .style("margin-right", "5px");

        item.append("span").text(country);
    });
}

function configureChart() {
    const container = d3.select("#chart1");
    const controls = container.append("div").attr("class", "controls");

    slider = controls.append("input")
        .attr("type", "range")
        .attr("min", 1974)
        .attr("max", 2023)
        .attr("value", 2023)
        .attr("step", 1);

    slider.on("input", () => {
        const year = +slider.property("value");
        yearLabel.text(year);
        updateChart(year);
        if (intervalId) stopPlaying();
    });

    yearLabel = controls.append("span").attr("id", "yearLabel").text("2023");

    playBtn = controls.append("button")
        .attr("id", "playBtn").text("Play")
        .on("click", startPlaying);

    pauseBtn = controls.append("button")
        .attr("id", "pauseBtn").text("Pause")
        .attr("disabled", true)
        .on("click", stopPlaying);

    chart1 = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
        .attr("text-anchor", "middle");

    nodesGroup = chart1.append("g").attr("class", "nodes");
}

function updateChart(filterYear = 2023) {
    const filteredData = data.filter(d => d.year <= filterYear);
    const countMap = new Map();

    filteredData.forEach(d => {
        const key = `${d.name}|${d.country}`;
        countMap.set(key, (countMap.get(key) || 0) + 1);
    });

    const dataArray = Array.from(countMap, ([key, value]) => {
        const [name, country] = key.split('|');
        return { name, country, value };
    }).sort((a, b) => d3.ascending(a.name, b.name));

    const pack = d3.pack()
        .size([width - margin * 2, height - margin * 2])
        .padding(3);

    const root = pack(d3.hierarchy({ children: dataArray }).sum(d => d.value));
    const nodes = nodesGroup.selectAll("g.node")
        .data(root.leaves(), d => d.data.name + d.data.country);

    const nodesEnter = nodes.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("opacity", 0);

    nodesEnter.append("circle")
        .attr("fill-opacity", 0.7)
        .attr("fill", d => countryColorMap.get(d.data.country))
        .attr("r", 0);

    nodesEnter.append("text")
        .attr("dy", "-0.2em")
        .attr("text-anchor", "middle")
        .attr("fill", "white");

    nodes.merge(nodesEnter).transition().duration(750).ease(ease)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("opacity", 1);

    nodes.merge(nodesEnter).select("circle").attr("r", d => d.r);

    nodes.merge(nodesEnter).select("text")
        .each(function(d) {
            const text = d3.select(this);
            text.selectAll("tspan").remove();
            text.append("tspan").text(d.data.name).attr("x", 0).attr("dy", 0);
            text.append("tspan").text(d.data.value).attr("x", 0).attr("dy", "1.2em");
        })
        .style("font-size", d => `${Math.min(2 * d.r / Math.max(1, d.data.name.length), 12)}px`);

    nodes.exit().transition().duration(500).ease(ease).attr("opacity", 0).remove();

    nodesEnter.merge(nodes)
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1)
                .html(`${d.data.name} (${d.data.country}) : ${d.data.value}`)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mousemove", event => {
            tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (e, d) => {
            if (!colors.length) return;

            const name = d.data.name;
            const year = +slider.property("value");
            if (radarData.find(ele => ele.name === name && ele.year === year)) return;

            const relevant = fullData.filter(row =>
                row["Operator/Owner"] === name &&
                new Date(row["Date of Launch"].split(' ')[0].split('/').reverse().join('/')).getFullYear() <= year
            );

            const avg = {};
            dimensions.forEach(dim => {
                const values = relevant.map(row => +row[dim]).filter(v => !isNaN(v));
                avg[dim] = values.length ? d3.mean(values) : 0;
            });

            radarData.push({ name, year, avg, color: colors.pop() });
            renderRadarChart();
        });
}

function stopPlaying() {
    playBtn.property("disabled", false);
    pauseBtn.property("disabled", true);
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function startPlaying() {
    playBtn.property("disabled", true);
    pauseBtn.property("disabled", false);
    intervalId = setInterval(() => {
        const currentYear = +slider.property("value");
        if (currentYear >= +slider.attr("max")) {
            stopPlaying();
            return;
        }
        slider.property("value", currentYear + 1);
        yearLabel.text(currentYear + 1);
        updateChart(currentYear + 1);
    }, 1000);
}

function initChart4() {
    radarAxesAngle = Math.PI * 2 / dimensions.length;

    const radarChartRadius = 200;
    const axisRadius = d3.scaleLinear().domain([0, 1]).range([0, radarChartRadius]);

    chart4 = d3.select("#chart4")
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

    const maxAxisRadius = 1;
    const textRadius = 1.1;
    const gridCount = 6;

    chart4.selectAll(".axis")
        .data(dimensions).enter().append("g").attr("class", "axis")
        .append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", (d, i) => radarX(axisRadius(maxAxisRadius), i))
        .attr("y2", (d, i) => radarY(axisRadius(maxAxisRadius), i))
        .style("stroke", "black");

    chart4.selectAll(".axisLabel")
        .data(dimensions).enter().append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", (d, i) => radarX(axisRadius(textRadius), i))
        .attr("y", (d, i) => radarY(axisRadius(textRadius), i))
        .text(d => d);

    for (let j = 1; j <= gridCount; ++j) {
        const gridRadius = axisRadius(maxAxisRadius * j / gridCount);
        const points = dimensions.map((_, i) => [radarX(gridRadius, i), radarY(gridRadius, i)]);
        points.push(points[0]);

        chart4.append("path")
            .datum(points)
            .attr("d", d3.line()(points))
            .style("stroke", "grey").style("fill", "none");
    }

    legendContainer = d3.select("#chart4").append("div")
        .attr("id", "radar-legend")
        .style("margin-top", "20px")
        .style("border", "1px solid #ccc")
        .style("padding", "10px")
        .style("width", "250px")
        .style("font", "12px sans-serif");

    legendContainer.append("p").text("Radar Legend");
    legend = legendContainer.append("div");
}

function radarX(radius, index) {
    return radius * Math.cos(radarAngle(index));
}

function radarY(radius, index) {
    return radius * Math.sin(radarAngle(index));
}

function radarAngle(index) {
    return radarAxesAngle * index - Math.PI / 2;
}

function renderRadarChart() {
    const legendItem = legend.selectAll(".legend-item")
        .data(radarData, d => d.color);

    legendItem.exit().remove();

    const enter = legendItem.enter().append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "10px");

    enter.append("button").attr("class", "close").text("X").on("click", handleRemovalRadar);
    enter.append("div")
        .style("width", "15px").style("height", "15px")
        .style("background-color", d => d.color);
    enter.append("p").text(d => `${d.year} ${d.name}`);

    const radarItem = chart4.selectAll(".radar-item")
        .data(radarData, d => d.color);

    radarItem.exit().remove();

    const newRadar = radarItem.enter().append("g").attr("class", "radar-item");

    newRadar.append("polyline")
        .attr("points", d => {
            const points = dimensions.map((dim, i) => {
                const scale = d3.scaleLinear().domain(domain[dim]).range([0, 200]);
                const r = scale(d.avg[dim]);
                return [radarX(r, i), radarY(r, i)];
            });
            points.push(points[0]);
            return points.map(p => p.join(",")).join(" ");
        })
        .attr("stroke", d => d.color)
        .attr("fill", d => d.color)
        .attr("fill-opacity", 0.1)
        .attr("stroke-width", 2);

    newRadar.selectAll(".radar-point")
        .data(d => dimensions.map((dim, i) => {
            const scale = d3.scaleLinear().domain(domain[dim]).range([0, 200]);
            const r = scale(d.avg[dim]);
            return { x: radarX(r, i), y: radarY(r, i), color: d.color };
        }))
        .enter().append("circle")
        .attr("class", "radar-point")
        .attr("cx", d => d.x).attr("cy", d => d.y)
        .attr("r", 3).attr("fill", d => d.color);
}

function handleRemovalRadar(e, d) {
    radarData = radarData.filter(x => x.color !== d.color);
    colors.push(d.color);
    renderRadarChart();
}
