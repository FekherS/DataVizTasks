let chart1, chart2, chart3;
let colorScale1;
let tooltipDash; 
let minYear = 1974, maxYear = 2023;
let chart1Children, chart1Data = Array.from({length: maxYear - minYear + 1}, () => new Map());
const owners = new Map();

let countriesISO = new Map(), chart2Data = Array.from({length: maxYear - minYear + 1}, () => new Map());

const dimensionsChart3 = ["perigee_km", "apogee_km", "inclination_degrees", "period_minutes", "launch_mass_kg", "expected_lifetime_yrs"];
let colorsChart3 = d3.schemeCategory10.slice(0,6), chart3Data = [], chart3Domain ={};
let chart3AxesAngle = Math.PI * 2 / dimensionsChart3.length;
let chart3Axes;
let chart3Legend;
let chart3FullData;

let hoveredCountry = null;

function createChart123(data) {
	chart1 = d3.select("#chart1").append("svg")
		.attr("width", width)
		.attr("height", height);

	chart2 = d3.select("#chart2").append("svg")
		.attr("width", width*2)
		.attr("height", height)

	chart3 = d3.select("#chart3").append("svg")
	chart3FullData = data;

	const operator_country = Array.from(new Set(data.map(d => d.operator_country)));
	colorScale1 = d3.scaleOrdinal()
		.domain(operator_country)
		.range(operator_country.map((d, i) => d3.interpolateRainbow(i / operator_country.length)));

	initChart1(data);
	initChart2(data);
	initChart3(data);
	initControls(data);
}

function initControls() {
	tooltipDash = d3.select("#tooltipDash");
	const ctrl = d3.select('#controls');

	// Year slider
	const slider = ctrl.append('input')
		.attr('type', 'range')
		.attr('min', minYear)
		.attr('max', maxYear)
		.attr('value', maxYear)
		.attr('step', 1)
		.on('input', function () {
			d3.select('#yearLabel').text(this.value);
			updateChart1(+this.value);
			updateChart2(+this.value);
		});

	ctrl.append('span')
		.attr('id', 'yearLabel')
		.text(maxYear);

	// Play/Pause button
	let playing = false;
	let interval = null;

	const button = ctrl.append('button')
		.text('Play')
		.on('click', function () {
			playing = !playing;
			if (playing) {
				d3.select(this).text('Pause');
				interval = d3.interval(() => {
					let currentYear = +slider.property('value');
					if (currentYear < maxYear) {
						currentYear++;
					} else {
						currentYear = minYear;
					}
					slider.property('value', currentYear);
					d3.select('#yearLabel').text(currentYear);
					updateChart1(currentYear);
					updateChart2(currentYear);
				}, 1000); // interval in ms
			} else {
				d3.select(this).text('Play');
				if (interval) interval.stop();
			}
		});
}

function initChart1(data) {
	//set up the data.
	data.forEach(d => {
		if (!owners.has(d.owner)) {
			owners.set(d.owner, d.operator_country);
		}
	});
	owners.forEach((country, owner) => {
		for (const m of chart1Data) {
			m.set(owner, 0);
		}
	});
	data.forEach(d => {
		for (let i = (+d.date_of_launch - minYear); i <= (maxYear - minYear); ++i) {
			chart1Data[i].set(d.owner, chart1Data[i].get(d.owner) + 1);
		}
	});	
	chart1Children = Array.from(owners.entries()).map(([owner, country]) => ({
		owner,
		country
	}));
	chart1.append("g");
	updateChart1(maxYear);

}

