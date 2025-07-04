export async function loadData() {
    const data = await d3.csv("../DataCleaning/cleanData.csv");
    console.log("success");
    console.log(data);
    return data;
}
  