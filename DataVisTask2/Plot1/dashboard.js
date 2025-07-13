
const width = 600,
      height = 600,
      ease = d3.easeCubic;

// metrics for radar
const dimensions = [
  'longitude_of_geo_degrees',
  'perigee_km',
  'apogee_km',
  'inclination_degrees',
  'period_minutes',
  'launch_mass_kg'
];
const radarRadius = 200;
const radarAxesAngle = Math.PI * 2 / dimensions.length;

// storage
let fullData = [],
    codeMapping = [],       // raw CSV of numeric/country_name/alpha3
    worldTopo = null;       // TopoJSON
let nameToAlpha3 = new Map(),
    numericToAlpha3 = new Map(),
    iso3Centroids = new Map();

let colorMap = new Map(),
    radarData = [];

let bubbleSvg, mapSvg, radarSvg,
    bubbleGroup, mapGroup,
    slider, yearLabel, playBtn, pauseBtn,
    radarLegend;

let domain = {};  // for radar scales

// 1️⃣ Load everything
Promise.all([
  d3.csv('./UCSDB.csv'),
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
]).then(([sats, topo]) => {
  fullData = sats.map(d => ({
    satellite_name: d.satellite_name,
      operator_country: d.operator_country,
      operator_iso_num: +d.operator_iso_num,
    owner: d.owner,
    year: +d.date_of_launch,
    longitude_of_geo_degrees: +d.longitude_of_geo_degrees,
    perigee_km: +d.perigee_km,
    apogee_km: +d.apogee_km,
    eccentricity: +d.eccentricity,
    inclination_degrees: +d.inclination_degrees,
    period_minutes: +d.period_minutes,
    launch_mass_kg: +d.launch_mass_kg
  }));
  worldTopo = topo;
  computeRadarDomains();
  createControls();
  createCharts();
  updateAll(+slider.property("value"));
});

// 2️⃣ Build name→ISO3 and numeric→ISO3


// 3️⃣ Compute domain for each radar dimension
function computeRadarDomains() {
  dimensions.forEach(dim => {
    const vals = fullData.map(d => d[dim]).filter(v => !isNaN(v));
    domain[dim] = [d3.min(vals), d3.max(vals)];
  });
}

// 4️⃣ Create slider + play/pause
function createControls() {
  // insert a <div id="controls"> just before #chart1
  const ctrl = d3.select("body")
    .insert("div", "#chart1")
    .attr("id", "controls")
    .style("margin","10px");

  slider = ctrl.append("input")
    .attr("type","range")
    .attr("min",1970)
    .attr("max",2025)
    .attr("step",1)
    .attr("value",2025)
    .on("input", () => {
      yearLabel.text(slider.property("value"));
      updateAll(+slider.property("value"));
      stopPlaying();
    });

  yearLabel = ctrl.append("span")
    .text("2025")
    .style("margin","0 10px");

  playBtn = ctrl.append("button").text("Play").on("click", startPlaying);
  pauseBtn = ctrl.append("button").text("Pause").attr("disabled", true).on("click", stopPlaying);
}

// 5️⃣ Set up the three SVGs
function createCharts() {
  // Clear previous SVGs if any
  d3.select("#chart1").selectAll("*").remove();
  d3.select("#chart3").selectAll("*").remove();
  d3.select("#chart4").selectAll("*").remove();
  d3.select("#radar-legend").remove();

  // Bubble chart setup
  const bubbleSvg = d3.select("#chart1").append("svg")
    .attr("width", width)
    .attr("height", height);

  const bubbleGroup = bubbleSvg.append("g");

  // Map setup
  const mapSvg = d3.select("#chart4").append("svg")
    .attr("width", width)
    .attr("height", height);

  const projection = d3.geoNaturalEarth1()
    .fitSize([width, height], { type: "Sphere" });

  const pathGen = d3.geoPath().projection(projection);

  const countriesGroup = mapSvg.append("g").attr("class", "countries");

  // Load and render countries on the map
  d3.json("./data/world-110m.json").then(world => {
    const countries = topojson.feature(world, world.objects.countries).features;

    countriesGroup.selectAll("path")
      .data(countries)
      .enter()
      .append("path")
      .attr("d", pathGen)
      .attr("fill", "#ccc")
      .attr("stroke", "#333");

    updateMap(+slider.property("value"));
  });

  // Radar chart setup
  const radarSvg = d3.select("#chart3").append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  // Compute centroids for features
  const features = topojson.feature(worldTopo, worldTopo.objects.countries).features;
  features.forEach(f => {
    const num = String(f.id);
    const iso3 = numericToAlpha3.get(num);
    if (iso3) {
      iso3Centroids.set(iso3, pathGen.centroid(f));
    }
  });

  // Draw base radar grid
  drawRadarBase();

  // Radar legend
  const radarLegend = d3.select("#chart3").append("div").attr("id", "radar-legend");
}


// 6️⃣ Update everything for a given year
function updateAll(year) {
    const filt = fullData.filter(d => d.year <= year);
    console.log(filt);
  updateBubble(filt);
  updateMap(filt);
  renderRadar();
}

