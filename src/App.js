import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import simplify from 'simplify-js';
import { toWgs84 } from '@turf/projection';
import './App.css';

function App() {
  // Состояние для хранения данных GeoJSON и режима выбора
  const [geoData, setGeoData] = useState({ type: 'FeatureCollection', features: [] });
  const [selectionMode, setSelectionMode] = useState(false);
  const [parserMode, setParserMode] = useState(false);
  const geoJsonLayerRef = useRef(null);
  const drawControlRef = useRef(null);
  const selectedLinesRef = useRef([]);

  // Обработчик загрузки файла OSM
  const handleFileUploadOSM = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      let data = JSON.parse(e.target.result);
      setGeoData(data);
      setParserMode(false);
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  // Обработчик загрузки файла, конвертирующий данные в WGS84
  const handleFileUploadParser = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      let data = JSON.parse(e.target.result);
      data = convertToWgs84(data);
      setGeoData(data);
      setParserMode(true);
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  // Функция для конвертации координат в систему WGS84
  const convertToWgs84 = (geojson) => {
    try {
      return toWgs84(geojson);
    } catch (error) {
      console.error('Ошибка при преобразовании координат:', error);
      return geojson;
    }
  };

  // Компонент GeoJSON, который обновляет и отображает данные на карте
  const GeoJSONWithBounds = ({ data }) => {
    const map = useMap();
    React.useEffect(() => {
      if (geoJsonLayerRef.current) {
        geoJsonLayerRef.current.clearLayers();
      }
      const geoJsonLayer = L.geoJSON(data, {
        // Отключаем загрузку маркеров для точек
        pointToLayer: () => null,
        // Устанавливаем стили для исходных и созданных линий
        style: (feature) => {
          if (feature.properties && feature.properties.tag === 'created-line') {
            return { color: 'green' };
          } else if (feature.properties && feature.properties.tag === 'connecting-line') {
            return { color: 'green' };
          } else {
            return { color: '#3388ff' };
          }
        },
        // Обработка кликов по каждой геометрической сущности
        onEachFeature: (feature, layer) => {
          if (feature.geometry.type === "LineString") {
            layer.on('click', () => {
              if (selectionMode) {
                // Выделяем или снимаем выделение с линии в режиме выбора
                if (selectedLinesRef.current.includes(layer)) {
                  layer.setStyle({ color: '#3388ff' });
                  selectedLinesRef.current = selectedLinesRef.current.filter(l => l !== layer);
                } else {
                  layer.setStyle({ color: 'red' });
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

  // Очистка всех данных GeoJSON
  const clearGeoData = () => {
    setGeoData({ type: 'FeatureCollection', features: [] });
  };

  // Инициализация инструментов рисования линий
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
      drawnFeature.properties = { ...drawnFeature.properties, tag: 'created-line' }; // Добавляем тег для созданной линии

      // Добавляем новую линию в данные GeoJSON
      setGeoData((prevGeoData) => ({
        type: 'FeatureCollection',
        features: [...prevGeoData.features, drawnFeature],
      }));

      // Добавляем слой на карту и сохраняем его в geoJsonLayer
      if (geoJsonLayerRef.current) {
        layer.setStyle({ color: 'green' }); // Помечаем созданную линию зеленым цветом
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

  // Переключение режима выбора объектов на карте
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    selectedLinesRef.current.forEach(layer => layer.setStyle({ color: '#3388ff' })); // Сбрасываем выделение всех линий
    selectedLinesRef.current = [];
  };

  // Создание соединительных линий между концами выбранных линий
  const createConnectingLines = (fullCycle = false) => {
    if (selectedLinesRef.current.length > 1) {
      const lineFeatures = selectedLinesRef.current.map(layer => layer.toGeoJSON());
      const allFirstAndLastCoords = [];

      // Получаем все первые и последние координаты каждой линии
      lineFeatures.forEach((line) => {
        allFirstAndLastCoords.push(line.geometry.coordinates[0]);
        allFirstAndLastCoords.push(line.geometry.coordinates[line.geometry.coordinates.length - 1]);
      });

      // Храним уже соединенные точки, чтобы избежать дублирования
      const connectedPoints = new Set();
      const map = geoJsonLayerRef.current._map;
      const newConnectingLines = [];

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
          const newLine = turf.lineString([pointA, closestPoint], { tag: 'connecting-line' }); // Помечаем линию как соединяющую
          newConnectingLines.push(newLine);

          // Добавляем новую линию на карту
          const newLineLayer = L.geoJSON(newLine, { style: { color: 'green' } }).addTo(map);

          // Добавляем новую линию в geoJsonLayer
          if (geoJsonLayerRef.current) {
            geoJsonLayerRef.current.addLayer(newLineLayer);
          }

          // Помечаем точки как соединенные
          connectedPoints.add(indexA);
          connectedPoints.add(closestPointIndex);
        }
      });

      // Обновляем geoData, добавляя новые соединяющие линии
      if (newConnectingLines.length > 0) {
        setGeoData((prevGeoData) => ({
          type: 'FeatureCollection',
          features: [...prevGeoData.features, ...newConnectingLines],
        }));
      }

      if (fullCycle == true) {
        return newConnectingLines;
      } else {
        selectedLinesRef.current = [];
      }
    }
    return [];
  };

  // Создание полигона из выбранных и соединенных линий
  const createPolygonFromLines = (lines = []) => {
    if (geoJsonLayerRef.current) {
      if (!Array.isArray(lines)) {
        lines = [];
      }
      // Используем только выбранные линии и переданные соединяющие линии для создания полигона
      const selectedLineFeatures = selectedLinesRef.current.map(layer => layer.toGeoJSON());
      const allLines = [...selectedLineFeatures, ...(lines || [])];
      const multiLineString = turf.featureCollection(allLines);

      // Используем polygonize для создания полигонов из замкнутых линий
      const polygons = turf.polygonize(multiLineString);

      // Снимаем выделение с выбранных линий после создания полигона
      selectedLinesRef.current.forEach(layer => layer.setStyle({ color: '#3388ff' }));
      selectedLinesRef.current = [];

      if (polygons && polygons.features.length > 0) {
        // Добавляем полигоны на карту
        const map = geoJsonLayerRef.current._map;
        const polygonLayer = L.geoJSON(polygons, {
          style: { color: 'green', fillColor: 'green', fillOpacity: 0.5 },
          onEachFeature: (feature, layer) => {
            layer.on('click', () => {
              console.log('Polygon feature:', feature);
            });
          }
        }).addTo(map);
        geoJsonLayerRef.current.addLayer(polygonLayer);

        // Обновляем geoData, добавляя новые полигоны
        setGeoData((prevGeoData) => ({
          type: 'FeatureCollection',
          features: [...prevGeoData.features, ...polygons.features],
        }));
      }
    }
  };

  // Создание линий и полигона из выделенных объектов
  const createLinesAndPolygon = () => {
    // Сначала создаем соединяющие линии и получаем их
    const connectingLines = createConnectingLines(true);
    // Затем создаем полигон из выделенных и созданных линий
    createPolygonFromLines(connectingLines);
    // Удаляем линии, созданные на этапе соединения
    setGeoData((prevGeoData) => ({
      type: 'FeatureCollection',
      features: prevGeoData.features.filter(feature => feature.properties && feature.properties.tag !== 'connecting-line'),
    }));
  };

  // Включение режима редактирования для объектов на карте
  const enableEditing = () => {
    const map = geoJsonLayerRef.current._map;
    if (geoJsonLayerRef.current) {
      const editableLayer = geoJsonLayerRef.current;
      const editControl = new L.Control.Draw({
        edit: {
          featureGroup: editableLayer,
          remove: false
        },
        draw: false,
      });
      map.addControl(editControl);
      map.on(L.Draw.Event.EDITED, (event) => {
        const layers = event.layers;
        layers.eachLayer((layer) => {
          const updatedFeature = layer.toGeoJSON();
          setGeoData((prevGeoData) => {
            const updatedFeatures = prevGeoData.features.map(feature =>
              feature.id === updatedFeature.id ? updatedFeature : feature
            );
            return { type: 'FeatureCollection', features: updatedFeatures };
          });
        });
      });
    }
  };

  // Разбиение выбранной линии на сегменты заданного размера
  const chunkSelectedLineString = (degree) => {
    if (selectedLinesRef.current.length !== 1) {
      alert('Please select a single LineString to chunk.');
      return;
    }

    const selectedLine = selectedLinesRef.current[0].toGeoJSON();
    if (selectedLine.geometry.type !== 'LineString') {
      alert('Selected feature is not a LineString.');
      return;
    }

    const chunked = turf.lineChunk(selectedLine, degree, { units: 'degrees' });
    setGeoData((prevGeoData) => ({
      type: 'FeatureCollection',
      features: [...prevGeoData.features, ...chunked.features],
    }));
    selectedLinesRef.current = [];
  };

  // Упрощение выбранной линии для уменьшения количества точек
  const simplifySelectedLine = () => {
    if (selectedLinesRef.current.length !== 1) {
      alert('Please select a single LineString to simplify.');
      return;
    }

    const selectedLine = selectedLinesRef.current[0].toGeoJSON();
    if (selectedLine.geometry.type !== 'LineString') {
      alert('Selected feature is not a LineString.');
      return;
    }

    const points = selectedLine.geometry.coordinates.map(([x, y]) => ({ x, y }));
    const simplifiedPoints = simplify(points, 0.001, true); // tolerance value and highQuality flag
    const simplifiedCoordinates = simplifiedPoints.map(({ x, y }) => [x, y]);

    // Удаляем старую линию
    geoJsonLayerRef.current.removeLayer(selectedLinesRef.current[0]);
    selectedLinesRef.current = [];

    // Создаем новые линии для каждого сегмента между упрощенными точками
    const newLines = [];
    for (let i = 0; i < simplifiedCoordinates.length - 1; i++) {
      const segment = [simplifiedCoordinates[i], simplifiedCoordinates[i + 1]];
      const newLine = turf.lineString(segment, { tag: 'simplified-segment' });
      newLines.push(newLine);
    }

    // Добавляем новые линии на карту и в geoJsonLayer
    const map = geoJsonLayerRef.current._map;
    newLines.forEach(newLine => {
      const newLineLayer = L.geoJSON(newLine, { style: { color: 'blue' } }).addTo(map);
      geoJsonLayerRef.current.addLayer(newLineLayer);
    });

    // Обновляем geoData новыми линиями
    setGeoData((prevGeoData) => ({
      type: 'FeatureCollection',
      features: [
        ...prevGeoData.features.filter(feature => feature !== selectedLine),
        ...newLines,
      ],
    }));
  };

  return (
    <div className="App">
      <h2>GeoJSON Map Viewer</h2>
      <input type="file" accept=".geojson" onChange={handleFileUploadOSM} />
      <button onClick={clearGeoData}>Clear GeoJSON Data</button>
      <button onClick={initializeDrawControl}>Draw Line</button>
      <button onClick={toggleSelectionMode}>{selectionMode ? 'Exit Selection Mode' : 'Enter Selection Mode'}</button>
      <button onClick={createConnectingLines} disabled={!selectionMode}>Create Connecting Lines</button>
      <button onClick={createPolygonFromLines} disabled={!selectionMode}>Create Polygon from Lines</button>
      <button onClick={createLinesAndPolygon} disabled={!selectionMode}>Create Lines and Polygon</button>
      <button onClick={() => chunkSelectedLineString(0.03)}>Chunk Selected LineString</button>
      <button onClick={simplifySelectedLine}>Simplify Selected LineString</button>
      <button onClick={enableEditing}>Enable Editing</button>
      <h2>Load from Parser</h2>
      <input type="file" accept=".geojson" onChange={handleFileUploadParser} />
      <div className="map-container">
        <MapContainer 
          style={{ height: "500px", width: "100%" }} 
          center={[51.505, -0.09]} 
          zoom={13} 
          scrollWheelZoom={false}
        >
          {!parserMode && <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />}
          {geoData && <GeoJSONWithBounds data={geoData} />}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;
