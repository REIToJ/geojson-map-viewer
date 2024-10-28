import { toWgs84 } from "@turf/projection";

// Функция для удаления дублирующихся линий из GeoJSON
export const removeDuplicateLines = (geojson) => {
    const uniqueFeatures = [];
    const seenCoordinates = new Set();
  
    geojson.features.forEach((feature) => {
      if (feature.geometry.type === "LineString") {
        const coordsString = JSON.stringify(feature.geometry.coordinates);
        if (!seenCoordinates.has(coordsString)) {
          seenCoordinates.add(coordsString);
          uniqueFeatures.push(feature);
        }
      } else {
        uniqueFeatures.push(feature);
      }
    });
  
    return { type: "FeatureCollection", features: uniqueFeatures };
  };

// Функция для конвертации координат в систему WGS84
export const convertToWgs84 = (geojson) => {
  try {
    return toWgs84(geojson);
  } catch (error) {
    console.error("Ошибка при преобразовании координат:", error);
    return geojson;
  }
};
