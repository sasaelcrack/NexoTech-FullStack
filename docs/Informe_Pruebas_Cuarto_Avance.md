# Informe de pruebas - Cuarto Avance

**Proyecto:** NexoTech
**Arquitectura:** React + Vite -> FastAPI -> PostgreSQL
**Fecha de pruebas:** 13 de septiembre de 2026

## 1. Objetivo

Verificar que la aplicación cumple los requisitos del cuarto avance: comunicación entre React y FastAPI, persistencia en MySQL, autenticación JWT, hashing de contraseñas, validaciones, roles, protección de endpoints, CRUD, paneles y pedidos.

## 2. Preparación del entorno

### Backend

```powershell
cd backend-fastapi
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

API:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```powershell
cd Frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

### Base de datos

PostgreSQL debe estar activo en `localhost:5432` y las variables deben estar configuradas en `backend-fastapi/.env`.

## 3. Comprobaciones automáticas realizadas

| Comprobación | Resultado |
|---|---|
| `npm run lint` | Aprobado |
| `npm run build` | Aprobado |
| Compilación Python con el entorno virtual | Aprobado |
| `pip check` | Sin dependencias rotas |
| Colección Postman JSON | Válida |
| PostgreSQL en puerto 5432 | Disponible |
| API FastAPI | Disponible |

## 4. Pruebas funcionales realizadas

### 4.1 API y documentación

| Prueba | Resultado esperado | Resultado obtenido |
|---|---|---|
| `GET /` | Mensaje de API funcionando | `200 OK` |
| `GET /docs` | Swagger disponible | `200 OK` |
| `GET /openapi.json` | Especificación OpenAPI | `200 OK` |
| `GET /api/productos/` | Lista de productos | `200 OK` |
| `GET /api/servicios/` | Lista de servicios | `200 OK` |

### 4.2 Registro y autenticación

Se registró un cliente temporal con datos válidos.

| Prueba | Resultado |
|---|---|
| Registro de cliente | Aprobado, respuesta `200` |
| Login de cliente | Aprobado, respuesta `200` |
| Generación de JWT | Aprobado |
| Consulta de perfil autenticado | Aprobado, respuesta `200` |
| Consulta `/api/usuarios/me` | Aprobado, respuesta `200` |
| Edición de perfil | Aprobado, respuesta `200` |
| Acceso sin token a ruta protegida | Rechazado |

El usuario temporal y sus pedidos fueron eliminados al terminar la prueba.

### 4.3 Control de roles

| Prueba | Resultado |
|---|---|
| Cliente accede a `/api/panel/cliente` | Aprobado |
| Cliente intenta acceder a `/api/panel/admin` | Rechazado con `403 Forbidden` |
| Usuario con rol no autorizado intenta una operación restringida | Rechazado por FastAPI |
| Login del administrador `admin@admin.com` | Aprobado |
| Acceso del administrador al panel admin | Aprobado |

### 4.4 CRUD administrativo

Las pruebas administrativas se ejecutaron usando el administrador conservado.

| Operación | Entidad | Resultado |
|---|---|---|
| Listar usuarios | Usuarios | Aprobado |
| Crear | Producto | Aprobado |
| Consultar | Producto | Aprobado |
| Eliminar | Producto | Aprobado |
| Crear | Servicio | Aprobado |
| Consultar | Servicio | Aprobado |
| Eliminar | Servicio | Aprobado |

Los productos y servicios utilizados para la prueba fueron temporales y se eliminaron al finalizar.

### 4.5 Pedidos

Se creó un cliente temporal y se realizó un pedido de un servicio activo.

| Prueba | Resultado |
|---|---|
| Crear pedido autenticado | Aprobado, respuesta `200` |
| Consultar pedidos propios | Aprobado, respuesta `200` |
| Validar `tipo_item=producto` o `servicio` | Aprobado |
| Enviar un tipo inválido | Rechazado con `422` |
| Limpiar pedido de prueba | Aprobado |

### 4.6 Integridad referencial y eliminaciones

Se creó temporalmente un cliente con un pedido asociado y se intentó eliminarlo desde el rol administrador.

| Prueba | Resultado |
|---|---|
| Eliminar usuario con pedidos | Rechazado correctamente con `409 Conflict` |
| Mensaje de protección | Indica conservar el historial y cambiar el estado a inactivo |
| Cambiar usuario con pedidos a inactivo | Aprobado, respuesta `200` |
| Eliminar el propio administrador | Rechazado correctamente con `409 Conflict` |
| Limpieza de datos temporales | Aprobada |

Los productos y servicios no tienen actualmente una relación `empleado_id`; por eso un servicio no queda ligado a un empleado y eliminar un empleado no puede romper esa relación. Si el proyecto necesitara que cada servicio perteneciera a un empleado, habría que añadir esa clave foránea y definir una regla similar.

Formato correcto:

```json
{
  "items": [
    {
      "tipo_item": "servicio",
      "id": 1,
      "cantidad": 1
    }
  ]
}
```

## 5. Recuperación de contraseña

| Prueba | Resultado |
|---|---|
| Solicitud con correo inexistente | Respuesta genérica `200` |
| Token inválido | Rechazado con `400` |
| Login SMTP de Gmail | Aprobado |
| Token temporal | Implementado con expiración de 30 minutos |
| Token de un solo uso | Implementado |
| Nueva contraseña con bcrypt | Implementado |

La prueba completa del correo requiere que el archivo `.env` tenga configuradas las variables SMTP reales.

