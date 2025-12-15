# Verificador IA

API Express en Node.js que consume un detector externo de IA para imágenes y videos. Usa un umbral configurable para decidir si el archivo es generado por IA y devuelve un veredicto en español.

## Requisitos
- Node.js 18+
- Variables de entorno:
  - `DETECTOR_API_URL`: URL del endpoint del detector externo.
  - `DETECTOR_API_KEY`: token de autenticación para el detector.
  - `AI_PERCENTAGE_THRESHOLD` (opcional): umbral en porcentaje para considerar un archivo como IA. Por defecto `5`.
  - `PORT` (opcional): puerto para exponer la API. Por defecto `3000`.

## Instalación
```bash
npm install
```

## Ejecución en desarrollo
```bash
cp .env.example .env # crea tu archivo de entorno si lo necesitas
# exporta las variables obligatorias o edita .env
npm run dev
```
La consola mostrará `Servidor iniciado en el puerto <PORT>` cuando esté lista.

## Build y ejecución en producción
```bash
npm run build
npm start
```

## Probar el endpoint `/api/analyze`
Envía una imagen o video por URL o en base64. Ejemplo usando `curl` con una URL:
```bash
curl -X POST "http://localhost:3000/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaType": "image",
    "url": "https://ejemplo.com/imagen.jpg"
  }'
```

Ejemplo enviando base64 (recorta la cadena para el ejemplo):
```bash
curl -X POST "http://localhost:3000/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaType": "image",
    "base64": "data:image/jpeg;base64,/9j/4AAQSk..."
  }'
```

La respuesta incluye el porcentaje detectado y el veredicto:
```json
{
  "verdict": "NO ES IA (3.2%)",
  "aiPercentage": 3.2,
  "threshold": 5,
  "detectorResponse": { "...": "respuesta original del detector" }
}
```

Si el porcentaje supera el umbral (`> threshold`) el veredicto será `"ES IA (X%)"`.
