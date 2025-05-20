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

// scatterplot axes
let xAxis, yAxis, xAxisLabel, yAxisLabel;
// radar chart axes
let radarAxes, radarAxesAngle;

let colors = d3.schemeCategory10;
let label;
let radarData = [];
let domain = {};
let dimensions = ["dimension 1", "dimension 2", "dimension 3", "dimension 4", "dimension 5", "dimension 6"];
//*HINT: the first dimension is often a label; you can simply remove the first dimension with
// dimensions.splice(0, 1);

// the visual channels we can use for the scatterplot
let channels = ["scatterX", "scatterY", "size"];

// size of the plots
let margin, width, height, radius;
// svg containers
let scatter, radar, dataTable, legend;

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

    legend = d3.select("#legend").append("div");
    
    // read and parse input file
    let fileInput = document.getElementById("upload"), readFile = function () {
        
        // clear existing visualizations
        clear();
        
        let reader = new FileReader();
        reader.onloadend = function () {
            // console.log("data loaded: ");
            // console.log(reader.result);
            
            // TODO: parse reader.result data and call the init functions with the parsed data!
            data = d3.csvParse(reader.result)
            label = data.columns[0];
            initVis(data);
            CreateDataTable(data);
            // TODO: possible place to call the dashboard file for Part 2
            initDashboard(null);
        };
        reader.readAsBinaryString(fileInput.files[0]);
    };
    fileInput.addEventListener('change', readFile);
}


