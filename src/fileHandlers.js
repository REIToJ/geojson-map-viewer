import { removeDuplicateLines } from "./utils";
import { convertToWgs84 } from "./utils";

// Обработчик загрузки файла
export const handleFileUpload = (event, setGeoData, setParserMode, setShouldFitBounds) => {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    let data = JSON.parse(e.target.result);
    data = removeDuplicateLines(data); // Удаляем дублирующиеся линии перед обновлением состояния
    setGeoData(data);
    setParserMode(false);
    setShouldFitBounds(true); // Указываем, что нужно оцентровать карту
  };

  if (file) {
    reader.readAsText(file);
  }
};

// Обработчик загрузки файла, конвертирующий данные в WGS84
export const handleFileUploadParser = (event, setGeoData, setParserMode, setShouldFitBounds) => {
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
