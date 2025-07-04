// chart2.js

const width = 600;
const height = 500;
const margin = { top: 40, right: 20, bottom: 50, left: 60 };

let chart2;
let data;
let tooltip = d3.select("#tooltip");
let nodesGroup;

export default function initChart2(_data) {
	configureData(_data);
	configureChart();
	updateChart();
}

function configureData(_data) {
	data = _data.map(d => {
		const dateStr = d["Date of Launch"];
		const [day, month, year] = dateStr.split(' ')[0].split('/').map(Number);
		const users = d["Users"].split("/").map(s => s.trim());
		return {
			year: new Date(year, month - 1, day).getFullYear(),
			users: users,
			row: d
		};
	});
}

function configureChart() {
	const container = d3.select("#chart2");
	chart2 = container.append("svg")
		.attr("width", width)
		.attr("height", height)
		.attr("viewBox", [0, 0, width, height])
		.style("font", "10px sans-serif");
}

function updateChart() {
	const userCategories = new Set();
	const yearUserCounts = new Map();

	data.forEach(d => {
		const year = d.year;
		if (!yearUserCounts.has(year)) {
			yearUserCounts.set(year, new Map());
		}
		const countsMap = yearUserCounts.get(year);

		d.users.forEach(user => {
			userCategories.add(user);
			countsMap.set(user, (countsMap.get(user) || 0) + 1);
		});
	});

	const categories = Array.from(userCategories);
	const years = Array.from(yearUserCounts.keys()).sort();

	const stackedData = years.map(year => {
		const countsMap = yearUserCounts.get(year);
		const obj = { year: year };
		categories.forEach(cat => {
			obj[cat] = countsMap.get(cat) || 0;
		});
		return obj;
	});

	const x = d3.scaleBand()
		.domain(stackedData.map(d => d.year))
		.range([margin.left, width - margin.right])
		.padding(0.1);

	const y = d3.scaleLinear()
		.domain([0, d3.max(stackedData, d => d3.sum(categories, c => d[c]))])
		.nice()
		.range([height - margin.bottom, margin.top]);

	const color = d3.scaleOrdinal()
		.domain(categories)
		.range(d3.schemeCategory10);

	chart2.selectAll("*").remove();

	chart2.append("g")
		.attr("transform", `translate(0,${height - margin.bottom})`)
		.call(d3.axisBottom(x).tickFormat((d, i) => (i % 2 === 0 ? d : "")))
		.selectAll("text")
		.style("text-anchor", "middle");

	chart2.append("g")
		.attr("transform", `translate(${margin.left},0)`)
		.call(d3.axisLeft(y));

	const stack = d3.stack().keys(categories);
	const series = stack(stackedData);

	const groups = chart2.selectAll("g.layer")
		.data(series)
		.join("g")
		.attr("class", "layer")
		.attr("fill", d => color(d.key));

	groups.selectAll("rect")
		.data(d => d)
		.join("rect")
		.attr("x", d => x(d.data.year))
		.attr("y", d => y(d[1]))
		.attr("height", d => y(d[0]) - y(d[1]))
		.attr("width", x.bandwidth());

        chart2.selectAll("rect.hover-area")
        .data(stackedData)
        .join("rect")
        .attr("class", "hover-area")
        .attr("x", d => x(d.year))
        .attr("y", margin.top)
        .attr("width", x.bandwidth())
        .attr("height", height - margin.top - margin.bottom)
        .attr("fill", "transparent")
        .on("mouseover", (event, d) => {
            let tooltipHtml = `<strong>Year: ${d.year}</strong><br/>`;
            categories.forEach(cat => {
                tooltipHtml += `${cat} = ${d[cat]}<br/>`;
            });
    
            tooltip.style("opacity", 1)
                .html(tooltipHtml);
    
            const tooltipWidth = tooltip.node().offsetWidth;
            const pageWidth = window.innerWidth;
            let left = event.pageX + 10;
            if (left + tooltipWidth > pageWidth) {
                left = event.pageX - tooltipWidth - 10;
            }
    
            tooltip.style("left", `${left}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mousemove", (event) => {
            const tooltipWidth = tooltip.node().offsetWidth;
            const pageWidth = window.innerWidth;
            let left = event.pageX + 10;
            if (left + tooltipWidth > pageWidth) {
                left = event.pageX - tooltipWidth - 10;
            }
    
            tooltip.style("left", `${left}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        });
    
}