## 6. Base de datos y seguridad

Se verificó que:

- La conexión usa SQLAlchemy y psycopg.
- Las credenciales se cargan desde `.env`.
- Las contraseñas se almacenan con bcrypt.
- JWT contiene identificación y rol.
- Los endpoints protegidos usan dependencias de autenticación.
- CORS permite los orígenes locales configurados.
- Existe el script de creación en `backend-fastapi/database/nexotech_schema.sql`.
- Existe `.env.example` sin credenciales reales.
- `.env` está incluido en `.gitignore` de FastAPI.
- El script SQL crea y siembra la tabla `roles` antes de crear `usuarios`, cuya columna `rol_id` tiene clave foránea hacia `roles.id`.
- El script SQL crea y siembra la tabla `permisos` con módulos para usuarios, productos y servicios.
- El modelo SQLAlchemy incluye `Rol` y `Permiso`; la autorización efectiva de endpoints continúa aplicándose mediante `verificar_rol` en FastAPI.

## 7. Funcionalidades del frontend

Verificadas en el código y en la compilación:

- React + Vite.
- Tailwind CSS.
- Navbar y Footer.
- Carrusel.
- Botón flotante de WhatsApp.
- Registro.
- Login.
- Recuperación y restablecimiento de contraseña.
- Panel administrador.
- Panel empleado.
- Panel cliente.
- Nombre del usuario visible en el Navbar.
- Validaciones de formularios.
- Carrito y pedidos.
- Edición del perfil del cliente.

## 8. Estado actual de la base

Estado consultado el 13 de septiembre de 2026:

- Usuarios: 4
- Pedidos: 2
- Tokens de recuperación: 4

La base contiene datos de prueba creados durante las verificaciones. Antes de entregar, realiza un respaldo y limpia los registros que no quieras mostrar.

## 9. Matriz de la rúbrica REQ-01 a REQ-26

| Requisito | Estado | Evidencia recomendada |
|---|---|---|
| REQ-01 Arquitectura tecnológica | Cumple | Frontend, FastAPI y base SQL funcionando |
| REQ-02 Backend con FastAPI | Cumple | Estructura `backend-fastapi/app` |
| REQ-03 Entorno FastAPI | Cumple | `venv`, `requirements.txt`, terminal activada |
| REQ-04 Base de datos SQL | Cumple | phpMyAdmin con usuarios, roles, permisos, productos y servicios |
| REQ-05 Tabla de usuarios | Cumple | Estructura de `usuarios` y hash en `password` |
| REQ-06 Modelos y esquemas | Cumple | `models.py` y `schemas.py` |
| REQ-07 Conexión DB con FastAPI | Cumple | `.env`, MySQL activo y respuesta de la API |
| REQ-08 Conexión Frontend/Backend/DB | Cumple | Registro o login desde React |
| REQ-09 Registro de clientes | Cumple | Postman y registro exitoso desde React |
| REQ-10 Inicio de sesión | Cumple | Login en React/Postman con `/api/usuarios/login` |
| REQ-11 Autenticación JWT | Cumple | Respuesta JWT y header Bearer |
| REQ-12 Control de roles | Cumple | Paneles y respuesta `403` |
| REQ-13 Hooks React | Cumple | Código con `useState`, `useEffect`, `useRef`, `useNavigate` y otros |
| REQ-14 Endpoints API | Cumple | Swagger y colección Postman |
| REQ-15 Recuperación de contraseña | Cumple con evidencia pendiente | Solicitud, correo recibido y restablecimiento |
| REQ-16 CRUD de usuarios | Cumple | GET, PUT, PATCH y DELETE en Postman |
| REQ-17 Panel administrador | Cumple | Captura del panel admin |
| REQ-18 Panel empleado | Cumple | Captura del panel empleado y restricciones |
| REQ-19 Panel cliente | Cumple | Captura del panel cliente |
| REQ-20 Usuario en Navbar | Cumple | Captura con nombre y cierre de sesión |
| REQ-21 Validaciones en tiempo real | Cumple | Errores frontend y respuesta `422` de FastAPI |
| REQ-22 Seguridad de contraseñas | Cumple | Hash bcrypt visible, sin mostrar contraseñas |
| REQ-23 Variables de entorno | Cumple | `.env` local y `.env.example` sin secretos |
| REQ-24 WhatsApp flotante | Cumple | Captura del botón fijo |
| REQ-25 Swagger | Cumple | `http://127.0.0.1:8000/docs` |
| REQ-26 Postman y métodos HTTP | Cumple con evidencia pendiente | Capturas de GET, POST, PUT, PATCH y DELETE |

El código está preparado para los 26 requisitos. La valoración final depende de pegar las capturas en la lista de chequeo.

## 10. Evidencias que deben agregarse al documento final

Tomar capturas de pantalla de:

1. Frontend funcionando en el navegador.
2. Registro exitoso en Postman.
3. Login exitoso y respuesta JWT.
4. Swagger en `/docs`.
5. Consulta de usuarios.
6. Creación y edición de producto.
7. Creación y edición de servicio.
8. Respuesta `403` al intentar acceder con un rol no permitido.
9. Creación de pedido.
10. Recuperación de contraseña y correo recibido.
11. Base de datos con las tablas creadas.
12. Panel de administrador, empleado y cliente.

> Antes de compartir el proyecto, elimina cualquier contraseña SMTP o contraseña de usuario de la colección Postman y utiliza variables locales de Postman.
