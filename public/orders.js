function filterOrders() {
  const filters = {
    orderId: document.getElementById("orderSearch").value.trim(),
    customerId: document.getElementById("customerFilter").value,
    employeeId: document.getElementById("employeeFilter").value,
    supplierId: document.getElementById("supplierFilter").value,
    shipperId: document.getElementById("shipperFilter").value,
    productId: document.getElementById("productFilter").value,
    minPrice: parseFloat(document.getElementById("minPrice").value) || 0,
    maxPrice: parseFloat(document.getElementById("maxPrice").value) || Infinity,
  };

  const rows = document.querySelectorAll("#ordersTable tbody tr");
  let visibleCount = 0;

  rows.forEach((row) => {
    const rowData = {
      orderId: row.getAttribute("data-orderid"),
      customerId: row.getAttribute("data-customer"),
      employeeId: row.getAttribute("data-employee"),
      supplierId: row.getAttribute("data-supplier"),
      shipperId: row.getAttribute("data-shipper"),
      productId: row.getAttribute("data-product"),
      price: parseFloat(row.getAttribute("data-price")),
    };

    const isVisible =
      (!filters.orderId ||
        row
          .querySelector("td:nth-child(2)")
          .textContent.includes(filters.orderId)) &&
      (!filters.customerId || rowData.customerId === filters.customerId) &&
      (!filters.employeeId || rowData.employeeId === filters.employeeId) &&
      (!filters.supplierId || rowData.supplierId === filters.supplierId) &&
      (!filters.shipperId || rowData.shipperId === filters.shipperId) &&
      (!filters.productId || rowData.productId === filters.productId) &&
      rowData.price >= filters.minPrice &&
      rowData.price <= filters.maxPrice;

    row.style.display = isVisible ? "" : "none";
    if (isVisible) visibleCount++;
  });

  document.getElementById("no-results").style.display =
    visibleCount > 0 ? "none" : "block";
}
