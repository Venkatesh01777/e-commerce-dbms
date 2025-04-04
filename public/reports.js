document.addEventListener("DOMContentLoaded", function () {
  function createChart(canvasId, type, labels, data, labelText, bgColor) {
    new Chart(document.getElementById(canvasId), {
      type: type,
      data: {
        labels: labels,
        datasets: [
          {
            label: labelText,
            data: data,
            backgroundColor: bgColor,
            borderColor: "black",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales:
          type === "bar" || type === "line"
            ? {
                y: { beginAtZero: true },
              }
            : {},
      },
    });
  }

  const salesTrends = JSON.parse(
    document.getElementById("sales-trends").textContent
  );
  const bestProducts = JSON.parse(
    document.getElementById("best-products").textContent
  );
  const topCustomers = JSON.parse(
    document.getElementById("top-customers").textContent
  );
  const employeeOrders = JSON.parse(
    document.getElementById("employee-orders").textContent
  );
  const shipperOrders = JSON.parse(
    document.getElementById("shipper-orders").textContent
  );

  // 📊 Monthly Sales Trends (Line Chart)
  createChart(
    "salesChart",
    "line",
    salesTrends.map((row) => row.month),
    salesTrends.map((row) => row.total_revenue),
    "Monthly Revenue",
    "blue"
  );

  // 🥧 Best-Selling Products (Pie Chart)
  createChart(
    "bestProductsChart",
    "pie",
    bestProducts.map((row) => row.productname),
    bestProducts.map((row) => row.total_sold),
    "Best-Selling Products",
    [
      "red",
      "green",
      "blue",
      "yellow",
      "orange",
      "purple",
      "teal",
      "pink",
      "gray",
      " indigo",
    ]
  );

  // 📊 Top Customers (Horizontal Bar Chart)
  createChart(
    "topCustomersChart",
    "bar",
    topCustomers.map((row) => row.customername),
    topCustomers.map((row) => row.total_orders),
    "Top Customers",
    ["orange", "purple", "teal", "pink", "gray"]
  );

  // 📉 Orders Processed by Employees (Radar Chart)
  createChart(
    "employeeOrdersChart",
    "radar",
    employeeOrders.map((row) => row.employee_name),
    employeeOrders.map((row) => row.total_orders),
    "Orders by Employees",
    ["rgba(75, 192, 192, 0.4)"]
  );

  // 🍩 Orders by Shippers (Doughnut Chart)
  createChart(
    "shipperOrdersChart",
    "doughnut",
    shipperOrders.map((row) => row.shippername),
    shipperOrders.map((row) => row.total_orders),
    "Orders by Shippers",
    ["red", "blue", "green", "yellow", "purple"]
  );
});