function updateChart1(selectedYear) {
	const yearIndex = selectedYear - minYear;
	const pack = d3.pack()
		.size([width - margin.top * 2, height - margin.top * 2])
		.padding(3);
	const root = pack(
		d3.hierarchy({ children: chart1Children })
			.sum(d => chart1Data[yearIndex].get(d.owner))
			.sort((a, b) => a.owner - b.owner)
	);
	const circles = chart1.select("g")
		.selectAll("circle")
		.data(root.leaves(), d => d.data.owner);
	
	const joinedCircles = circles.join("circle")
		.attr("fill", d => {
			// colorScale1(owners.get(d.data.owner))
			if (!hoveredCountry || hoveredCountry === d.data.country) {
				return colorScale1(d.data.country);
			}
			return "gray"
		}); // static props first

	// Apply transition separately
	joinedCircles.transition().duration(750)
	.attr("cx", d => d.x)
	.attr("cy", d => d.y)
	.attr("r", d => d.r);

	// Attach events to the joined selection (not the transition)
	joinedCircles
	.on("mouseover", (event, d) => {
		const value = chart1Data[yearIndex].get(d.data.owner);
		tooltipDash.style("opacity", 1)
		.html(`<strong>${d.data.owner}</strong><br/>Country: ${d.data.country}<br/>Value: ${value}`)
		.style("left", (event.pageX + 10) + "px")
		.style("top", (event.pageY + 10) + "px");
	})
	.on("mouseout", () => {
		tooltipDash.style("opacity", 0);
	})
	.on("click", (e, d) => {
		if (!colorsChart3.length) return;
		const result = chart3Data.find(elem => elem.owner === d.data.owner && elem.year === yearIndex);
		if (result) return;
		chart3Data.push({ owner: d.data.owner, year: yearIndex, color: colorsChart3.pop() });
		updateChart3();
	});

	
	const texts = chart1.select("g")
		.selectAll("text")
		.data(root.leaves(), d => d.data.owner);
	texts.join("text")
		.transition().duration(750)
		.attr("x", d => d.x)
		.attr("y", d => d.y)
		.attr("text-anchor", "middle")
		.attr("dy", "0.35em")
		.style("font-size", d => Math.min(3.5 * d.r / d.data.owner.length, 14) + "px")
		.style("fill", d => {
			// Use same logic as circles
			const circleFill = (!hoveredCountry || hoveredCountry === owners.get(d.data.owner))
				? colorScale1(owners.get(d.data.owner))
				: "gray";
			return getReadableTextColor(circleFill);
		})
		.text(d => d.data.owner);

	texts.on("mouseover", (event, d) => {
			const value = chart1Data[yearIndex].get(d.data.owner);
			tooltipDash.style("opacity", 1)
				.html(`<strong>${d.data.owner}</strong><br/>Country: ${d.data.country}<br/>Value: ${value}`)
				.style("left", (event.pageX + 10) + "px")
				.style("top", (event.pageY + 10) + "px");
		})
		.on("mouseout", () => {
			tooltipDash.style("opacity", 0);
	});
}
function getReadableTextColor(fillColor) {
	// Use d3.color to parse the fill color
	const c = d3.color(fillColor);
	if (!c) return "#000"; // fallback to black

	// Calculate relative luminance
	const r = c.r / 255;
	const g = c.g / 255;
	const b = c.b / 255;

	const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

	return luminance > 0.5 ? "#000" : "#fff";
}

async function initChart2(data) {
	data.forEach(d => {
		if (d.operator_iso_num && !countriesISO.has(d.operator_iso_num) ) {
			countriesISO.set(+d.operator_iso_num, d.operator_country);
		}

	});
	countriesISO.forEach((country, iso) => {
		for (const m of chart2Data) {
			m.set(country, 0);
		}
	});
	data.forEach(d => {
		for (let i = (+d.date_of_launch - minYear); i <= (maxYear - minYear); ++i) {
			chart2Data[i].set(d.operator_country, chart2Data[i].get(d.operator_country) + 1);
		}
	})	
	const projection = d3.geoNaturalEarth1()
		.fitSize([width * 2, height ], { type: 'Sphere' });
	const pathGen = d3.geoPath().projection(projection);

	try {
		const topo = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');

		const countries = topojson
			.feature(topo, topo.objects.countries)
			.features;

		chart2.append('g')
			.attr('class', 'countries')
			.selectAll('path')
			.data(countries)
			.join('path')
			.attr('d', pathGen)
			.attr('stroke', '#999')
			.attr('fill', '#eee')
			.on('mouseover', (event, d) => {
				const val = countriesISO.get(+d.id);
				const yearStr = d3.select('#yearLabel').text();
				const yearNum = +yearStr;

				if (val && chart2Data[yearNum - minYear].get(val)) {	
					tooltipDash
						.style('opacity', 1)
						.html(`<strong>${val}</strong><br/>Value: ${chart2Data[yearNum - minYear].get(val)}`)
						.style('left', (event.pageX + 10) + 'px')
						.style('top', (event.pageY + 10) + 'px');
				}
			})
			.on('mouseout', () => {
				tooltipDash.style('opacity', 0);
			})
			.on('click', (event, d) => {
				const val = countriesISO.get(+d.id);
				const yearStr = d3.select('#yearLabel').text();
				const yearNum = +yearStr;

				if (hoveredCountry === val) {
					hoveredCountry = null;
				} else {
					hoveredCountry = val;
				}

				console.log(hoveredCountry);
				updateChart1(yearNum);
			});

		updateChart2(maxYear);
	} catch (error) {
		console.error('Error loading or processing TopoJSON:', error);
	}
}

