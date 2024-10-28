// Компонент GeoJSON, который обновляет и отображает данные на карте
import React from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";

function GeoJSONWithBounds({ data, shouldFitBounds, setShouldFitBounds, selectionMode, selectedLinesRef, geoJsonLayerRef }) {
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
        if (feature.properties && feature.properties.tag === "created-line") {
          return { color: "green" };
        } else if (
          feature.properties &&
          feature.properties.tag === "connecting-line"
        ) {
          return { color: "green" };
        } else {
          return { color: "#3388ff" };
        }
      },
      // Обработка кликов по каждой геометрической сущности
      onEachFeature: (feature, layer) => {
        if (feature.geometry.type === "LineString") {
          layer.on("click", () => {
            if (selectionMode) {
                // Выделяем или снимаем выделение с линии в режиме выбора
              if (selectedLinesRef.current.includes(layer)) {
                layer.setStyle({ color: "#3388ff" });
                selectedLinesRef.current = selectedLinesRef.current.filter(
                  (l) => l !== layer
                );
              } else {
                layer.setStyle({ color: "red" });
                selectedLinesRef.current.push(layer);
              }
            } else {
              console.log("LineString feature:", feature);
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
  }, [data, map, shouldFitBounds, setShouldFitBounds, selectionMode, selectedLinesRef, geoJsonLayerRef]);

  return null;
}

export default GeoJSONWithBounds;
