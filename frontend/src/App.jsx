import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import "./App.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat, toLonLat } from "ol/proj";
import Style from "ol/style/Style";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Overlay from "ol/Overlay";
import { defaults as defaultInteractions } from "ol/interaction/defaults";

function App() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vectorSourceRef = useRef(new VectorSource());
  const popupRef = useRef(null);
  const popupContentRef = useRef(null);
  const [locations, setLocations] = useState([]);

  const [selectedCoordinates, setSelectedCoordinates] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending",
    latitude: "",
    longitude: "",
  });
  const getMarkerStyle = (status) => {
    const color =
      status === "resolved"
        ? "green"
        : status === "in_progress"
        ? "orange"
        : "red";

    return new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color }),
        stroke: new Stroke({
          color: "white",
          width: 2,
        }),
      }),
    });
  };

  const fetchLocations = () => {
    fetch("http://localhost:3000/locations")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setLocations(data))
      .catch((error) => console.error("Error fetching locations:", error));
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const deleteLocation = async (id) => {
    await fetch(`http://localhost:3000/locations/${id}`, {
      method: "DELETE",
    });

    fetchLocations();
  };

  const updateStatus = async (id, status) => {
    await fetch(`http://localhost:3000/locations/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    fetchLocations();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      alert("Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.");
      return;
    }

    await fetch("http://localhost:3000/locations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formData,
        latitude,
        longitude,
      }),
    });

    setFormData({
      title: "",
      description: "",
      status: "pending",
      latitude: "",
      longitude: "",
    });

    setSelectedCoordinates(null);
    fetchLocations();

    mapInstanceRef.current.getView().animate({
      center: fromLonLat([longitude, latitude]),
      zoom: 14,
      duration: 1000,
    });
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new Map({
      target: mapRef.current,
      interactions: defaultInteractions({
        doubleClickZoom: false,
      }),
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source: vectorSourceRef.current }),
      ],
      view: new View({
        center: fromLonLat([-7.096, 42.006]),
        zoom: 12,
      }),
    });

    map.on("dblclick", (event) => {
      const [longitude, latitude] = toLonLat(event.coordinate);

      setSelectedCoordinates({
        latitude,
        longitude,
      });

      setFormData((prevFormData) => ({
        ...prevFormData,
        latitude,
        longitude,
      }));
    });

    const popup = new Overlay({
      element: popupRef.current,
      positioning: "bottom-center",
      stopEvent: false,
      offset: [0, -15],
    });

    map.addOverlay(popup);

    map.on("click", (event) => {
      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => feature
      );

      if (!feature) {
        popup.setPosition(undefined);
        return;
      }

      const { title, description, status } = feature.getProperties();

      popupContentRef.current.innerHTML = `
        <strong>${title}</strong><br />
        Status: ${status}<br />
        ${description || ""}
      `;

      popup.setPosition(event.coordinate);
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
      });

      feature.setProperties({
        title: location.title,
        description: location.description,
        status: location.status,
      });

      feature.setStyle(getMarkerStyle(location.status));

      vectorSourceRef.current.addFeature(feature);
    });
  }, [locations]);

  return (
    <main>
      <h1>GeoCheck</h1>
      <p>Click on the map to add a location.</p>

      <div className="app-layout">
        <div ref={mapRef} className="map" />

        <aside className="sidebar">
          <h2>New location</h2>

          <p>Double click on the map or enter coordinates manually.</p>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(event) =>
                setFormData({ ...formData, title: event.target.value })
              }
              required
            />

            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
            />

            <select
              value={formData.status}
              onChange={(event) =>
                setFormData({ ...formData, status: event.target.value })
              }
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={formData.latitude}
              onChange={(event) =>
                setFormData({ ...formData, latitude: event.target.value })
              }
              required
            />

            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={formData.longitude}
              onChange={(event) =>
                setFormData({ ...formData, longitude: event.target.value })
              }
              required
            />

            <button type="submit">Save location</button>
          </form>
        </aside>
      </div>

      <div
        ref={popupRef}
        style={{
          background: "white",
          padding: "10px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          minWidth: "200px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        <div ref={popupContentRef}></div>
      </div>

      <h2>Locations</h2>

      {locations.length === 0 ? (
        <p>No locations found.</p>
      ) : (
        <ul>
          {locations.map((location) => (
            <li className="location-item" key={location.id}>
              <strong>{location.title}</strong> [{location.status}] —{" "}
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {location.description && <p>{location.description}</p>}
              <button onClick={() => deleteLocation(location.id)}>Delete</button>
              <select
                value={location.status}
                onChange={(event) => updateStatus(location.id, event.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