function updateChart2(year) {
	let index = year - minYear;
	chart2.selectAll('g.countries path')
		.transition().duration(750)
		.attr('fill', d => {
			const val = countriesISO.get(+d.id);
			return (val != null && chart2Data[index].get(val))? colorScale1(val) : '#eee';
		});
}

// Initialize parallel‐coords + empty legend container
function initChart3(data) {
	// 1) compute full domains
	dimensionsChart3.forEach(dim => {
		chart3Domain[dim] = [
			d3.min(data, d => +d[dim]),
			d3.max(data, d => +d[dim])
		];
	});

	// 2) clear previous visuals
	d3.select("#chart3-legend").selectAll("*").remove();

	// 3) build legend container
	chart3Legend = d3.select("#chart3-legend")
		.append("div");
	chart3Legend.append("h3").text("Legend");



	// 5) SVG group
	const g = chart3
		.attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
		.attr("width", width)
		.attr("height", height)
	 .append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);

	// 6) scales
	const x = d3.scalePoint()
		.domain(dimensionsChart3)
		.range([0, width]);

	const y = {};
	dimensionsChart3.forEach(dim => {
		y[dim] = d3.scaleLinear()
			.domain(chart3Domain[dim])
			.range([height, 0]);
	});

	// 7) line‐generator
	function path(d) {
		return d3.line()(dimensionsChart3.map(dim => [ x(dim), y[dim](d[dim]) ]));
	}


	// 9) colored foreground lines
	g.append("g").attr("class", "foreground")
		.selectAll("path")
		.data(data, d => d.color)
		.enter().append("path")
			.attr("class", "pc-line")
			.attr("d", path)
			.attr("stroke-width", 1.5)
			.attr("stroke-opacity", 0.7)
			.attr("fill", "none")
			.attr("stroke", d => d.color);

	// 10) axes
	const axisG = g.selectAll(".dimension")
		.data(dimensionsChart3)
		.enter().append("g")
			.attr("class", "dimension")
			.attr("transform", d => `translate(${x(d)})`);

	axisG.append("g")
			.attr("class", "axis")
			.each(function(d) { d3.select(this).call(d3.axisLeft(y[d])); })
		.append("text")
			.style("text-anchor", "middle")
			.attr("y", -9)
			.text(d => d);

	// 11) stash for updates
	initChart3.g	= g;
	initChart3.x	= x;
	initChart3.y	= y;
}

// Update legend + lines
function updateChart3() {
	// 1) Build an array of all records to plot:
	//		for each selected owner‐year, grab every record ≤ that year
	const plotData = chart3Data.flatMap(elem => {
		const cutoff = elem.year + minYear;
		return chart3FullData
			.filter(d => d.owner === elem.owner && +d.date_of_launch <= cutoff)
			.map(d => ({
				...d,
				color: elem.color
			}));
	});

	// 2) Legend enter/update/exit (unchanged)
	let legendItem = chart3Legend.selectAll(".legend-item")
		.data(chart3Data, d => d.color);

	legendItem.exit().remove();

	const legendEnter = legendItem.enter()
		.append("div")
			.attr("class", "legend-item")
			.style("display", "flex")
			.style("align-items", "center")
			.style("gap", "20px")
			.style("height", "22px");

	legendEnter.append("button")
			.attr("class", "close")
			.text("X")
			.on("click", handleRemovalChart3);

	legendEnter.append("div")
			.style("background-color", d => d.color)
			.attr("class", "color-circle");

	legendEnter.append("p")
			.text(d => `${d.owner} up to year: ${d.year + minYear}. number of sattelites: ${chart1Data[d.year].get(d.owner)}`);

	// 3) Rebind lines to plotData
	const g		= initChart3.g;
	const x		= initChart3.x;
	const y		= initChart3.y;
	const dims = dimensionsChart3;
	const line = d3.line();

	const fg = g.select("g.foreground")
		.selectAll("path.pc-line")
		.data(plotData, d => `${d.owner}~${d.date_of_launch}~${d.color}`);

	// remove old
	fg.exit().remove();

	// add new + update all
	fg.enter().append("path")
			.attr("class", "pc-line")
			.attr("fill", "none")
			.attr("stroke-width", 1.5)
			.attr("stroke-opacity", 0.7)
		.merge(fg)
			.attr("stroke", d => d.color)
			.attr("d", d => line(
				dims.map(dim => [ x(dim), y[dim](+d[dim]) ])
			));
}

function handleRemovalChart3(e, d) {
	chart3Data = chart3Data.filter(ele => ele.color !== d.color);
	colorsChart3.push(d.color);
	updateChart3();
}
