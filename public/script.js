function searchTable(inputId, tableSelector) {
    const input = document.getElementById(inputId);
    const searchTerm = input.value.trim().toUpperCase();
    const table = document.querySelector(tableSelector);
    const noResults = document.getElementById('no-results');
    
    if (!table) return;

    const rows = table.querySelectorAll("tbody tr");
    let hasMatches = false;

    rows.forEach(row => {
        const nameCell = row.querySelector("td:nth-child(2)"); // Customer Name column
        if (nameCell) {
            const cellText = (nameCell.textContent || nameCell.innerText).toUpperCase();
            const isMatch = cellText.includes(searchTerm);
            function searchTable(inputId, tableSelector) {
                console.log("Search function triggered"); // Debug 1
                
                const input = document.getElementById(inputId);
                const searchTerm = input.value.trim().toUpperCase();
                console.log("Search term:", searchTerm); // Debug 2
                
                const table = document.querySelector(tableSelector);
                if (!table) {
                    console.error("Table not found with selector:", tableSelector);
                    return;
                }
            
                const rows = table.querySelectorAll("tbody tr");
                console.log("Total rows found:", rows.length); // Debug 3
                
                let hasMatches = false;
                let visibleCount = 0;
            
                rows.forEach((row, index) => {
                    const nameCell = row.querySelector("td:nth-child(2)");
                    if (!nameCell) {
                        console.warn("Name cell not found in row", index); // Debug 4
                        return;
                    }
            
                    const cellText = (nameCell.textContent || nameCell.innerText).toUpperCase();
                    console.log(`Row ${index} text:`, cellText); // Debug 5
                    
                    const isMatch = cellText.includes(searchTerm);
                    row.style.display = isMatch ? "" : "none";
                    
                    if (isMatch) {
                        hasMatches = true;
                        visibleCount++;
                    }
                });
            
                console.log("Visible rows after search:", visibleCount); // Debug 6
                
                const noResults = document.getElementById('no-results');
                if (noResults) {
                    noResults.style.display = (hasMatches || !searchTerm) ? "none" : "block";
                    console.log("No results message visible:", noResults.style.display === "block"); // Debug 7
                }
            }
            
            // Initial check when page loads
            document.addEventListener('DOMContentLoaded', () => {
                console.log("Page loaded - running initial checks");
                
                const table = document.querySelector('.content-table');
                if (table) {
                    const rows = table.querySelectorAll("tbody tr");
                    console.log("Initial row count from database:", rows.length);
                    
                    rows.forEach((row, index) => {
                        const cells = row.querySelectorAll("td");
                        console.log(`Row ${index} data:`, {
                            id: cells[0]?.textContent,
                            name: cells[1]?.textContent,
                            contact: cells[2]?.textContent
                            // Add more fields as needed
                        });
                    });
                }
            });
            row.style.display = isMatch ? "" : "none";
            if (isMatch) hasMatches = true;
        }
    });

    // Handle no results message
    if (noResults) {
        noResults.style.display = (hasMatches || !searchTerm) ? "none" : "block";
    }
}