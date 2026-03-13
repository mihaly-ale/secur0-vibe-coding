/**
 * routes/auth.js
 * Authentication routes: register, login, logout, me
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../backend/database');
const { authenticate } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');

const router = express.Router();

const JWT_SECRET =
	process.env.JWT_SECRET || 'fallback_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 12;

// ─── Helper: Generate JWT ──────────────────────────────────────────────────────

function generateToken(user) {
	return jwt.sign(
		{ id: user.id, username: user.username, email: user.email },
		JWT_SECRET,
		{ algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
	);
}

// ─── POST /auth/register ───────────────────────────────────────────────────────

router.post('/register', validateRegister, async (req, res) => {
	try {
		const { username, email, password } = req.body;
		const db = getDB();

		// Check existing user
		const existing = db
			.prepare('SELECT id FROM users WHERE email = ? OR username = ?')
			.get(email.toLowerCase(), username);

		if (existing) {
			return res.status(409).json({
				success: false,
				error: 'Ya existe una cuenta con ese email o nombre de usuario.',
			});
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

		// Insert user
		const result = db
			.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
			.run(username, email.toLowerCase(), hashedPassword);

		const user = db
			.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
			.get(result.lastInsertRowid);

		const token = generateToken(user);

		return res.status(201).json({
			success: true,
			message: 'Cuenta creada correctamente.',
			data: {
				user: { id: user.id, username: user.username, email: user.email },
				token,
			},
		});
	} catch (err) {
		console.error('Register error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al crear la cuenta.' });
	}
});

// ─── POST /auth/login ──────────────────────────────────────────────────────────

router.post('/login', validateLogin, async (req, res) => {
	try {
		const { email, password } = req.body;
		const db = getDB();

		const user = db
			.prepare(
				'SELECT id, username, email, password FROM users WHERE email = ?'
			)
			.get(email.toLowerCase());

		// Use constant-time comparison even if user not found (prevent timing attacks)
		const dummyHash = '$2a$12$dummy.hash.for.timing.attack.prevention.padding';
		const passwordToCheck = user ? user.password : dummyHash;
		const isValid = await bcrypt.compare(password, passwordToCheck);

		if (!user || !isValid) {
			return res.status(401).json({
				success: false,
				error: 'Email o contraseña incorrectos.',
			});
		}

		const token = generateToken(user);

		return res.json({
			success: true,
			message: 'Sesión iniciada correctamente.',
			data: {
				user: { id: user.id, username: user.username, email: user.email },
				token,
			},
		});
	} catch (err) {
		console.error('Login error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al iniciar sesión.' });
	}
});

// ─── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', authenticate, (req, res) => {
	const db = getDB();
	const user = db
		.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
		.get(req.user.id);

	if (!user) {
		return res
			.status(404)
			.json({ success: false, error: 'Usuario no encontrado.' });
	}

	const stats = db
		.prepare(
			`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN pinned = 1 AND archived = 0 THEN 1 ELSE 0 END) as pinned,
        SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) as archived
      FROM notes WHERE user_id = ?
    `
		)
		.get(req.user.id);

	return res.json({
		success: true,
		data: { user, stats },
	});
});

// ─── PUT /auth/change-password ─────────────────────────────────────────────────

router.put('/change-password', authenticate, async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body;

		if (!currentPassword || !newPassword) {
			return res
				.status(422)
				.json({ success: false, error: 'Ambos campos son requeridos.' });
		}

		if (newPassword.length < 8 || newPassword.length > 128) {
			return res.status(422).json({
				success: false,
				error: 'La nueva contraseña debe tener entre 8 y 128 caracteres.',
			});
		}

		const db = getDB();
		const user = db
			.prepare('SELECT password FROM users WHERE id = ?')
			.get(req.user.id);
		const isValid = await bcrypt.compare(currentPassword, user.password);

		if (!isValid) {
			return res
				.status(401)
				.json({ success: false, error: 'Contraseña actual incorrecta.' });
		}

		const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
		db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
			hashedPassword,
			req.user.id
		);

		return res.json({
			success: true,
			message: 'Contraseña actualizada correctamente.',
		});
	} catch (err) {
		console.error('Change password error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al cambiar la contraseña.' });
	}
});

// ─── DELETE /auth/account ──────────────────────────────────────────────────────

router.delete('/account', authenticate, async (req, res) => {
	try {
		const { password } = req.body;

		if (!password) {
			return res
				.status(422)
				.json({ success: false, error: 'La contraseña es requerida.' });
		}

		const db = getDB();
		const user = db
			.prepare('SELECT password FROM users WHERE id = ?')
			.get(req.user.id);
		const isValid = await bcrypt.compare(password, user.password);

		if (!isValid) {
			return res
				.status(401)
				.json({ success: false, error: 'Contraseña incorrecta.' });
		}

		db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);

		return res.json({
			success: true,
			message: 'Cuenta eliminada correctamente.',
		});
	} catch (err) {
		console.error('Delete account error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al eliminar la cuenta.' });
	}
});

module.exports = router;
