/*
* Data Visualization - Framework
* Copyright (C) University of Passau
*   Faculty of Computer Science and Mathematics
*   Chair of Cognitive sensor systems
* Maintenance:
*   2025, Alexander Gall <alexander.gall@uni-passau.de>
*
* All rights reserved.
*/

//added variables
let data = null;
let domain = null;

// scatterplot axes
let xAxis, yAxis, xAxisLabel, yAxisLabel;
// radar chart axes
let radarAxes, radarAxesAngle;
let dimensions = ["dimension 1", "dimension 2", "dimension 3", "dimension 4", "dimension 5", "dimension 6"];
//*HINT: the first dimension is often a label; you can simply remove the first dimension with
// dimensions.splice(0, 1);

// the visual channels we can use for the scatterplot
let channels = ["scatterX", "scatterY", "size"];

// size of the plots
let margin, width, height, radius;
// svg containers
let scatter, radar, dataTable;

// Add additional variables


function init() {
    // define size of plots
    margin = {top: 20, right: 20, bottom: 20, left: 50};
    width = 600;
    height = 500;
    radius = width / 2;

    // Start at default tab
    document.getElementById("defaultOpen").click();

	// data table
	dataTable = d3.select('#dataTable');
 
    // scatterplot SVG container and axes
    scatter = d3.select("#sp").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    // radar chart SVG container and axes
    radar = d3.select("#radar").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

    // read and parse input file
    let fileInput = document.getElementById("upload"), readFile = function () {

        // clear existing visualizations
        clear();

        let reader = new FileReader();
        reader.onloadend = function () {
            console.log("data loaded: ");
            console.log(reader.result);
            data = d3.csvParse(reader.result)
            // TODO: parse reader.result data and call the init functions with the parsed data!
            initVis();
            CreateDataTable();
            // TODO: possible place to call the dashboard file for Part 2
            initDashboard(null);
        };
        reader.readAsBinaryString(fileInput.files[0]);
    };
    fileInput.addEventListener('change', readFile);
}


function initVis(){

    // TODO: parse dimensions (i.e., attributes) from input file
    dimensions = data.columns.slice(1);
    domain = dimensions.map((dim) => [d3.min(data, d => Number(d[dim])), d3.max(data, d => Number(d[dim]))]);

    // y scalings for scatterplot
    // TODO: set y domain for each dimension
    let y = d3.scaleLinear()
        .domain([domain[0][0], domain[0][1]])
        .range([height - margin.bottom - margin.top, margin.top]);

    // x scalings for scatter plot
    // TODO: set x domain for each dimension
    let x = d3.scaleLinear()
        .domain([domain[0][0], domain[0][1]])
        .range([margin.left, width - margin.left - margin.right]);

    // radius scalings for radar chart
    // TODO: set radius domain for each dimension
    let r = d3.scaleLinear()
        .domain([domain[0][0], domain[0][1]])
        .range([0, 15]);

    // scatterplot axes
    yAxis = scatter.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + margin.left + ")")
        .call(d3.axisLeft(y));

    yAxisLabel = yAxis.append("text")
        .style("text-anchor", "middle")
        .attr("y", margin.top / 2)
        .text(dimensions[0]);

    xAxis = scatter.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, " + (height - margin.bottom - margin.top) + ")")
        .call(d3.axisBottom(x));

    xAxisLabel = xAxis.append("text")
        .style("text-anchor", "middle")
        .attr("x", width - margin.right)
        .text(dimensions[0]);

    // radar chart axes
    radarAxesAngle = Math.PI * 2 / dimensions.length;
    let axisRadius = d3.scaleLinear()
        .range([0, radius]);
    let maxAxisRadius = 0.75,
        textRadius = 0.8;
    gridRadius = 0.1;

    // radar axes
    radarAxes = radar.selectAll(".axis")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "axis");

    radarAxes.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", function(d, i){ return radarX(axisRadius(maxAxisRadius), i); })
        .attr("y2", function(d, i){ return radarY(axisRadius(maxAxisRadius), i); })
        .attr("class", "line")
        .style("stroke", "black");

    // TODO: render grid lines in gray
    let greylines = radar.selectAll(".greyline")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "greyline")
    for (let j = 1; j <= 6; ++j){
        greylines.append("line")
        .attr("x1", function (d, i) {return radarX(axisRadius(maxAxisRadius * j / 7), i);})
        .attr("y1", function (d, i) {return radarY(axisRadius(maxAxisRadius * j / 7), i);})
        .attr("x2", function (d, i) {return radarX(axisRadius(maxAxisRadius * j / 7), i + 1);})
        .attr("y2", function (d, i) {return radarY(axisRadius(maxAxisRadius * j / 7), i + 1);})
        .attr("class", "greyline")
        .style("stroke", "grey");
    }
    // TODO: render correct axes labels
    radar.selectAll(".axisLabel")
        .data(dimensions)
        .enter()
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", function(d, i){ return radarX(axisRadius(textRadius), i); })
        .attr("y", function(d, i){ return radarY(axisRadius(textRadius), i); })
        .text((dimension) => dimension);

    // init menu for the visual channels
    channels.forEach(function(c){
        initMenu(c, dimensions);
    });

    // refresh all select menus
    channels.forEach(function(c){
        refreshMenu(c);
    });

    renderScatterplot();
    renderRadarChart();
}

