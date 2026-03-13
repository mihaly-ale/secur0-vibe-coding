/**
 * middleware/validation.js
 * Input validation rules using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Centralized validation error handler.
 * Call as middleware after validation chains.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Datos de entrada inválidos.',
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

// ─── Auth Validations ──────────────────────────────────────────────────────────

const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres.')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Solo se permiten letras, números, guiones y puntos.'),

  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('El email no es válido.')
    .isLength({ max: 255 })
    .withMessage('El email es demasiado largo.'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('La contraseña debe tener entre 8 y 128 caracteres.')
    .matches(/[A-Z]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula.')
    .matches(/[0-9]/)
    .withMessage('La contraseña debe contener al menos un número.'),

  handleValidationErrors,
];

const validateLogin = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email inválido.'),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida.')
    .isLength({ max: 128 })
    .withMessage('Contraseña demasiado larga.'),

  handleValidationErrors,
];

// ─── Notes Validations ─────────────────────────────────────────────────────────

const NOTE_COLORS = [
  '#ffffff', '#fef3c7', '#fee2e2', '#dbeafe',
  '#d1fae5', '#ede9fe', '#fce7f3', '#f3f4f6',
  '#fef9c3', '#ecfccb',
];

const validateCreateNote = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('El título es requerido.')
    .isLength({ max: 200 })
    .withMessage('El título no puede superar los 200 caracteres.'),

  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('El contenido no puede superar los 50.000 caracteres.'),

  body('color')
    .optional()
    .isIn(NOTE_COLORS)
    .withMessage('Color no válido.'),

  body('pinned')
    .optional()
    .isBoolean()
    .withMessage('El campo pinned debe ser booleano.'),

  handleValidationErrors,
];

const validateUpdateNote = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('ID de nota inválido.'),

  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El título no puede estar vacío.')
    .isLength({ max: 200 })
    .withMessage('El título no puede superar los 200 caracteres.'),

  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('El contenido no puede superar los 50.000 caracteres.'),

  body('color')
    .optional()
    .isIn(NOTE_COLORS)
    .withMessage('Color no válido.'),

  body('pinned')
    .optional()
    .isBoolean()
    .withMessage('El campo pinned debe ser booleano.'),

  body('archived')
    .optional()
    .isBoolean()
    .withMessage('El campo archived debe ser booleano.'),

  handleValidationErrors,
];

const validateNoteId = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('ID de nota inválido.'),
  handleValidationErrors,
];

const validateSearchQuery = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La búsqueda es demasiado larga.'),

  query('archived')
    .optional()
    .isBoolean()
    .withMessage('Filtro archived debe ser booleano.'),

  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateNote,
  validateUpdateNote,
  validateNoteId,
  validateSearchQuery,
  handleValidationErrors,
};
