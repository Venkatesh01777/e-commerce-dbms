import express from 'express';
import pg from 'pg';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = 3000;
dotenv.config();

// PostgreSQL connection
const pool = new pg.Pool({  
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL database');
    client.release();  // Important: release the client back to the pool
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);  // Exit if connection fails
  });

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');  // You need this for res.render() to work
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get("/",(req,res)=>{
  res.render("home");
})

app.get('/products', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.productid, p.productname, s.suppliersname, c.categoryname, p.unit, p.price 
      FROM products p
      JOIN suppliers s ON p.suppliersid = s.supplierid
      JOIN categories c ON p.categoryid = c.categoryid
      ORDER BY productid
    `);
    res.render('products', { products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/customers', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT customerid, customername, contractname, 
             address, city, postalcode, country 
      FROM customers
      ORDER BY customerid
    `);
    res.render('customers', { customers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/employees', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT employeeid, lastname, firstname, 
             birthdate, photo, notes
      FROM employees
      ORDER BY employeeid
    `);
    res.render('employees', { employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/suppliers', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT supplierid, suppliersname, contactname, address, city, postalcode
             country, phone
      FROM suppliers
      ORDER BY supplierid
    `);
    res.render('suppliers', { suppliers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/shippers', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT shipperid, shippername, 
             phone
      FROM shippers
      ORDER BY shipperid
    `);
    res.render('shippers', { shippers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/orders', async (req, res) => {
  const orders = await pool.query(`
      SELECT 
          od.orderdetailid,  
          o.orderid,
          c.customerid,
          c.customername,
          e.employeeid,
          e.firstname || ' ' || e.lastname AS employeename,
          o.orderdate,
          s.shipperid,
          s.shippername,  
          p.productid,
          p.productname,
          od.quantity,
          p.price AS unitprice,
          sup.supplierid,
          sup.suppliersname  
      FROM ordersdetails od
      JOIN orders o ON od.orderid = o.orderid
      JOIN customers c ON o.customerid = c.customerid
      JOIN employees e ON o.employeeid = e.employeeid
      JOIN shippers s ON o.shipperid = s.shipperid
      JOIN products p ON od.productid = p.productid
      JOIN suppliers sup ON p.suppliersid = sup.supplierid  
      ORDER BY od.orderdetailid DESC
  `);
  
  const [customers, employees, suppliers, shippers, products] = await Promise.all([
      pool.query('SELECT customerid, customername FROM customers'),
      pool.query('SELECT employeeid, firstname, lastname FROM employees'),
      pool.query('SELECT supplierid, suppliersname FROM suppliers'),
      pool.query('SELECT shipperid, shippername FROM shippers'),
      pool.query('SELECT productid, productname FROM products')
  ]);

  res.render('orders', {
      orders: orders.rows,
      customers: customers.rows,
      employees: employees.rows,
      suppliers: suppliers.rows,
      shippers: shippers.rows,
      products: products.rows
  });
});

// Render reports page on GET /reports
app.get("/reports", async(req, res) => {
  try {
    const salesTrends = await pool.query(`
        SELECT 
            TO_CHAR(DATE_TRUNC('month', o.orderdate), 'YYYY-MM') AS month,
            SUM(od.quantity * p.price) AS total_revenue
        FROM public.orders o
        JOIN public.ordersdetails od ON o.orderid = od.orderid
        JOIN public.products p ON od.productid = p.productid
        GROUP BY month
        ORDER BY month;
    `);

    const bestProducts = await pool.query(`
        SELECT 
            p.productname, 
            SUM(od.quantity) AS total_sold
        FROM public.ordersdetails od
        JOIN public.products p ON od.productid = p.productid
        GROUP BY p.productname
        ORDER BY total_sold DESC
        LIMIT 10;
    `);

    const topCustomers = await pool.query(`
        SELECT 
            c.customername, 
            COUNT(o.orderid) AS total_orders
        FROM public.orders o
        JOIN public.customers c ON o.customerid = c.customerid
        GROUP BY c.customername
        ORDER BY total_orders DESC
        LIMIT 10;
    `);

    const employeeOrders = await pool.query(`
        SELECT 
            CONCAT(e.firstname, ' ', e.lastname) AS employee_name, 
            COUNT(o.orderid) AS total_orders
        FROM public.orders o
        JOIN public.employees e ON o.employeeid = e.employeeid
        GROUP BY employee_name
        ORDER BY total_orders DESC;
    `);

    const shipperOrders = await pool.query(`
        SELECT 
            s.shippername, 
            COUNT(o.orderid) AS total_orders
        FROM public.orders o
        JOIN public.shippers s ON o.shipperid = s.shipperid
        GROUP BY s.shippername
        ORDER BY total_orders DESC;
    `);

    const summaryStats = await pool.query(`
        SELECT 
            (SELECT COUNT(orderid) FROM public.orders) AS total_orders,
            (SELECT COUNT(DISTINCT customerid) FROM public.orders) AS total_customers,
            (SELECT SUM(od.quantity * p.price) FROM public.ordersdetails od JOIN public.products p ON od.productid = p.productid) AS total_revenue,
            (SELECT COUNT(productid) FROM public.products) AS total_products;
    `);

    res.render("reports", {
        salesTrends: salesTrends.rows,
        bestProducts: bestProducts.rows,
        topCustomers: topCustomers.rows,
        employeeOrders: employeeOrders.rows,
        shipperOrders: shipperOrders.rows,
        summaryStats: summaryStats.rows[0]
    });
} catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
}
});

app.post("/api/ai-query", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Step 1: Generate SQL query using Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro"  });

    const response = await model.generateContent(
      `You are a PostgreSQL expert. Generate SQL queries for a Northwind database with these tables:
      - products (productid, productname, suppliersid, categoryid, unit, price)
      - customers (customerid, customername, contractname, address, city, postalcode, country)
      - employees (employeeid, lastname, firstname, birthdate, photo, notes)
      - suppliers (supplierid, suppliersname, contactname, address, city, postalcode, country, phone)
      - shippers (shipperid, shippername, phone)
      - orders (orderid, customerid, employeeid, orderdate, shipperid)
      - ordersdetails (orderdetailid, orderid, productid, quantity)
      - categories (categoryid, categoryname, descriptiontext)
      
      Return ONLY the SQL query with no additional explanation or formatting.read ordersdetails properly.


      User request: ${prompt}`
    );

    let generatedQuery = response.response.text(); // Correct way to extract text
    generatedQuery = generatedQuery.replace(/```sql|```/g, "").trim();
    console.log("Generated SQL Query:", generatedQuery);
    // Step 2: Execute the generated query
    const { rows } = await pool.query(generatedQuery);

    // Step 3: Return results
    res.json({
      query: generatedQuery,
      data: rows,
    });
  } catch (err) {
    console.error("AI Query Error:", err);
    res.status(500).json({ error: "Failed to process AI query" });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));