# Checklist: Gestor de Notas Privadas

## Especificaciones técnicas base

- [x] Frontend: HTML5 + Bootstrap + JavaScript para llamadas a la API y manejo de formularios
- [x] Backend: Express.js (Node)
- [x] Persistencia: SQLite o archivo JSON en `/backend`
  - [x] Tabla de usuarios con contraseña hasheada
- [x] Despliegue: detallada en README.md
- [-] Despliegue: Docker
- [x] Validación en middleware/auth y validation.js
- [?] Errores: respuestas HTTP adecuadas, sin exponer stack traces ni rutas del sistema

## Registro y login

- [x] Cumplir requisitos comunes de registro y login
- [x] Tras login, el usuario solo ve sus propias notas

## Funcionalidad de notas

- [x] Crear nota: título y contenido, asociada al usuario autenticado
- [x] Listar notas: solo del usuario logueado, ordenadas por fecha (más recientes primero)
- [x] Ver una nota: solo si pertenece al usuario actual
- [x] Editar nota: solo el dueño puede modificar título y/o contenido
- [x] Eliminar nota: solo el dueño puede borrar la nota

## Modelo de datos (ejemplo)

Estrucura similar. Ver database.js dese línea 37

- [x] Usuarios: `id`, `email` o `username`, `password`, `created_at`
- [x] Notas: `id`, `user_id` (FK), `titulo`, `contenido`, `created_at`, `updated_at`

## Especificaciones técnicas adicionales

- [x] API protegida: todas las rutas de notas requieren autenticación y verificación del propietario
- [x] En respuestas JSON, no incluir campos sensibles (password, etc.)
  - [x] Devolver solo lo necesario (`id`, `email` o `username`)
- [x] Validación: título y contenido no vacíos, longitud razonable para evitar abusos
