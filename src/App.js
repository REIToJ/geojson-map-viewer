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
import { AppBar, Toolbar, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';
import PolylineIcon from '@mui/icons-material/Timeline';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import AddIcon from '@mui/icons-material/Add';
import CreateIcon from '@mui/icons-material/Create';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import CompressIcon from '@mui/icons-material/Compress';
import { Alert, Snackbar } from '@mui/material';


function App() {
  // Состояние для хранения данных GeoJSON и режима выбора
  const [geoData, setGeoData] = useState({ type: 'FeatureCollection', features: [] });
  const [selectionMode, setSelectionMode] = useState(false);
  const [parserMode, setParserMode] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const geoJsonLayerRef = useRef(null);
  const drawControlRef = useRef(null);
  const selectedLinesRef = useRef([]);
  const [fileUploadAnchorEl, setFileUploadAnchorEl] = useState(null);
  const [shouldFitBounds, setShouldFitBounds] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('warning'); // 'error', 'warning', 'info', 'success'
  const [alertMessage, setAlertMessage] = useState('');



  const handleFileUploadMenuOpen = (event) => {
    setFileUploadAnchorEl(event.currentTarget);
  };

  const handleFileUploadMenuClose = () => {
    setFileUploadAnchorEl(null);
  };

  const showAlert = (message, severity = 'warning') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setAlertOpen(true);
  };
  

  // Обработчик загрузки файла
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      let data = JSON.parse(e.target.result);
      data = removeDuplicateLines(data); // Удаляем дублирующиеся линии перед обновлением состояния
      setGeoData(data);
      setParserMode(false);
      setShouldFitBounds(true);
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  const MapControls = ({ setGeoData, geoJsonLayerRef }) => {
    const map = useMap();
  
    React.useEffect(() => {
      // Проверяем, были ли уже добавлены контролы
      if (map._controlsAdded) return;
      map._controlsAdded = true;
  
      // Создаем группу слоев для нарисованных объектов
      const drawnItems = geoJsonLayerRef.current || new L.FeatureGroup();
      if (!geoJsonLayerRef.current) {
        geoJsonLayerRef.current = drawnItems;
        map.addLayer(drawnItems);
      }
  
      // Добавляем контролы рисования и редактирования
      const drawControl = new L.Control.Draw({
        edit: {
          featureGroup: drawnItems,
          remove: false,
        },
        draw: {
          polyline: true,
          polygon: false,
          circle: false,
          marker: false,
          rectangle: false,
          circlemarker: false,
        },
      });
      map.addControl(drawControl);
  
      // Обработчики событий
      const onDrawCreated = (event) => {
        const layer = event.layer;
        const drawnFeature = layer.toGeoJSON();
        drawnFeature.properties = { ...drawnFeature.properties, tag: 'created-line' };
  
        setGeoData((prevGeoData) => ({
          type: 'FeatureCollection',
          features: [...prevGeoData.features, drawnFeature],
        }));
  
        drawnItems.addLayer(layer);
      };
  
      const onDrawEdited = (event) => {
        const layers = event.layers;
        const updatedFeatures = [];
  
        layers.eachLayer((layer) => {
          const updatedFeature = layer.toGeoJSON();
          updatedFeatures.push(updatedFeature);
        });
  
        setGeoData((prevGeoData) => {
          const features = prevGeoData.features.map((feature) => {
            const updatedFeature = updatedFeatures.find(
              (uf) => uf.id === feature.id
            );
            return updatedFeature || feature;
          });
          return { type: 'FeatureCollection', features };
        });
      };
  
      map.on(L.Draw.Event.CREATED, onDrawCreated);
      map.on(L.Draw.Event.EDITED, onDrawEdited);
  
      // Функция очистки
      return () => {
        map.off(L.Draw.Event.CREATED, onDrawCreated);
        map.off(L.Draw.Event.EDITED, onDrawEdited);
        map.removeControl(drawControl);
        map.removeLayer(drawnItems);
        delete map._controlsAdded;
      };
    }, []); // Пустой массив зависимостей, эффект выполнится только один раз при монтировании
  
    return null;
  };

  // Функция для удаления дублирующихся линий из GeoJSON
  const removeDuplicateLines = (geojson) => {
    const uniqueFeatures = [];
    const seenCoordinates = new Set();

    geojson.features.forEach((feature) => {
      if (feature.geometry.type === 'LineString') {
        const coordsString = JSON.stringify(feature.geometry.coordinates);
        if (!seenCoordinates.has(coordsString)) {
          seenCoordinates.add(coordsString);
          uniqueFeatures.push(feature);
        }
      } else {
        uniqueFeatures.push(feature);
      }
    });

    return { type: 'FeatureCollection', features: uniqueFeatures };
  };

  // Обработчик загрузки файла, конвертирующий данные в WGS84
  const handleFileUploadParser = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      let data = JSON.parse(e.target.result);
      data = convertToWgs84(data);
      data = removeDuplicateLines(data); // Удаляем дублирующиеся линии перед обновлением состояния
      setGeoData(data);
      setParserMode(true);
      setShouldFitBounds(true); // Указываем, что нужно оцентровать карту

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

  // Обработчик открытия меню Debug
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  // Обработчик закрытия меню Debug
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Компонент GeoJSON, который обновляет и отображает данные на карте
  const GeoJSONWithBounds = ({ data, shouldFitBounds, setShouldFitBounds }) => {
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
      if (data.features.length > 0 && shouldFitBounds) {
        map.fitBounds(geoJsonLayer.getBounds());
        setShouldFitBounds(false); // Сбрасываем флаг после оцентровки

      }
    }, [data, map, shouldFitBounds, setShouldFitBounds]);

    return null;
  };

  // Очистка всех данных GeoJSON
  const clearGeoData = () => {
    setGeoData({ type: 'FeatureCollection', features: [] });
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

    const chunked = turf.lineChunk(selectedLine, degree, { units: 'radians' });
    setGeoData((prevGeoData) => ({
      type: 'FeatureCollection',
      features: [...prevGeoData.features, ...chunked.features],
    }));
    selectedLinesRef.current = [];
  };

  // Упрощение выбранной линии для уменьшения количества точек
  const simplifySelectedLine = () => {
    if (selectedLinesRef.current.length !== 1) {
      showAlert('Please select a single LineString to simplify.', 'warning');
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

    // Удаляем старую линию как из geoJsonLayer, так и из geoData
    geoJsonLayerRef.current.removeLayer(selectedLinesRef.current[0]);
    setGeoData((prevGeoData) => ({
      type: 'FeatureCollection',
      features: prevGeoData.features.filter(feature => feature.properties && feature.properties.id !== selectedLine.properties.id),
    }));
    selectedLinesRef.current = [];

    // Создаем новые линии для каждого сегмента между упрощенными точками
    const newLines = [];
    for (let i = 0; i < simplifiedCoordinates.length - 1; i++) {
      const segment = [simplifiedCoordinates[i], simplifiedCoordinates[i + 1]];
      const newLine = turf.lineString(segment, { tag: 'simplified-segment', id: selectedLine.properties.id });
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
        ...prevGeoData.features,
        ...newLines,
      ],
    }));
  };
  // Основной интерфейс
  return (
    <div className="App">
      <MapContainer 
        style={{ height: "100vh", width: "100vw" }} 
        center={[51.505, -0.09]} 
        zoom={13} 
        scrollWheelZoom={true}
      >
        {!parserMode && <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />}
        {geoData && 
        <GeoJSONWithBounds data={geoData} 
        shouldFitBounds={shouldFitBounds}
        setShouldFitBounds={setShouldFitBounds}

        />}
         <MapControls setGeoData={setGeoData} geoJsonLayerRef={geoJsonLayerRef} />
      </MapContainer>
      <AppBar position="fixed" color="primary" sx={{ opacity: 0.9 }}>
        <Toolbar>
        <Tooltip title="Upload GeoJSON File">
          <IconButton onClick={handleFileUploadMenuOpen}>
            <FileUploadIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={fileUploadAnchorEl}
          open={Boolean(fileUploadAnchorEl)}
          onClose={handleFileUploadMenuClose}
        >
          <MenuItem component="label">
            Upload from OSM
            <input type="file" accept=".geojson" onChange={handleFileUpload} hidden />
          </MenuItem>
          <MenuItem component="label">
            Upload from Parser
            <input type="file" accept=".geojson" onChange={handleFileUploadParser} hidden />
          </MenuItem>
        </Menu>
        <Tooltip title={selectionMode ? "Exit Selection Mode" : "Enter Selection Mode"}>
            <IconButton
              onClick={() => toggleSelectionMode()}
              color={selectionMode ? "secondary" : "default"} // Меняем цвет в зависимости от selectionMode
            >
              <SelectAllIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Create Lines and Polygon">
            <IconButton onClick={() => { createLinesAndPolygon()}}
              disabled={!selectionMode}>
              <PolylineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Simplify Selected LineString">
            <IconButton onClick={simplifySelectedLine}
            disabled={!selectionMode}>
              <CompressIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Chunk Selected LineString">
            <IconButton onClick={() => { chunkSelectedLineString(0.03)}}
              disabled={!selectionMode}>
              <ContentCutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Debug Options">
            <IconButton onClick={handleMenuOpen}
            disabled={!selectionMode}>
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { clearGeoData(); handleMenuClose(); }}>
              <ClearIcon /> Clear GeoJSON Data
            </MenuItem>
            <MenuItem onClick={() => { createConnectingLines(); handleMenuClose(); }}>
              <AddIcon /> Create Connecting Lines
            </MenuItem>
            <MenuItem onClick={() => { createPolygonFromLines(); handleMenuClose(); }}>
              <AddIcon /> Create Polygon from Lines
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Snackbar
        open={alertOpen}
        autoHideDuration={6000}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity} sx={{ width: '100%' }}>
          {alertMessage}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default App;
