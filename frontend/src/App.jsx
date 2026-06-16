import { useEffect, useState } from "react";

function App() {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/locations")
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch((error) => console.error("Error fetching locations:", error));
  }, []);

  return (
    <main>
      <h1>GeoCheck</h1>

      <h2>Locations</h2>

      {locations.length === 0 ? (
        <p>No locations found.</p>
      ) : (
        <ul>
          {locations.map((location) => (
            <li key={location.id}>
              {location.title} — {location.latitude}, {location.longitude}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
