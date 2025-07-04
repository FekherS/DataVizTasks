const width = 500;
const height = 500;
const margin = 1;

let chart1;
let data;
let tooltip = d3.select("#tooltip");
let slider;
let yearLabel;
let playBtn;
let pauseBtn;
let nodesGroup;
const ease = d3.easeCubic;
let intervalId = null;

let countryColorMap;

export default function initChart1(_data) {
	configureData(_data);
	configureChart();
	createCountryColorMap();
	updateChart();
}

function configureData(_data) {
	data = _data.map(d => {
		const dateStr = d["Date of Launch"];
		const [day, month, year] = dateStr.split(' ')[0].split('/').map(Number);

		let countryStr = d["Country of Operator/Owner"] || "";
		let countries = countryStr.split('/');
		countries = countries.map(c => c.trim()).filter(c => c.length > 0);
		let mainCountry = countries[0] || "Unknown";

		return {
			name: d["Operator/Owner"],
			country: mainCountry,
			year: new Date(year, month - 1, day).getFullYear()
		};
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
	// Remove existing legend if any
	d3.select("#legend").remove();

	// Append legend container dynamically
	d3.select("body")
		.append("div")
		.attr("id", "legend")
		.style("max-height", "400px")
		.style("overflow-y", "auto")
		.style("border", "1px solid #ccc")
		.style("padding", "10px")
		.style("width", "200px")
		.style("font", "12px sans-serif");

	const legend = d3.select("#legend")
		.append("div")
		.attr("class", "legend-grid")
		.style("display", "flex")
		.style("flex-direction", "column");

	[...countryColorMap.keys()].forEach(country => {
		const item = legend.append("div")
			.style("display", "flex")
			.style("align-items", "center")
			.style("margin-bottom", "5px");

		item.append("span")
			.style("display", "inline-block")
			.style("width", "15px")
			.style("height", "15px")
			.style("background-color", countryColorMap.get(country))
			.style("margin-right", "5px");

		item.append("span")
			.text(country);
	});
}

function configureChart() {
	const container = d3.select("#chart1");

	const controls = container.append("div")
		.attr("class", "controls");

	slider = controls.append("input")
		.attr("type", "range")
		.attr("id", "yearSlider")
		.attr("min", 1974)
		.attr("max", 2023)
		.attr("value", 1974)
		.attr("step", 1);

	slider.on("input", () => {
		const year = +slider.property("value");
		yearLabel.text(year);
		updateChart(year);
		if (intervalId !== null) stopPlaying();
	});

	yearLabel = controls.append("span")
		.attr("id", "yearLabel")
		.text("1974");

	playBtn = controls.append("button")
		.attr("id", "playBtn")
		.text("Play")
		.on("click", startPlaying);

	pauseBtn = controls.append("button")
		.attr("id", "pauseBtn")
		.attr("disabled", true)
		.text("Pause")
		.on("click", stopPlaying);

	chart1 = container.append("svg")
		.attr("width", width)
		.attr("height", height)
		.attr("viewBox", [0, 0, width, height])
		.attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
		.attr("text-anchor", "middle");

	nodesGroup = chart1.append("g").attr("class", "nodes");
}

function updateChart(filterYear = 1974) {
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

	nodes.merge(nodesEnter)
		.transition()
		.duration(750)
		.ease(ease)
		.attr("transform", d => `translate(${d.x},${d.y})`)
		.attr("opacity", 1)
		.select("circle")
		.attr("r", d => d.r);

	nodes.merge(nodesEnter).select("text")
		.each(function(d) {
			const text = d3.select(this);
			text.selectAll("tspan").remove();
			text.append("tspan")
				.text(d.data.name)
				.attr("x", 0)
				.attr("dy", 0);
			text.append("tspan")
				.text(d.data.value)
				.attr("x", 0)
				.attr("dy", "1.2em");
		})
		.style("font-size", d => `${Math.min(2 * d.r / Math.max(1, d.data.name.length), 12)}px`);

	nodes.exit()
		.transition()
		.duration(500)
		.ease(ease)
		.attr("opacity", 0)
		.remove();

	nodesEnter.merge(nodes)
		.on("mouseover", (event, d) => {
			tooltip.style("opacity", 1)
				.html(`${d.data.name} (${d.data.country}) : ${d.data.value}`)
				.style("left", (event.pageX + 10) + "px")
				.style("top", (event.pageY + 10) + "px");
		})
		.on("mousemove", (event) => {
			tooltip.style("left", (event.pageX + 10) + "px")
				.style("top", (event.pageY + 10) + "px");
		})
		.on("mouseout", () => {
			tooltip.style("opacity", 0);
		});
}

function stopPlaying() {
	playBtn.property("disabled", false);
	pauseBtn.property("disabled", true);
	if (intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
}

function startPlaying() {
	playBtn.property("disabled", true);
	pauseBtn.property("disabled", false);
	intervalId = setInterval(() => {
		let currentYear = +slider.property("value");
		if (currentYear >= +slider.attr("max")) {
			stopPlaying();
			return;
		}
		slider.property("value", currentYear + 1);
		yearLabel.text(currentYear + 1);
		updateChart(currentYear + 1);
	}, 1000);
}
