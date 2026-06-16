import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat, toLonLat } from "ol/proj";

function App() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vectorSourceRef = useRef(new VectorSource());
  const [locations, setLocations] = useState([]);

  const fetchLocations = () => {
    fetch("http://localhost:3000/locations")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setLocations(data))
      .catch((error) => console.error("Error fetching locations:", error));
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source: vectorSourceRef.current }),
      ],
      view: new View({
        center: fromLonLat([-7.096, 42.006]),
        zoom: 12,
      }),
    });

    map.on("click", async (event) => {
      const [longitude, latitude] = toLonLat(event.coordinate);
      const title = prompt("Location title:");

      if (!title) return;

      await fetch("http://localhost:3000/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          latitude,
          longitude,
        }),
      });

      fetchLocations();
    });

    mapInstanceRef.current = map;
  }, []);

  useEffect(() => {
    vectorSourceRef.current.clear();

    locations.forEach((location) => {
      const feature = new Feature({
        geometry: new Point(
          fromLonLat([location.longitude, location.latitude])
        ),
        title: location.title,
      });

      vectorSourceRef.current.addFeature(feature);
    });
  }, [locations]);

  return (
    <main>
      <h1>GeoCheck</h1>
      <p>Click on the map to add a location.</p>

      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "500px",
          border: "1px solid #ccc",
        }}
      />

      <h2>Locations</h2>

      {locations.length === 0 ? (
        <p>No locations found.</p>
      ) : (
        <ul>
          {locations.map((location) => (
            <li key={location.id}>
              {location.title} — {location.latitude.toFixed(5)},{" "}
              {location.longitude.toFixed(5)}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