// clear visualizations before loading a new file
function clear(){
    scatter.selectAll("*").remove();
    radar.selectAll("*").remove();
    dataTable.selectAll("*").remove();
}

//Create Table
function CreateDataTable() {

    // TODO: create table and add class
    let table = document.createElement("table");
    table.classList.add("dataTableClass");

    // TODO: add headers, row & columns
    let row = document.createElement("tr");
    data.columns.forEach(element => {
        let cell = document.createElement("th");
        cell.classList.add("tableHeaderClass");
        cell.innerText = element;
        row.append(cell);
    });
    table.append(row);

    data.forEach(element => {
        row = document.createElement("tr");
        data.columns.forEach(attr => {
            let cell = document.createElement("td");
            cell.classList.add("tableBodyClass");
            cell.innerText = element[attr];
            cell.onmouseover = addColorOnHover;
            cell.onmouseout = removeColorOnStopHover;
            row.append(cell);
        })
        table.append(row);
    });
    dataTable.node().append(table);

    // TODO: add mouseover event
    function addColorOnHover(e) {
        e.target.classList.add("blueBg")
    }
    function removeColorOnStopHover(e){
        e.target.classList.remove("blueBg")
    };
}
function renderScatterplot(){

    // TODO: get domain names from menu and label x- and y-axis
    let ax = readMenu(channels[0]);
    let ay = readMenu(channels[1]);
    let ar = readMenu(channels[2]);
    let ix = dimensions.indexOf(ax);
    let iy = dimensions.indexOf(ay);
    let ir = dimensions.indexOf(ar);
    xAxisLabel.text(ax);
    yAxisLabel.text(ay);
    // TODO: re-render axes
    let x = d3.scaleLinear()
        .domain([domain[ix][0], domain[ix][1]])
        .range([margin.left, width - margin.left - margin.right]);
    let y = d3.scaleLinear()
        .domain([domain[iy][0], domain[iy][1]])
        .range([height - margin.bottom - margin.top, margin.top]);
    let r = d3.scaleLinear()
        .domain([domain[ir][0], domain[ir][1]])
        .range([0, 15]);
    xAxis.call(d3.axisBottom(x))
    yAxis.call(d3.axisLeft(y));
    // TODO: render dots
    scatter.selectAll("circle").remove();
    scatter.selectAll("circle").data(data)
        .join("circle")
        .attr("cx", d => x(d[ax]))
        .attr("cy", d => y(d[ay]))
        .attr("r", d => r(d[ar]))
        .attr("fill", "black")
        .attr("fill-opacity", 0.5)           
        .attr("stroke-width", 1); 
}

function renderRadarChart(){

    // TODO: show selected items in legend

    // TODO: render polylines in a unique color
}


function radarX(radius, index){
    return radius * Math.cos(radarAngle(index));
}

function radarY(radius, index){
    return radius * Math.sin(radarAngle(index));
}

function radarAngle(index){
    return radarAxesAngle * index - Math.PI / 2;
}

// init scatterplot select menu
function initMenu(id, entries) {
    $("select#" + id).empty();

    entries.forEach(function (d) {
        $("select#" + id).append("<option>" + d + "</option>");
    });

    $("#" + id).selectmenu({
        select: function () {
            renderScatterplot();
        }
    });
}

// refresh menu after reloading data
function refreshMenu(id){
    $( "#"+id ).selectmenu("refresh");
}

// read current scatterplot parameters
function readMenu(id){
    return $( "#" + id ).val();
}

// switches and displays the tabs
function openPage(pageName,elmnt,color) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].style.backgroundColor = "";
    }
    document.getElementById(pageName).style.display = "block";
    elmnt.style.backgroundColor = color;
}
