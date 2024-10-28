import React from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";

function MapControls({ setGeoData, geoJsonLayerRef }) {
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
      drawnFeature.properties = {
        ...drawnFeature.properties,
        tag: "created-line",
      };

      setGeoData((prevGeoData) => ({
        type: "FeatureCollection",
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
        return { type: "FeatureCollection", features };
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
  }, [map, setGeoData, geoJsonLayerRef]);

  return null;
}

export default MapControls;
