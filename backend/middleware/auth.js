/**
 * middleware/auth.js
 * JWT Authentication middleware
 */

const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

const JWT_SECRET =
	process.env.JWT_SECRET || 'fallback_secret_change_in_production';

/**
 * Verifies the JWT token from Authorization header.
 * Attaches the decoded user payload to req.user.
 */
function authenticate(req, res, next) {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				success: false,
				error: 'Acceso no autorizado. Token requerido.',
			});
		}

		const token = authHeader.split(' ')[1];

		if (!token) {
			return res.status(401).json({
				success: false,
				error: 'Token inválido o malformado.',
			});
		}

		const decoded = jwt.verify(token, JWT_SECRET, {
			algorithms: ['HS256'],
		});

		// Verify user still exists in DB
		const db = getDB();
		const user = db
			.prepare('SELECT id, username, email FROM users WHERE id = ?')
			.get(decoded.id);

		if (!user) {
			return res.status(401).json({
				success: false,
				error: 'Usuario no encontrado. Por favor, inicia sesión de nuevo.',
			});
		}

		req.user = user;
		next();
	} catch (err) {
		if (err.name === 'TokenExpiredError') {
			return res.status(401).json({
				success: false,
				error: 'Sesión expirada. Por favor, inicia sesión de nuevo.',
				code: 'TOKEN_EXPIRED',
			});
		}
		if (err.name === 'JsonWebTokenError') {
			return res.status(401).json({
				success: false,
				error: 'Token inválido.',
			});
		}

		console.error('Auth middleware error:', err);
		return res.status(500).json({
			success: false,
			error: 'Error interno de autenticación.',
		});
	}
}

module.exports = { authenticate };
