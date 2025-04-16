//backend server
import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import session from "express-session";
import flash from "express-flash";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = 3000;
dotenv.config();

// const pool = new pg.Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT,
// });

// PostgreSQL connection for neon db
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Neon SSL
  },
});

// Test database connection
pool
  .connect()
  .then((client) => {
    console.log("Connected to PostgreSQL database");
    client.release(); // Important: release the client back to the pool
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1); // Exit if connection fails
  });

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);
app.use(flash());
// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport local strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE username = $1 AND is_active = true",
        [username]
      );

      if (rows.length === 0) {
        return done(null, false, {
          message: "Invalid credentials or account inactive",
        });
      }

      const user = rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Serialize/deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Routes
app.get("/", ensureAuthenticated, (req, res) => {
  res.render("home", { user: req.user });
});

app.get("/login", (req, res) => {
  res.render("login", { message: req.flash("error") });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect("/");
    }
    req.flash("success", "You have been logged out");
    res.redirect("/login");
  });
});

app.get("/register", ensureAuthenticated, async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      "SELECT id, username, is_admin, is_active FROM users ORDER BY username"
    );

    // Get flash messages
    const errorMessage = req.flash("error")[0];
    const successMessage = req.flash("success")[0];

    res.render("register", {
      user: req.user,
      users: users,
      errorMessage: errorMessage, // Pass error message to template
      successMessage: successMessage, // Pass success message to template
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
app.post("/register", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  try {
    // Validate inputs
    if (!username || !password) {
      req.flash("error", "Username and password are required");
      return res.redirect("/register");
    }

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match");
      return res.redirect("/register");
    }

    // Check if user exists
    const userExists = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (userExists.rows.length > 0) {
      req.flash("error", "Username already exists");
      return res.redirect("/register");
    }

    // Hash password and create user
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
      username,
      hashedPassword,
    ]);

    req.flash("success", "Registration successful!");
    res.redirect("/register");
  } catch (err) {
    console.error("Registration error:", err);
    req.flash("error", "Registration failed");
    res.redirect("/register");
  }
});
app.post("/admin/toggle-user", ensureAuthenticated, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).send("Forbidden");
  }

  const { userId } = req.body;

  // Prevent self-deactivation
  if (userId == req.user.id) {
    req.flash("error", "Cannot modify your own status");
    return res.redirect("/register");
  }

  try {
    await pool.query(
      "UPDATE users SET is_active = NOT is_active WHERE id = $1",
      [userId]
    );
    req.flash("success", "User status updated");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update user");
  }
  res.redirect("/register");
});

app.post("/admin/toggle-admin", ensureAuthenticated, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).send("Forbidden");
  }

  const { userId } = req.body;

  // Prevent self-admin removal
  if (userId == req.user.id) {
    req.flash("error", "Cannot modify your own admin status");
    return res.redirect("/register");
  }

  try {
    await pool.query("UPDATE users SET is_admin = NOT is_admin WHERE id = $1", [
      userId,
    ]);
    req.flash("success", "Admin status updated");
  } catch (err) {
    console.error(err);
    req.flash("error", "Failed to update admin status");
  }
  res.redirect("/register");
});
// Protected routes
app.get("/products", ensureAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.productid, p.productname, s.suppliersname, c.categoryname, p.unit, p.price 
      FROM products p
      JOIN suppliers s ON p.suppliersid = s.supplierid
      JOIN categories c ON p.categoryid = c.categoryid
      ORDER BY productid
    `);
    res.render("products", { products: rows, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/customers", ensureAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT customerid, customername, contractname, 
             address, city, postalcode, country 
      FROM customers
      ORDER BY customerid
    `);
    res.render("customers", { customers: rows, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/employees", ensureAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT employeeid, lastname, firstname, 
             birthdate, photo, notes
      FROM employees
      ORDER BY employeeid
    `);
    res.render("employees", { employees: rows, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/suppliers", ensureAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT supplierid, suppliersname, contactname, address, city, postalcode
             country, phone
      FROM suppliers
      ORDER BY supplierid
    `);
    res.render("suppliers", { suppliers: rows, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/shippers", ensureAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT shipperid, shippername, 
             phone
      FROM shippers
      ORDER BY shipperid
    `);
    res.render("shippers", { shippers: rows, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/orders", ensureAuthenticated, async (req, res) => {
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

  const [customers, employees, suppliers, shippers, products] =
    await Promise.all([
      pool.query("SELECT customerid, customername FROM customers"),
      pool.query("SELECT employeeid, firstname, lastname FROM employees"),
      pool.query("SELECT supplierid, suppliersname FROM suppliers"),
      pool.query("SELECT shipperid, shippername FROM shippers"),
      pool.query("SELECT productid, productname FROM products"),
    ]);

  res.render("orders", {
    orders: orders.rows,
    customers: customers.rows,
    employees: employees.rows,
    suppliers: suppliers.rows,
    shippers: shippers.rows,
    products: products.rows,
    user: req.user,
  });
});

app.get("/reports", ensureAuthenticated, async (req, res) => {
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
      summaryStats: summaryStats.rows[0],
      user: req.user,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

app.get("/ai-query", ensureAuthenticated, (req, res) => {
  res.render("ai-query", { user: req.user });
});

app.post("/api/ai-query", ensureAuthenticated, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Step 1: Generate SQL query using Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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
      
      Return ONLY the SQL query with no additional explanation or formatting. 
      read "ordersdetails" properly.


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

// Create initial admin user if not exists (for development)
async function createInitialUser() {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE username = 'admin'"
    );
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await pool.query(
        "INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3)",
        ["admin", hashedPassword, true]
      );
      console.log("Initial admin user created");
    }
  } catch (err) {
    console.error("Error creating initial user:", err);
  }
}

// Create users table if not exists
async function setupDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("Users table created or already exists");
    await createInitialUser();
  } catch (err) {
    console.error("Error setting up database:", err);
  }
}

setupDatabase().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
//added new change