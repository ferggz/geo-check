const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get("/", (req, res) => {
  res.json({ message: "GeoCheck API running" });
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ databaseTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.get("/locations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        title,
        description,
        status,
        latitude,
        longitude,
        created_at
      FROM locations
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

app.post("/locations", async (req, res) => {
  const { title, description, status, latitude, longitude } = req.body;

  if (!title || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: "Title, latitude and longitude are required",
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO locations (
        title,
        description,
        status,
        latitude,
        longitude,
        geom
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        ST_SetSRID(ST_MakePoint($5, $4), 4326)
      )
      RETURNING *
      `,
      [title, description, status || "pending", latitude, longitude]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create location" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});