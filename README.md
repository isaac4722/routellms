# OmniRoute Port Bridge

Puente/proxy inverso para **OmniRoute** envuelto en una app **Next.js**, pensado para desplegar en plataformas cloud que solo aceptan frameworks frontend (Vite, Next.js, Astro, SvelteKit, Remix, Nuxt).

## Qué hace

- OmniRoute corre normalmente en `http://localhost:20128`.
- Esta app levanta un servidor **Next.js + Express** en un puerto configurable (por defecto `3000`).
- **Detecta automáticamente** si OmniRoute está instalado.
- **Verifica** si OmniRoute está corriendo.
- **Lo inicia automáticamente** si está instalado pero no corriendo.
- Redirige el tráfico del dashboard y la API de OmniRoute al puerto original.
- Soporta WebSockets para que el dashboard funcione correctamente.
- Expone un **panel de estado web** en `/` para saber todo de un vistazo.

## Requisitos

- Node.js >= 18
- OmniRoute instalado (`npm install -g omniroute`)

## Instalación

```bash
npm install
```

## Desarrollo local

```bash
npm run dev
```

Abre en tu navegador: `http://localhost:3000`

## Build y producción

```bash
npm run build
npm start
```

## Variables de entorno

Puedes crear un archivo `.env` con:

```env
HOST=0.0.0.0
PORT=3000
OMNIROUTE_HOST=localhost
OMNIROUTE_PORT=20128
```

| Variable          | Default        | Descripción                                           |
|-------------------|----------------|-------------------------------------------------------|
| `HOST`            | `0.0.0.0`      | Interfaz de red donde escucha el servidor             |
| `PORT`            | `3000`         | Puerto donde expone la app                            |
| `OMNIROUTE_HOST`  | `localhost`    | Host donde corre OmniRoute                            |
| `OMNIROUTE_PORT`  | `20128`        | Puerto original de OmniRoute                          |

## Rutas útiles

| Ruta en esta app                 | Destino en OmniRoute / descripción           |
| -------------------------------- | --------------------------------------------- |
| `http://localhost:3000`          | Panel de estado web (Next.js page)            |
| `http://localhost:3000/health`   | Health check JSON                             |
| `http://localhost:3000/status`   | Health check JSON (alias)                     |
| `http://localhost:3000/dashboard`| `http://localhost:20128/dashboard`            |
| `http://localhost:3000/v1/models`| `http://localhost:20128/v1/models`         |

## Despliegue en cloud con agente

### Requisitos del agente

- Node.js >= 18
- Debe ejecutar `npm install` y luego `npm run build`
- Debe iniciar con `npm start`
- El health check en `/health` le permite verificar que la app respondió correctamente

### Comandos típicos del agente

```bash
npm install
npm run build
npm start
```

### Notas importantes para el agente

- Si prueba la raíz `/` y OmniRoute **no** está corriendo, devolverá `502` o `504`. Eso es **normal**: el proxy funciona, solo que OmniRoute aún no está disponible.
- La app escucha en `0.0.0.0` por defecto para aceptar conexiones desde fuera del contenedor o entorno cloud.
- Soporta WebSockets para el dashboard de OmniRoute.

## Solución de problemas

- **Error 502**: OmniRoute no está corriendo. El bridge intentará iniciarlo automáticamente si está instalado.
- **OmniRoute no instalado**: Ejecuta `npm install -g omniroute` en el entorno cloud.
- **Puerto ocupado**: Cambia `PORT` en el archivo `.env`.
