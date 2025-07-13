const width = 1000;
const height = 1000;
const margin = 1;
const ease = d3.easeCubic;

let chart1, data, fullData;
let tooltip = d3.select('#tooltip');
let slider, yearLabel, playBtn, pauseBtn, nodesGroup;
let intervalId = null;
let countryColorMap;
let countriesGroup;

let nameToAlpha3 = new Map();
let numericCodeToAlpha3 = new Map();

export default function initChart1(_data) {
  fullData = _data;

  d3.csv('./country_codes_simple_cleaned.csv').then(mapping => {
    mapping.forEach(d => {
      nameToAlpha3.set(d.country_name.trim(), d.alpha3_code.trim());
      numericCodeToAlpha3.set(String(d.numeric_code).trim(), d.alpha3_code.trim());
    });

    configureData(_data);
    createCountryColorMap();
    configureChart();
    initMap();
    updateChart();
    updateMap();
  });
}

function configureData(_data) {
  data = _data.map(d => {
    const countryName = d['operator_country'].trim();
    const iso = nameToAlpha3.get(countryName) || 'UNK';
    return {
      name: d['owner'],
      country: countryName,
      iso: iso,
      year: +d['date_of_launch']
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
  d3.select('#legend').remove();
  d3.select('#chart1')
    .append('div')
    .attr('id', 'legend')
    .style('max-height', '400px')
    .style('overflow-y', 'auto')
    .style('border', '1px solid #ccc')
    .style('padding', '10px')
    .style('width', '200px')
    .style('font', '12px sans-serif')
    .selectAll('div')
    .data([...countryColorMap.entries()])
    .enter()
    .append('div')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('margin-bottom', '5px')
    .call(div => {
      div.append('span')
        .style('display', 'inline-block')
        .style('width', '15px')
        .style('height', '15px')
        .style('background-color', d => d[1])
        .style('margin-right', '5px');
      div.append('span').text(d => d[0]);
    });
}

function configureChart() {
  const container = d3.select('#chart1');
  const controls = container.append('div').attr('class', 'controls');

  slider = controls.append('input')
    .attr('type', 'range')
    .attr('min', 1974)
    .attr('max', 2023)
    .attr('value', 2023)
    .attr('step', 1)
    .on('input', () => {
      const year = +slider.property('value');
      yearLabel.text(year);
      updateChart(year);
      updateMap(year);
      if (intervalId) stopPlaying();
    });

  yearLabel = controls.append('span').attr('id', 'yearLabel').text('2023');

  playBtn = controls.append('button')
    .attr('id', 'playBtn')
    .text('Play')
    .on('click', startPlaying);

  pauseBtn = controls.append('button')
    .attr('id', 'pauseBtn')
    .text('Pause')
    .attr('disabled', true)
    .on('click', stopPlaying);

  chart1 = container.append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto; font: 10px sans-serif;')
    .attr('text-anchor', 'middle');

  nodesGroup = chart1.append('g').attr('class', 'nodes');
}

function updateChart(filterYear = 2023) {
  const filtered = data.filter(d => d.year <= filterYear);
  const count = new Map();
  filtered.forEach(d => {
    const key = `${d.name}|${d.country}`;
    count.set(key, (count.get(key) || 0) + 1);
  });

  const arr = Array.from(count, ([key, v]) => {
    const [name, country] = key.split('|');
    return { name, country, value: v };
  }).sort((a, b) => d3.ascending(a.name, b.name));

  const pack = d3.pack()
    .size([width - margin * 2, height - margin * 2])
    .padding(3);

  const root = pack(d3.hierarchy({ children: arr }).sum(d => d.value));
  const nodes = nodesGroup.selectAll('g.node').data(root.leaves(), d => d.data.name + d.data.country);

  const enter = nodes.enter().append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('opacity', 0);

  enter.append('circle')
    .attr('fill-opacity', 0.7)
    .attr('fill', d => countryColorMap.get(d.data.country) || '#999')
    .attr('r', 0);

  enter.append('text')
    .attr('dy', '-0.2em')
    .attr('text-anchor', 'middle')
    .attr('fill', 'white');

  nodes.merge(enter).transition().duration(750).ease(ease)
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('opacity', 1);

  nodes.merge(enter).select('circle').attr('r', d => d.r);

  nodes.merge(enter).select('text')
    .each(function(d) {
      const t = d3.select(this);
      t.selectAll('tspan').remove();
      t.append('tspan').text(d.data.name).attr('x', 0).attr('dy', 0);
      t.append('tspan').text(d.data.value).attr('x', 0).attr('dy', '1.2em');
    })
    .style('font-size', d => `${Math.min(2 * d.r / Math.max(1, d.data.name.length), 12)}px`);

  nodes.exit().transition().duration(500).ease(ease).attr('opacity', 0).remove();
}

function initMap() {
  const mapSvg = d3.select('#chart4').append('svg')
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' });
  const pathGen = d3.geoPath().projection(projection);

  countriesGroup = mapSvg.append('g').attr('class', 'countries');

  d3.json('./data/world-110m.json').then(world => {
    const countries = topojson.feature(world, world.objects.countries).features;

    countriesGroup.selectAll('path')
      .data(countries)
      .enter().append('path')
      .attr('d', pathGen)
      .attr('fill', '#ccc')
      .attr('stroke', '#333');

    updateMap(+slider.property('value'));
  });
}

function updateMap(filterYear = 2023) {
  const launched = new Set(
    data.filter(d => d.year <= filterYear).map(d => d.iso)
  );

  countriesGroup.selectAll('path')
    .on('mouseover', function(event, d) {
      const iso = numericCodeToAlpha3.get(String(d.id));
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

function stopPlaying() {
  playBtn.property('disabled', false);
  pauseBtn.property('disabled', true);
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startPlaying() {
  playBtn.property('disabled', true);
  pauseBtn.property('disabled', false);
  intervalId = setInterval(() => {
    const current = +slider.property('value');
    if (current >= +slider.attr('max')) {
      stopPlaying();
      return;
    }
    const next = current + 1;
    slider.property('value', next);
    yearLabel.text(next);
    updateChart(next);
    updateMap(next);
  }, 1000);
}
