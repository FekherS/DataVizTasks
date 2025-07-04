const width3 = 500;
const height3 = 500;
const margin3 = 1;
const radius3 = Math.min(width3, height3) / 2 - margin3;

let chart3;
let data3;
let tooltip3 = d3.select("#tooltip");

export default function initChart3(_data) {
    configureData(_data);
    configureChart();
    drawChart();
}

function configureData(_data) {
    data3 = _data.filter(d => d["Users"] && d["Purpose"] && d["Class of Orbit"]);
}

function configureChart() {
    const container = d3.select("#chart3");
    container.selectAll("*").remove();

    chart3 = container.append("svg")
        .attr("width", width3)
        .attr("height", height3)
        .attr("viewBox", [0, 0, width3, height3])
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
        .attr("text-anchor", "middle");

    chart3.append("g").attr("class", "sunburst");
}

function drawChart() {
    const rootData = prepareHierarchy(data3);
    const root = d3.hierarchy(rootData)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);
    const partition = d3.partition()
        .size([2 * Math.PI, root.height + 1]);
    partition(root);

    const colorScales = [null,
        d3.scaleOrdinal(d3.schemeTableau10),
        d3.scaleOrdinal(d3.schemeSet3),
        d3.scaleOrdinal(d3.schemeSet2)
    ];

    const arcGen = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0 * radius3 / (root.height + 1))
        .outerRadius(d => d.y1 * radius3 / (root.height + 1) - 1);

    const g3 = chart3.select("g.sunburst")
        .attr("transform", `translate(${width3 / 2},${height3 / 2})`);

    // draw slices
    const slices = g3.selectAll("path.slice")
        .data(root.descendants().slice(1), d => d.data.name);

    slices.enter().append("path")
        .attr("class", "slice")
        .attr("d", arcGen)
        .attr("fill", d => {
            const scale = colorScales[d.depth] || colorScales[1];
            return scale(d.data.name);
        })
        .style("cursor", d => d.children ? "pointer" : "default")
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseout", () => tooltip3.style("opacity", 0))
        .on("click", (event, p) => zoom(p, root, arcGen, g3));

    // center circle for zoom out
    g3.append("circle")
        .attr("class", "center")
        .attr("r", radius3 / 3)
        .attr("fill", "transparent")
        .attr("pointer-events", "all")
        .style("cursor", "pointer")
        .on("click", (event) => zoom(root, root, arcGen, g3));

    // labels
    const labelData = root.descendants().slice(1).filter(d => (d.x1 - d.x0) > 0.1);
    const labels = g3.selectAll("text.label").data(labelData, d => d.data.name);

    labels.enter().append("text")
        .attr("class", "label")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("data-depth", d => d.depth)
        .style("font-size", "10px")
        .text(d => d.data.name)
        .attr("transform", d => `translate(${arcGen.centroid(d)})`);
}

function zoom(p, root, arcGen, g3) {
    const duration = 750;

    root.each(d => {
        d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        };
    });

    const t = g3.transition().duration(duration);

    // update slices
    g3.selectAll("path.slice")
        .transition(t)
        .attrTween("d", d => {
            const i = d3.interpolate({x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1}, d.target);
            return tt => arcGen(i(tt));
        });

    // update labels: hide labels of depth <= p.depth
    g3.selectAll("text.label")
        .transition(t)
        .attr("transform", d => {
            const b = d.target;
            return `translate(${arcGen.centroid(b)})`;
        })
        .style("opacity", d => {
            return (d.depth > p.depth && (d.target.x1 - d.target.x0) > 0.1) ? 1 : 0;
        });

}

function mouseover(event, d) {
    tooltip3.style("opacity", 1)
        .html(`${d.data.name}<br>Count: ${d.value}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
}

function mousemove(event) {
    tooltip3.style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
}

// Helper: Prepare hierarchical data for sunburst
function prepareHierarchy(data) {
    const root = { name: "root", children: [] };
    const userMap = new Map();

    data.forEach(d => {
        const user = d["Users"];
        const purpose = d["Purpose"];
        const orbit = d["Class of Orbit"];

        if (!user || !purpose || !orbit) return;

        if (!userMap.has(user)) {
            userMap.set(user, { name: user, children: new Map() });
        }
        const userNode = userMap.get(user);

        if (!userNode.children.has(purpose)) {
            userNode.children.set(purpose, { name: purpose, children: new Map() });
        }
        const purposeNode = userNode.children.get(purpose);

        if (!purposeNode.children.has(orbit)) {
            purposeNode.children.set(orbit, { name: orbit, value: 0 });
        }
        const orbitNode = purposeNode.children.get(orbit);
        orbitNode.value += 1;
    });

    function mapToArray(node) {
        if (node.children instanceof Map) {
            node.children = Array.from(node.children.values());
            node.children.forEach(mapToArray);
        }
    }

    root.children = Array.from(userMap.values());
    root.children.forEach(mapToArray);
    return root;
}