function initVis(_data){

    // TODO: parse dimensions (i.e., attributes) from input file
    dimensions = data.columns.slice(1);
    dimensions.forEach((dim) => domain[dim] = [d3.min(_data, d => Number(d[dim])), d3.max(_data, d => Number(d[dim]))]);

    // y scalings for scatterplot
    // TODO: set y domain for each dimension
    let y = d3.scaleLinear()
        .range([height - margin.bottom - margin.top, margin.top]);

    // x scalings for scatter plot
    // TODO: set x domain for each dimension
    let x = d3.scaleLinear()
        .range([margin.left, width - margin.left - margin.right]);

    // radius scalings for radar chart
    // TODO: set radius domain for each dimension
    let r = d3.scaleLinear()
        .range([0, radius]);

    // scatterplot axes
    yAxis = scatter.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + margin.left + ")")
        .call(d3.axisLeft(y));

    yAxisLabel = yAxis.append("text")
        .style("text-anchor", "middle")
        .attr("y", margin.top / 2)
        .text("x");

    xAxis = scatter.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, " + (height - margin.bottom - margin.top) + ")")
        .call(d3.axisBottom(x));

    xAxisLabel = xAxis.append("text")
        .style("text-anchor", "middle")
        .attr("x", width - margin.right)
        .text("y");

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

    // TODO: render correct axes labels
    radar.selectAll(".axisLabel")
        .data(dimensions)
        .enter()
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", function(d, i){ return radarX(axisRadius(textRadius), i); })
        .attr("y", function(d, i){ return radarY(axisRadius(textRadius), i); })
        .text(dimension => dimension);

    // init menu for the visual channels
    channels.forEach(function(c){
        initMenu(c, dimensions);
    });

    // refresh all select menus
    channels.forEach(function(c){
        refreshMenu(c);
    });
    scatter.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(_data)
        .enter()
        .append("circle")
        .attr("fill", "black")
        .attr("fill-opacity", 0.2)
        .on("click", (e, d) => {
            let el = d3.select(e.target);
            if (el.attr("fill") !== "black" || !colors.length) return;
            let color = colors.pop()
            el.attr("fill", color)
                .attr("fill-opacity", 1)
                .raise();
            radarData.push([d, color]);
            renderRadarChart();
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
function CreateDataTable(_data) {
    // TODO: create table and add class
    let table = dataTable.append("table");
    table.attr("class", "dataTableClass");

    // TODO: add headers, row & columns
    let headRow = table.append("tr");
    _data.columns.forEach(dimension => headRow.append("th").attr("class", "tableHeaderClass").text(dimension));
    _data.forEach(row => {
        let bodyRow = table.append("tr");
        _data.columns.forEach(dimension =>
            bodyRow
                .append("td")
                .attr("class", "tableBodyClass")
                .text(row[dimension]));
    })

    // TODO: add mouseover event
    table.selectAll("td")
        .on("mouseover", addColorOnHover)
        .on("mouseout", removeColorOnStopHover);
    
    function addColorOnHover(e) {
        e.target.classList.add("blueBg")
    }
    function removeColorOnStopHover(e) {
        e.target.classList.remove("blueBg")
    };
}
function renderScatterplot(){

    // TODO: get domain names from menu and label x- and y-axis
    let xDimension = readMenu(channels[0]);
    let yDimension = readMenu(channels[1]);
    let rDimension = readMenu(channels[2]);
    xAxisLabel.text(xDimension);
    yAxisLabel.text(yDimension);
    
    // TODO: re-render axes
    let x = d3.scaleLinear()
        .domain([domain[xDimension][0], domain[xDimension][1]])
        .range([margin.left, width - margin.left - margin.right]);
    let y = d3.scaleLinear()
        .domain([domain[yDimension][0], domain[yDimension][1]])
        .range([height - margin.bottom - margin.top, margin.top]);
    let r = d3.scaleLinear()
        .domain([domain[rDimension][0], domain[rDimension][1]])
        .range([0, 15]);
    
    xAxis.transition().duration(500)
        .call(d3.axisBottom(x))
    yAxis.transition().duration(500)
        .call(d3.axisLeft(y));
    
    // TODO: render dots
    scatter.select(".nodes").selectAll("circle")
        .transition().duration(500)
        .attr("cx", d => x(d[xDimension]))
        .attr("cy", d => y(d[yDimension]))
        .attr("r", d => r(d[rDimension]));
}

function renderRadarChart() {
    // TODO: show selected items in legend
    let legendItem = legend.selectAll(".legend-item")
        .data(radarData, d=> d[1])
    
    legendItem.exit().remove();

    legendItem = legendItem.enter()
        .append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "20px")
        .style("height", "22px");
    
    legendItem.append("button").attr("class", "close").text("X").on("click", handleRemovalRadar)
    legendItem.append("div")
    .style("background-color", d => d[1])
    .attr("class","color-circle");
    legendItem.append("p").text(d=>d[0][label]);

    // TODO: render polylines in a unique color
    let radarItem = radar.selectAll(".radar-item")
        .data(radarData, d => d[1]);
    
    radarItem.exit().remove();

    radarItem = radarItem.enter()
        .append("g")
        .attr("class", "radar-item");
    
    radarItem.append("polyline").attr("points", (d) => {
        let a = dimensions.map((val, index) => {
            let axisRadius = d3.scaleLinear()
                .domain([domain[val][0], domain[val][1]])
                .range([0, radius]);
            return [radarX(axisRadius(d[0][val]) * 0.75, index), radarY(axisRadius(d[0][val]) * 0.75, index)];
        })
        return a.reduce((acc, val) => acc + val[0] + ',' + val[1] + ' ', "") + " " + a[0][0] + ',' + a[0][1];
        }).attr("stroke", d => d[1])
        .attr("fill-opacity", 0)
        .attr("stroke-width", 3);  
    
    dimensions.forEach((val, index) => {
        let axisRadius = d3.scaleLinear()
            .domain([domain[val][0], domain[val][1]])
            .range([0, radius]);
        radarItem.append("circle")
            .attr("cx", d => radarX(axisRadius(d[0][val]) * 0.75, index))
            .attr("cy", d => radarY(axisRadius(d[0][val]) * 0.75, index))
            .attr("r", 5)
            .attr("fill", d => d[1])
    })
}
function handleRemovalRadar(e, d) {
    console.log(d);
    console.log(radarData);
    radarData = radarData.filter(ele => ele[1] !== d[1]);
    console.log(radarData);

    colors.push(d[1]);
    scatter.select(".nodes").selectAll("circle")
        .filter(sd => sd === d[0])
        .attr("fill", "black")
        .attr("fill-opacity", 0.2);
    renderRadarChart();
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
