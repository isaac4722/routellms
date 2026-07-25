# OmniRoute Port Bridge

Puente/proxy inverso que expone el **dashboard y la API de OmniRoute** en un puerto diferente al `20128` por defecto. útil cuando tu entorno cloud no te permite acceder al puerto original de OmniRoute.

## Qué hace

- OmniRoute corre normalmente en `http://localhost:20128`.
- Esta app levanta un servidor Express en un puerto configurable (por defecto `3000`).
- Todo el tráfico llega a esta app y se reenvía automáticamente a OmniRoute.
- Soporta WebSockets para que el dashboard funcione correctamente.

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

Si tu agente de despliegue usa `npm start` o lee `README.md`, la app ya está configurada para:

- Iniciar con `npm start`
- Escuchar en el puerto definido por `PORT` (o `3000` por defecto)
- Escuchar en la interfaz definida por `HOST` (o `0.0.0.0` por defecto)
- Exponer un health check en `/health`

Asegúrate de que OmniRoute esté corriendo en el mismo entorno (o ajusta `OMNIROUTE_HOST` si está en otra máquina).

## Rutas útiles

| Ruta en esta app                 | Destino en OmniRoute                        |
| -------------------------------- | ------------------------------------------- |
| `http://localhost:3000`           | `http://localhost:20128`                    |
| `http://localhost:3000/dashboard` | `http://localhost:20128/dashboard`          |
| `http://localhost:3000/v1/models`| `http://localhost:20128/v1/models`          |
| `http://localhost:3000/health`   | Health check propio de la app bridge        |

## Solución de problemas

- **Error 502**: OmniRoute no está corriendo. Inícialo con `omniroute` primero.
- **Puerto ocupado**: Cambia `PORT` en el archivo `.env`.
