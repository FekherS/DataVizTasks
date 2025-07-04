import initChart1 from "./js/chart1.js";
import initChart2 from "./js/chart2.js";
import initChart3 from "./js/chart3.js";
import { loadData } from "./js/dataLoader.js";

loadData().then(data => {    
    initChart1(data);
    initChart2(data);
    initChart3(data);
}).catch(err => console.error(err))