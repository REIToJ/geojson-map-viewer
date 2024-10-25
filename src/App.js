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
        pointToLayer: () => null, // Отключаем загрузку маркеров для точек
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

  const createConnectingLines = () => {
    if (selectedLinesRef.current.length > 1) {
      const lineFeatures = selectedLinesRef.current.map(layer => layer.toGeoJSON());
      const allFirstAndLastCoords = [];

      // Получаем все первые и последние координаты каждой линии
      lineFeatures.forEach((line) => {
        allFirstAndLastCoords.push(line.geometry.coordinates[0]);
        allFirstAndLastCoords.push(line.geometry.coordinates[line.geometry.coordinates.length - 1]);
      });

      // Храним уже соединенные точки, чтобы не создавать дубликаты соединений
      const connectedPoints = new Set();
      const map = geoJsonLayerRef.current._map;

      allFirstAndLastCoords.forEach((pointA, indexA) => {
        if (connectedPoints.has(indexA)) return;

        let minDistance = Infinity;
        let closestPointIndex = -1;
        let closestPoint = null;

        // Находим ближайшую точку, которая еще не была соединена
        allFirstAndLastCoords.forEach((pointB, indexB) => {
          if (indexA !== indexB && !connectedPoints.has(indexB)) {
            const distance = turf.distance(turf.point(pointA), turf.point(pointB));
            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = pointB;
              closestPointIndex = indexB;
            }
          }
        });

        if (closestPoint) {
          // Создаем новую линию между pointA и closestPoint
          const newLine = turf.lineString([pointA, closestPoint]);

          // Добавляем новую линию на карту
          const newLineLayer = L.geoJSON(newLine, { color: 'blue' }).addTo(map);

          // Добавляем новую линию в geoJsonLayer
          if (geoJsonLayerRef.current) {
            geoJsonLayerRef.current.addLayer(newLineLayer);
          }

          // Помечаем точки как соединенные
          connectedPoints.add(indexA);
          connectedPoints.add(closestPointIndex);
        }
      });
    }
  };

  const createPolygonFromLines = () => {
    if (geoJsonLayerRef.current) {
      const features = geoJsonLayerRef.current.toGeoJSON();
      const multiLineString = turf.featureCollection(features.features.filter(f => f.geometry.type === 'LineString'));

      // Используем polygonize для создания полигонов из замкнутых линий
      const polygons = turf.polygonize(multiLineString);

      if (polygons && polygons.features.length > 0) {
        // Добавляем полигоны на карту
        const map = geoJsonLayerRef.current._map;
        const polygonLayer = L.geoJSON(polygons, { color: 'green' }).addTo(map);
        geoJsonLayerRef.current.addLayer(polygonLayer);
      }
    }
  };

  return (
    <div className="App">
      <h2>GeoJSON Map Viewer</h2>
      <input type="file" accept=".geojson" onChange={handleFileUpload} />
      <button onClick={clearGeoData}>Clear GeoJSON Data</button>
      <button onClick={initializeDrawControl}>Draw Line</button>
      <button onClick={toggleSelectionMode}>{selectionMode ? 'Exit Selection Mode' : 'Enter Selection Mode'}</button>
      <button onClick={createConnectingLines} disabled={!selectionMode}>Create Connecting Lines</button>
      <button onClick={createPolygonFromLines}>Create Polygon from Lines</button>
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
