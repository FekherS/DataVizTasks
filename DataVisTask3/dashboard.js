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

// TODO: File for Part 2
// TODO: You can edit this file as you wish - add new methods, variables etc. or change/delete existing ones.

// TODO: use descriptive names for variables
function initDashboard(_data) {
    console.log(_data.columns);
    createChart123(_data);
    createChart4(_data);
}

// clear files if changes (dataset) occur
function clearDashboard() {
    d3.select("#chart1").selectAll("*").remove();
    d3.select("#chart2").selectAll("*").remove();
    d3.select("#chart3").selectAll("*").remove();
    d3.select("#chart4").selectAll("*").remove();
    d3.select('#controls').selectAll("*").remove();
    d3.select("#chart3-legend").selectAll("*").remove();
}