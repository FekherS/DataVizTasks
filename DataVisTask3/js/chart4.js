let chart4;
function createChart4(_data) {
	chart4 = d3.select("#chart4");
	initChart4(_data);
}
const colorScales = [
    d3.scaleOrdinal(d3.schemeCategory10), // depth 1
    d3.scaleOrdinal(d3.schemeAccent),     // depth 2
    d3.scaleOrdinal(d3.schemeSet3),       // depth 3
    d3.scaleOrdinal(d3.schemePastel1)     // depth 4+
];
function initChart4(_data) {
	const data = {
		name: "satellites",
		children: []
	};

	_data.forEach(satellite => {
		const { users, type_of_orbit, purpose, operator_country } = satellite;

		// Find or create the `users` node
		let usersNode = data.children.find(node => node.name === users);
		if (!usersNode) {
			usersNode = { name: users, children: [] };
			data.children.push(usersNode);
		}

		// Find or create the `orbit` node under `users`
		let orbitNode = usersNode.children.find(node => node.name === type_of_orbit);
		if (!orbitNode) {
			orbitNode = { name: type_of_orbit, children: [] };
			usersNode.children.push(orbitNode);
		}

		// NEW: Find or create the `purpose` node under `orbit`
		let purposeNode = orbitNode.children.find(node => node.name === purpose);
		if (!purposeNode) {
			purposeNode = { name: purpose, children: [] };
			orbitNode.children.push(purposeNode);
		}

		// Find or create the `operator_country` node under `purpose`
		let countryNode = purposeNode.children.find(node => node.name === operator_country);
		if (!countryNode) {
			countryNode = { name: operator_country, children: [] };
			purposeNode.children.push(countryNode);
		}

		// Add satellite name under `operator_country`
		countryNode.children.push({ name: satellite.satellite_name });
	});

	makeChart4(data);
}

function makeChart4(data) {
	const width = 600;
	const height = 600;
	const radius = width / 6;

	const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

	const hierarchy = d3.hierarchy(data)
		.sum(d => d.children ? 0 : 1) // count leaves
		.sort((a, b) => b.value - a.value);

	const root = d3.partition()
		.size([2 * Math.PI, hierarchy.height + 1])
		(hierarchy);

	root.each(d => d.current = d);

	const arc = d3.arc()
		.startAngle(d => d.x0)
		.endAngle(d => d.x1)
		.padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
		.padRadius(radius * 1.5)
		.innerRadius(d => d.y0 * radius)
		.outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

	const svg = d3.create("svg")
		.attr("viewBox", [-width / 2, -height / 2, width, width])
		.attr("width", width)
		.attr("height", height)
		.style("font", "10px sans-serif");

	const path = svg.append("g")
		.selectAll("path")
		.data(root.descendants().slice(1))
		.join("path")
		.attr("fill", d => {
			const depth = d.depth - 1; // since root is depth 0
			const scale = colorScales[Math.min(depth, colorScales.length - 1)];
			return scale(d.data.name);
		})
		.attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
			.attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
			.attr("d", d => arc(d.current));

	path.filter(d => d.children)
		.style("cursor", "pointer")
		.on("click", clicked);

	const format = d3.format(",d");

	path.append("title")
		.text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

	const label = svg.append("g")
		.attr("pointer-events", "none")
		.attr("text-anchor", "middle")
		.style("user-select", "none")
		.selectAll("text")
		.data(root.descendants().slice(1))
		.join("text")
			.attr("dy", "0.35em")
			.attr("fill-opacity", d => +labelVisible(d.current))
			.attr("transform", d => labelTransform(d.current))
			.text(d => d.data.name);

	const parent = svg.append("circle")
		.datum(root)
		.attr("r", radius)
		.attr("fill", "none")
		.attr("pointer-events", "all")
		.on("click", clicked);

	function clicked(event, p) {
		parent.datum(p.parent || root);

		root.each(d => d.target = {
			x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
			x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
			y0: Math.max(0, d.y0 - p.depth),
			y1: Math.max(0, d.y1 - p.depth)
		});

		const t = svg.transition().duration(event.altKey ? 7500 : 750);

		path.transition(t)
			.tween("data", d => {
				const i = d3.interpolate(d.current, d.target);
				return t => d.current = i(t);
			})
			.filter(function(d) {
				return +this.getAttribute("fill-opacity") || arcVisible(d.target);
			})
				.attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
				.attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
				.attrTween("d", d => () => arc(d.current));

		label.filter(function(d) {
			return +this.getAttribute("fill-opacity") || labelVisible(d.target);
		}).transition(t)
			.attr("fill-opacity", d => +labelVisible(d.target))
			.attrTween("transform", d => () => labelTransform(d.current));
	}

	function arcVisible(d) {
		return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
	}

	function labelVisible(d) {
		return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
	}

	function labelTransform(d) {
		const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
		const y = (d.y0 + d.y1) / 2 * radius;
		return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
	}

	// Attach the SVG to the container
	chart4.node().innerHTML = ""; // clear old chart if needed
	chart4.node().appendChild(svg.node());
}
