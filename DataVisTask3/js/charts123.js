let chart1, chart2, chart3;
let colorScale1;
let tooltipDash; 
let minYear = 1974, maxYear = 2023;
let chart1Children, chart1Data = Array.from({length: maxYear - minYear + 1}, () => new Map());
const owners = new Map();

let countriesISO = new Map(), chart2Data = Array.from({length: maxYear - minYear + 1}, () => new Map());

const dimensionsChart3 = ["perigee_km", "apogee_km","inclination_degrees","period_minutes",  "launch_mass_kg", "expected_lifetime_yrs"];

function createChart123(data) {
	chart1 = d3.select("#chart1").append("svg")
		.attr("width", width)
		.attr("height", height);

	chart2 = d3.select("#chart2").append("svg")
		.attr("width", width*2)
		.attr("height", height)

	chart3 = d3.select("#chart3").append("svg")
		.attr("width", width)
		.attr("height", height)

	const operator_country = Array.from(new Set(data.map(d => d.operator_country)));
	colorScale1 = d3.scaleOrdinal()
		.domain(operator_country)
		.range(operator_country.map((d, i) => d3.interpolateRainbow(i / operator_country.length)));

	initChart1(data);
	initChart2(data);
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
	circles.join("circle")
		.transition().duration(750)
		.attr("cx", d => d.x)
		.attr("cy", d => d.y)
		.attr("r", d => d.r)
		.attr("fill", d => colorScale1(owners.get(d.data.owner)));
	
	circles.on("mouseover", (event, d) => {
		const value = chart1Data[yearIndex].get(d.data.owner);
		tooltipDash.style("opacity", 1)
			.html(`<strong>${d.data.owner}</strong><br/>Country: ${d.data.country}<br/>Value: ${value}`)
			.style("left", (event.pageX + 10) + "px")
			.style("top", (event.pageY + 10) + "px");
		}).on("mouseout", () => {
			tooltipDash.style("opacity", 0);
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
		.style("font-size", d => Math.min(2 * d.r / d.data.owner.length, 14) + "px")
		.text(d => d.data.owner)
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
		.fitSize([width * 2, height], { type: 'Sphere' });
	const pathGen = d3.geoPath().projection(projection);

	try {
		const topo = await d3.json('./js/world-110m.json');

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
						// .html(`Value: ${val}`)
						.html(`<strong>${val}</strong><br/>Value: ${chart2Data[yearNum - minYear].get(val)}`)
						.style('left', (event.pageX + 10) + 'px')
						.style('top', (event.pageY + 10) + 'px');
				}
			})
			.on('mouseout', () => {
				tooltipDash.style('opacity', 0);
			});
		updateChart2(maxYear)
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