# 📒 Notes Manager — Gestor de Notas Privadas

Aplicación web full-stack para gestionar notas privadas con autenticación segura.

---

## 🏗️ Arquitectura

```
notes-manager/
├── backend/                   ← Node.js + Express API
│   ├── server.js              ← Punto de entrada del servidor
│   ├── database.js            ← Inicialización SQLite (better-sqlite3)
│   ├── routes/
│   │   ├── auth.js            ← Registro, login, perfil, cambio de contraseña
│   │   └── notes.js           ← CRUD completo de notas
│   ├── middleware/
│   │   ├── auth.js            ← Verificación JWT
│   │   └── validation.js      ← Validaciones con express-validator
│   ├── .env.example           ← Variables de entorno (copia como .env)
│   └── package.json
├── frontend/                  ← HTML5 + CSS + Vanilla JS
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
└── .vscode/                   ← Configuración para VS Code
    ├── launch.json
    └── tasks.json
```

---

## ⚙️ Instalación rápida

### 1. Requisitos

- Node.js >= 18.x
- npm >= 9.x

  **Nota:** El proyecto está probado con Node.js 20.20.1. Con versiones más nuevas pueden aparecer errores por compatibilidad.

### 2. Configurar entorno

```bash
cd backend
cp .env.example .env
```

Edita `.env` y cambia al menos `JWT_SECRET` por un valor aleatorio largo.

### 3. Instalar dependencias

```bash
cd backend
npm install
```

### 4. Iniciar el servidor

**Modo desarrollo (con auto-reload):**

```bash
npm run dev
```

**Modo producción:**

```bash
npm start
```

### 5. Abrir en el navegador

Visita → **http://localhost:3000**

---

## 🔐 Seguridad implementada

| Capa               | Medida                                                           |
| ------------------ | ---------------------------------------------------------------- |
| **Autenticación**  | JWT HS256 con expiración configurable                            |
| **Contraseñas**    | bcrypt con 12 rounds de sal                                      |
| **Rate limiting**  | 200 req/15min global; 15 intentos auth/15min                     |
| **Headers HTTP**   | Helmet (CSP, HSTS, X-Frame-Options, etc.)                        |
| **CORS**           | Lista blanca de orígenes configurables                           |
| **Validación**     | express-validator en todos los endpoints                         |
| **Sanitización**   | XSS filtering en títulos y contenidos                            |
| **SQL Injection**  | Consultas parametrizadas (never string concat)                   |
| **Timing attacks** | Comparación constante de contraseñas aunque no exista el usuario |
| **Propiedad**      | Todas las operaciones verifican `user_id` en BD                  |

---

## 📡 API Reference

### Auth

| Método | Endpoint                  | Body                           | Auth |
| ------ | ------------------------- | ------------------------------ | ---- |
| POST   | /api/auth/register        | `username, email, password`    | No   |
| POST   | /api/auth/login           | `email, password`              | No   |
| GET    | /api/auth/me              | —                              | Sí   |
| PUT    | /api/auth/change-password | `currentPassword, newPassword` | Sí   |
| DELETE | /api/auth/account         | `password`                     | Sí   |

### Notes

| Método | Endpoint               | Descripción                                 | Auth |
| ------ | ---------------------- | ------------------------------------------- | ---- |
| GET    | /api/notes             | Listar notas (soporta ?q= y ?archived=true) | Sí   |
| GET    | /api/notes/:id         | Obtener nota por ID                         | Sí   |
| POST   | /api/notes             | Crear nota                                  | Sí   |
| PUT    | /api/notes/:id         | Actualizar nota                             | Sí   |
| PATCH  | /api/notes/:id/pin     | Toggle fijar/desfijar                       | Sí   |
| PATCH  | /api/notes/:id/archive | Toggle archivar/restaurar                   | Sí   |
| DELETE | /api/notes/:id         | Eliminar nota                               | Sí   |

### Health

| Método | Endpoint    | Descripción         |
| ------ | ----------- | ------------------- |
| GET    | /api/health | Estado del servidor |

---

## ✨ Funcionalidades

- ✅ Registro e inicio de sesión con JWT
- ✅ CRUD completo de notas (crear, ver, editar, eliminar)
- ✅ Fijar/desfijar notas (aparecen primero)
- ✅ Archivar/restaurar notas
- ✅ Búsqueda en tiempo real (título y contenido)
- ✅ 10 colores para personalizar notas
- ✅ Vista masonry responsive
- ✅ Estadísticas de notas
- ✅ Cambio de contraseña desde ajustes
- ✅ Eliminación de cuenta
- ✅ Atajos de teclado (Ctrl+N nueva nota, Ctrl+S guardar, Esc cerrar)
- ✅ Diseño responsive (móvil/escritorio)
- ✅ Toasts de notificación
- ✅ Contadores de caracteres

---

## ⌨️ Atajos de teclado

| Atajo      | Acción       |
| ---------- | ------------ |
| `Ctrl + N` | Nueva nota   |
| `Ctrl + S` | Guardar nota |
| `Esc`      | Cerrar modal |

---

## 🗄️ Esquema de base de datos

```sql
users       (id, username, email, password, created_at, updated_at)
notes       (id, user_id, title, content, color, pinned, archived, created_at, updated_at)
refresh_tokens (id, user_id, token_hash, expires_at, created_at)
```

---

## 📋 Variables de entorno

| Variable               | Default                 | Descripción                                |
| ---------------------- | ----------------------- | ------------------------------------------ |
| `PORT`                 | `3000`                  | Puerto del servidor                        |
| `NODE_ENV`             | `development`           | Entorno (`development` / `production`)     |
| `JWT_SECRET`           | —                       | **Cambiar obligatoriamente en producción** |
| `JWT_EXPIRES_IN`       | `7d`                    | Duración del token                         |
| `DB_PATH`              | `./data/notes.db`       | Ruta del archivo SQLite                    |
| `RATE_LIMIT_WINDOW_MS` | `900000`                | Ventana rate limit (ms)                    |
| `RATE_LIMIT_MAX`       | `200`                   | Máx. requests por ventana                  |
| `AUTH_RATE_LIMIT_MAX`  | `15`                    | Máx. intentos de auth por ventana          |
| `ALLOWED_ORIGINS`      | `http://localhost:3000` | Orígenes CORS permitidos (CSV)             |
