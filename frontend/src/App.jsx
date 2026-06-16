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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedCoordinates, setSelectedCoordinates] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending",
    latitude: "",
    longitude: "",
  });

  const [editingLocationId, setEditingLocationId] = useState(null);

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

  const filteredLocations = locations.filter((location) => {
    const matchesSearch = location.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || location.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: locations.length,
    pending: locations.filter((l) => l.status === "pending").length,
    inProgress: locations.filter((l) => l.status === "in_progress").length,
    resolved: locations.filter((l) => l.status === "resolved").length,
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

  const focusLocation = (location) => {
    mapInstanceRef.current.getView().animate({
      center: fromLonLat([location.longitude, location.latitude]),
      zoom: 15,
      duration: 800,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    const url = editingLocationId
      ? `http://localhost:3000/locations/${editingLocationId}`
      : "http://localhost:3000/locations";

    const method = editingLocationId ? "PUT" : "POST";

    await fetch(url, {
      method,
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

    setEditingLocationId(null);
    setSelectedCoordinates(null);
    fetchLocations();
  };

  const handleCancel = () => {
    setFormData({
      title: "",
      description: "",
      status: "pending",
      latitude: "",
      longitude: "",
    });

    setSelectedCoordinates(null);
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
      <div className="stats-container">
        <div className="stat-card">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="stat-card">
          <span>Pending</span>
          <strong>{stats.pending}</strong>
        </div>

        <div className="stat-card">
          <span>In progress</span>
          <strong>{stats.inProgress}</strong>
        </div>

        <div className="stat-card">
          <span>Resolved</span>
          <strong>{stats.resolved}</strong>
        </div>
      </div>
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

            <button type="submit">
              {editingLocationId ? "Update location" : "Save location"}
            </button>
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
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

      <input
        type="text"
        placeholder="Search locations..."
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />

      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
      >
        <option value="all">All statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
      </select>

      <p className="locations-hint">
        Click a location to center it on the map.
      </p>

      {filteredLocations.length === 0 ? (

      <p>No locations found.</p>
      ) : (
        <ul>
          {filteredLocations.map((location) => (
            <li
              className="location-item"
              key={location.id}
              onClick={() => focusLocation(location)}
            >
              <strong>{location.title}</strong> [{location.status}] —{" "}
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {location.description && <p>{location.description}</p>}

              <div className="location-actions">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    setEditingLocationId(location.id);

                    setFormData({
                      title: location.title,
                      description: location.description || "",
                      status: location.status,
                      latitude: location.latitude,
                      longitude: location.longitude,
                    });
                  }}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteLocation(location.id);
                  }}
                >
                  Delete
                </button>

                <select
                  value={location.status}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    updateStatus(location.id, event.target.value);
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
