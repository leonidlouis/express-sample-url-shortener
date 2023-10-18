const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// QUERY TO RUN:
// CREATE TABLE urls (
//     id SERIAL PRIMARY KEY,
//     original_url TEXT NOT NULL,
//     short_code VARCHAR(6) NOT NULL UNIQUE
// );

function createShortUrl(url) {
  // Append the current timestamp to the URL and hash it
  const hash = crypto
    .createHash("sha256")
    .update(url + Date.now())
    .digest("hex");

  // Convert the hash to base-62 and get the first 6 characters
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let base62Str = "";
  let num = BigInt("0x" + hash);

  for (let i = 0; i < 6; i++) {
    base62Str = chars.charAt(Number(num % 62n)) + base62Str;
    num /= 62n;
  }

  return base62Str;
}

const app = express();
const port = 3000;

// Database setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.use(express.json());

app.get("/:short_code", async (req, res) => {
  const { short_code } = req.params;

  try {
    const result = await pool.query(
      "SELECT original_url FROM urls WHERE short_code = $1",
      [short_code]
    );
    const data = result.rows[0];

    if (!data) {
      return res.status(404).send("Short code not found");
    }

    // Redirect to the original URL
    res.status(302).location(data.original_url).end();
  } catch (error) {
    res.status(500).send("Error retrieving from database");
  }
});

// Create a short URL
app.post("/api/shorten", async (req, res) => {
  const { original_url } = req.body;

  if (!original_url) {
    return res.status(400).send("Original URL is required");
  }

  // Generate a short code (you can make this more sophisticated)
  const short_code = createShortUrl(original_url);

  try {
    const result = await pool.query(
      "INSERT INTO urls (original_url, short_code) VALUES ($1, $2) RETURNING *",
      [original_url, short_code]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).send("Error saving to database");
  }
});

// Retrieve original URL by shortcode
app.get("/api/:short_code", async (req, res) => {
  const { short_code } = req.params;

  try {
    const result = await pool.query(
      "SELECT original_url FROM urls WHERE short_code = $1",
      [short_code]
    );
    const data = result.rows[0];

    if (!data) {
      return res.status(404).send("Short code not found");
    }

    res.json(data);
  } catch (error) {
    res.status(500).send("Error retrieving from database");
  }
});

// Update a short URL (by its short_code)
app.put("/api/:short_code", async (req, res) => {
  const { short_code } = req.params;
  const { original_url } = req.body;

  if (!original_url) {
    return res.status(400).send("Original URL is required for update");
  }

  try {
    const result = await pool.query(
      "UPDATE urls SET original_url = $1 WHERE short_code = $2 RETURNING *",
      [original_url, short_code]
    );
    const data = result.rows[0];

    if (!data) {
      return res.status(404).send("Short code not found");
    }

    res.json(data);
  } catch (error) {
    res.status(500).send("Error updating in database");
  }
});

// Delete a short URL (by its short_code)
app.delete("/api/:short_code", async (req, res) => {
  const { short_code } = req.params;

  try {
    await pool.query("DELETE FROM urls WHERE short_code = $1", [short_code]);
    res.status(200).send("Short URL deleted successfully");
  } catch (error) {
    res.status(500).send("Error deleting from database");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
