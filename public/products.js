// Initialize filters when page loads
document.addEventListener("DOMContentLoaded", function () {
  // Get all unique categories and suppliers from the table
  const categories = new Set();
  const suppliers = new Set();

  document.querySelectorAll(".content-table tbody tr").forEach((row) => {
    categories.add(row.querySelector("td:nth-child(4)").textContent.trim());
    suppliers.add(row.querySelector("td:nth-child(3)").textContent.trim());
  });

  // Populate category filter
  const categorySelect = document.getElementById("categoryFilter");
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  // Populate supplier filter
  const supplierSelect = document.getElementById("supplierFilter");
  suppliers.forEach((supplier) => {
    const option = document.createElement("option");
    option.value = supplier;
    option.textContent = supplier;
    supplierSelect.appendChild(option);
  });
});

function filterProducts() {
  const searchTerm = document
    .getElementById("productSearch")
    .value.toLowerCase();
  const categoryFilter = document.getElementById("categoryFilter").value;
  const supplierFilter = document.getElementById("supplierFilter").value;
  const minPrice = parseFloat(document.getElementById("minPrice").value) || 0;
  const maxPrice =
    parseFloat(document.getElementById("maxPrice").value) || Infinity;

  const rows = document.querySelectorAll(".content-table tbody tr");
  let visibleCount = 0;

  rows.forEach((row) => {
    const name = row.querySelector("td:nth-child(2)").textContent.toLowerCase();
    const category = row.querySelector("td:nth-child(4)").textContent.trim();
    const supplier = row.querySelector("td:nth-child(3)").textContent.trim();
    const price = parseFloat(
      row.querySelector("td:nth-child(6)").textContent.replace(/[^0-9.-]/g, "")
    );

    const matchesSearch = name.includes(searchTerm);
    const matchesCategory = !categoryFilter || category === categoryFilter;
    const matchesSupplier = !supplierFilter || supplier === supplierFilter;
    const matchesPrice = price >= minPrice && price <= maxPrice;

    if (matchesSearch && matchesCategory && matchesSupplier && matchesPrice) {
      row.style.display = "";
      visibleCount++;
    } else {
      row.style.display = "none";
    }
  });

  // Update no results message
  const noResults = document.getElementById("no-results");
  if (noResults) {
    noResults.style.display = visibleCount > 0 ? "none" : "block";
  }
}