// 7️⃣ Bubble Pack by owner
function updateBubble(data) {
  const counts = d3.rollups(data, v=>v.length, d=>d.owner)
    .map(([owner,c]) => ({owner,c}));

  const pack = d3.pack().size([width, height]).padding(5);
  const root = d3.hierarchy({children:counts}).sum(d=>d.c);
  const leaves = pack(root).leaves();

  const sel = bubbleGroup.selectAll("g.node").data(leaves, d=>d.data.owner);

  const enter = sel.enter().append("g")
    .attr("class","node")
    .on("click",(e,d)=> addToRadar(d.data.owner, data));

  enter.append("circle").attr("r",0)
    .attr("fill",d=>colorFor(d.data.owner));

  enter.append("text")
    .text(d=>d.data.owner)
    .attr("dy",".35em").attr("text-anchor","middle")
    .style("fill","#fff").style("font-size","10px");

  sel.merge(enter)
    .transition().ease(ease).duration(500)
    .attr("transform",d=>`translate(${d.x},${d.y})`);

  sel.merge(enter).select("circle")
    .transition().ease(ease).duration(500)
    .attr("r",d=>d.r);

  sel.exit().remove();
}

// 8️⃣ Map circles by operator_country
function updateMap(filterYear = 2023) {

  countriesGroup.selectAll('path')
    .on('mouseover', function(event, d) {
      const iso = d.operator_iso_num;
      if (!launched.has(iso)) return;

      const count = data.filter(dd => dd.iso === iso && dd.year <= filterYear).length;
      tooltip.style('opacity', 1)
        .html(`${iso}: ${count} launches`)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY + 10}px`);
    })
    .on('mousemove', event => {
      tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY + 10}px`);
    })
    .on('mouseout', () => tooltip.style('opacity', 0))
    .transition()
    .duration(500)
    .attr('fill', d => {
      const iso = numericCodeToAlpha3.get(String(d.id));
      if (launched.has(iso)) {
        const countryName = [...nameToAlpha3.entries()].find(([name, code]) => code === iso)?.[0] || iso;
        return countryColorMap.get(countryName) || '#999';
      }
      return '#eee';
    });
}

// 9️⃣ Radar base grid & axes
function drawRadarBase() {
  // axes
  dimensions.forEach((dim,i) => {
    radarSvg.append("line")
      .attr("x1",0).attr("y1",0)
      .attr("x2",radarRadius*Math.cos(radarAxesAngle*i-Math.PI/2))
      .attr("y2",radarRadius*Math.sin(radarAxesAngle*i-Math.PI/2))
      .attr("stroke","#333");

    radarSvg.append("text")
      .attr("x",1.1*radarRadius*Math.cos(radarAxesAngle*i-Math.PI/2))
      .attr("y",1.1*radarRadius*Math.sin(radarAxesAngle*i-Math.PI/2))
      .attr("text-anchor","middle")
      .text(dim);
  });
  // concentric rings
  for(let k=1;k<=5;k++){
    const r = radarRadius*k/5;
    const pts = dimensions.map((_,i)=>[
      r*Math.cos(radarAxesAngle*i-Math.PI/2),
      r*Math.sin(radarAxesAngle*i-Math.PI/2)
    ]);
    pts.push(pts[0]);
    radarSvg.append("path")
      .attr("d", d3.line()(pts))
      .attr("stroke","#aaa").attr("fill","none");
  }
}

// 1️⃣0️⃣ Add series to radar
function addToRadar(key, data) {
  if (radarData.find(d=>d.key===key)) return;
  const sel = data.filter(d => d.owner===key || d.operator_country===key);
  const avg = {};
  dimensions.forEach(dim=>{
    const arr = sel.map(d=>d[dim]).filter(v=>!isNaN(v));
    avg[dim] = arr.length?d3.mean(arr):0;
  });
  radarData.push({ key, avg, color: colorFor(key) });
  renderRadar();
}

// 1️⃣1️⃣ Draw radar series + legend
function renderRadar() {
  radarSvg.selectAll(".series").remove();
  radarLegend.selectAll("*").remove();

  radarData.forEach(s=>{
    const pts = dimensions.map((dim,i)=>{
      const scale = d3.scaleLinear().domain(domain[dim]).range([0,radarRadius]);
      const r = scale(s.avg[dim]);
      return [ r*Math.cos(radarAxesAngle*i-Math.PI/2),
               r*Math.sin(radarAxesAngle*i-Math.PI/2) ];
    });
    pts.push(pts[0]);

    radarSvg.append("path")
      .datum(pts)
      .attr("class","series")
      .attr("d",d3.line())
      .attr("stroke",s.color)
      .attr("fill",s.color).attr("fill-opacity",0.3);

    // legend entry
    const item = radarLegend.append("div").style("color",s.color);
    item.text(s.key+"  ");
    item.append("button").text("×")
      .on("click",()=> {
        radarData = radarData.filter(x=>x.key!==s.key);
        renderRadar();
      });
  });
}

// helper for consistent colors
function colorFor(key) {
  if (!colorMap.has(key)) {
    colorMap.set(key, d3.schemeCategory10[colorMap.size % 10]);
  }
  return colorMap.get(key);
}

// 1️⃣2️⃣ Play/pause
let intervalId = null;
function startPlaying() {
  playBtn.attr("disabled", true);
  pauseBtn.attr("disabled", null);
  intervalId = setInterval(()=>{
    let yr = +slider.property("value");
    if (yr>=+slider.attr("max")) return stopPlaying();
    slider.property("value",yr+1).dispatch("input");
  }, 500);
}
function stopPlaying() {
  playBtn.attr("disabled", null);
  pauseBtn.attr("disabled", true);
  clearInterval(intervalId);
  intervalId = null;
}
