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
    console.error(error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

app.post("/locations", async (req, res) => {
  const { title, description, status, latitude, longitude } = req.body;

  const allowedStatuses = ["pending", "in_progress", "resolved"];

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

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

app.delete("/locations/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM locations WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete location" });
  }
});

app.patch("/locations/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  console.log("Updating location", id, "to status", status);

  const allowedStatuses = ["pending", "in_progress", "resolved"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await pool.query(
      "UPDATE locations SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update location status" });
  }
});

app.put("/locations/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, latitude, longitude } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE locations
      SET title = $1,
          description = $2,
          latitude = $3,
          longitude = $4,
          geom = ST_SetSRID(ST_MakePoint($4, $3), 4326)
      WHERE id = $5
      RETURNING *
      `,
      [title, description, latitude, longitude, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});