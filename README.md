# OmniRoute Port Bridge

Puente/proxy inverso que expone el **dashboard y la API de OmniRoute** en un puerto diferente al `20128` por defecto. útil cuando tu entorno cloud no te permite acceder al puerto original de OmniRoute.

## Qué hace

- OmniRoute corre normalmente en `http://localhost:20128`.
- Esta app levanta un servidor Express en un puerto configurable (por defecto `3000`).
- **Detecta automáticamente** si OmniRoute está instalado.
- **Verifica** si OmniRoute está corriendo.
- **Lo inicia automáticamente** si está instalado pero no corriendo.
- Todo el tráfico llega a esta app y se reenvía automáticamente a OmniRoute.
- Soporta WebSockets para que el dashboard funcione correctamente.
- Expone un **panel de estado web** en `/status` para saber todo de un vistazo.

## Requisitos

- Node.js >= 18
- OmniRoute corriendo localmente (`omniroute` en tu consola)

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

La app se levantará en: `http://localhost:3000`

Abre en tu navegador: `http://localhost:3000/dashboard`

## Variables de entorno

Puedes crear un archivo `.env` con:

```env
HOST=0.0.0.0
PORT=3000
OMNIROUTE_HOST=localhost
OMNIROUTE_PORT=20128
```

## Despliegue en cloud con agente

Guía paso a paso para que el agente de deploy configure e inicie la app correctamente.

### Requisitos que debe cumplir el agente

- **Node.js >= 18** instalado en el entorno
- **OmniRoute** corriendo antes de iniciar el proxy (`omniroute` en la terminal)
- Acceso de red al puerto original de OmniRoute (`localhost:20128`)

### Paso 1 - Instalar dependencias

```bash
cd /ruta/del/repo
npm install
```

### Paso 2 - Crear archivo `.env`

```env
HOST=0.0.0.0
PORT=3000
OMNIROUTE_HOST=localhost
OMNIROUTE_PORT=20128
```

### Paso 3 - Iniciar la app

```bash
npm start
```

O alternativamente:

```bash
node server.js
```

### Paso 4 - Verificar que funciona

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{"status":"ok","target":"http://localhost:20128","timestamp":"2026-07-25T..."}
```

### Variables de entorno

| Variable          | Default        | Descripción                                           |
|-------------------|----------------|-------------------------------------------------------|
| `HOST`            | `0.0.0.0`      | Interfaz de red donde escucha el proxy                |
| `PORT`            | `3000`         | Puerto donde expone el proxy                          |
| `OMNIROUTE_HOST`  | `localhost`    | Host donde corre OmniRoute                            |
| `OMNIROUTE_PORT`  | `20128`        | Puerto original de OmniRoute                          |

### Notas importantes para el agente

- Si el agente prueba la raíz `/` y OmniRoute **no** está corriendo, devolverá `502` o `504`. Eso es **normal**: significa que el proxy funciona, solo que OmniRoute no está disponible aún.
- La app escucha en `0.0.0.0` por defecto para aceptar conexiones desde fuera del contenedor o entorno cloud.
- Soporta WebSockets, necesarios para el dashboard de OmniRoute.
- El health check en `/health` permite al agente verificar que la app respondió correctamente sin depender de OmniRoute.

## Rutas útiles

| Ruta en esta app                 | Destino en OmniRoute                        |
| -------------------------------- | ------------------------------------------- |
| `http://localhost:3000`           | `http://localhost:20128`                    |
| `http://localhost:3000/dashboard` | `http://localhost:20128/dashboard`          |
| `http://localhost:3000/v1/models`| `http://localhost:20128/v1/models`          |
| `http://localhost:3000/health`   | Health check con estado de OmniRoute        |
| `http://localhost:3000/status`   | Panel web con info completa                 |

## Solución de problemas

- **Error 502**: OmniRoute no está corriendo. Inícialo con `omniroute` primero.
- **Puerto ocupado**: Cambia `PORT` en el archivo `.env`.
