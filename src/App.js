import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import * as turf from '@turf/turf';
import './App.css';

function App() {
  const [geoData, setGeoData] = useState({ type: 'FeatureCollection', features: [] });
  const [selectionMode, setSelectionMode] = useState(false);
  const geoJsonLayerRef = useRef(null);
  const drawControlRef = useRef(null);
  const selectedLinesRef = useRef([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = JSON.parse(e.target.result);
      setGeoData(data);
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  const GeoJSONWithBounds = ({ data }) => {
    const map = useMap();
    React.useEffect(() => {
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.clearLayers();
      }
      const geoJsonLayer = L.geoJSON(data, {
        onEachFeature: (feature, layer) => {
          if (feature.geometry.type === "LineString") {
            layer.on('click', () => {
              if (selectionMode) {
                if (selectedLinesRef.current.includes(layer)) {
                  layer.setStyle({ color: '#3388ff' }); // Снимаем выделение
                  selectedLinesRef.current = selectedLinesRef.current.filter(l => l !== layer);
                } else {
                  layer.setStyle({ color: 'red' }); // Выделяем линию
                  selectedLinesRef.current.push(layer);
                }
              } else {
                console.log('LineString feature:', feature);
              }
            });
          }
        },
      });
      geoJsonLayerRef.current = geoJsonLayer;
      geoJsonLayer.addTo(map);
      if (data.features.length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
      }
    }, [data, map]);

    return null;
  };

  const clearGeoData = () => {
    setGeoData({ type: 'FeatureCollection', features: [] });
  };

  const initializeDrawControl = () => {
    const map = geoJsonLayerRef.current._map;
    if (!drawControlRef.current) {
      drawControlRef.current = new L.Control.Draw({
        edit: {
          featureGroup: geoJsonLayerRef.current || new L.FeatureGroup().addTo(map),
        },
        draw: {
          polyline: true,
          polygon: false,
          circle: false,
          marker: false,
          rectangle: false,
        },
      });
      map.addControl(drawControlRef.current);
    }

    map.on(L.Draw.Event.CREATED, (event) => {
      const layer = event.layer;
      const drawnFeature = layer.toGeoJSON();

      // Добавляем новую линию в geoData
      setGeoData((prevGeoData) => ({
        type: 'FeatureCollection',
        features: [...prevGeoData.features, drawnFeature],
      }));

      // Добавляем слой на карту и в geoJsonLayer
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.addLayer(layer);
        layer.on('click', () => {
          console.log('Drawn LineString layer:', layer.toGeoJSON());
        });
      } else {
        geoJsonLayerRef.current = new L.FeatureGroup().addTo(map);
        geoJsonLayerRef.current.addLayer(layer);
      }
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    selectedLinesRef.current.forEach(layer => layer.setStyle({ color: '#3388ff' })); // Снимаем выделение с линий
    selectedLinesRef.current = [];
  };

  const createPolygonFromSelectedLines = () => {
    if (selectedLinesRef.current.length > 1) {
      const lineFeatures = selectedLinesRef.current.map(layer => layer.toGeoJSON());
      const allCoordinates = [];
      const allLines = [];

      lineFeatures.forEach((line) => {
        allCoordinates.push(...line.geometry.coordinates);
        allLines.push(line.geometry.coordinates)
      });

      // Проверяем, что есть хотя бы два уникальных координатных пункта
      if (allCoordinates.length < 2) {
        console.error('Not enough coordinates to create a polygon');
        return;
      }
      console.log("все координаты",allCoordinates)
      console.log("все линии",allLines)
      const combined = turf.lineString(allCoordinates);
      console.log("всё вместе",combined)
      const polygon = turf.lineToPolygon(combined, { autoComplete: true, orderCoords: true });

      if (polygon) {
        setGeoData((prevGeoData) => ({
          type: 'FeatureCollection',
          features: [...prevGeoData.features, polygon],
        }));
      }

      selectedLinesRef.current.forEach(layer => geoJsonLayerRef.current.removeLayer(layer));
      selectedLinesRef.current = [];
    }
  };

  return (
    <div className="App">
      <h2>GeoJSON Map Viewer</h2>
      <input type="file" accept=".geojson" onChange={handleFileUpload} />
      <button onClick={clearGeoData}>Clear GeoJSON Data</button>
      <button onClick={initializeDrawControl}>Draw Line</button>
      <button onClick={toggleSelectionMode}>{selectionMode ? 'Exit Selection Mode' : 'Enter Selection Mode'}</button>
      <button onClick={createPolygonFromSelectedLines} disabled={!selectionMode}>Create Polygon from Selected Lines</button>
      <div className="map-container">
        <MapContainer 
          style={{ height: "500px", width: "100%" }} 
          center={[51.505, -0.09]} 
          zoom={13} 
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {geoData && <GeoJSONWithBounds data={geoData} />}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;