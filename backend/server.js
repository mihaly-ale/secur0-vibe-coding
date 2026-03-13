/**
 * server.js
 * Main Express server — Notes Manager API
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { getDB } = require('./database');
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Headers (Helmet) ─────────────────────────────────────────────────

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
				fontSrc: ["'self'", 'https://fonts.gstatic.com'],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", 'data:', 'blob:'],
			},
		},
		crossOriginEmbedderPolicy: false,
	})
);

// ─── CORS ──────────────────────────────────────────────────────────────────────

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
	.split(',')
	.map((o) => o.trim());

app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (mobile apps, Postman, curl)
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error(`CORS: origin ${origin} not allowed`));
			}
		},
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	})
);

// ─── Body Parsing ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Logging ───────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
	app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────────

// Global rate limiter
const globalLimiter = rateLimit({
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
	max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		error: 'Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.',
	},
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 min
	max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '15'),
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: true, // Only count failed requests
	message: {
		success: false,
		error: 'Demasiados intentos de autenticación. Espera 15 minutos.',
	},
});

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Static Frontend ───────────────────────────────────────────────────────────

const frontendPath = path.join(__dirname, './frontend');
app.use(express.static(frontendPath));

// ─── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
	const db = getDB();
	const dbOk = db.prepare('SELECT 1').get();

	res.json({
		success: true,
		status: 'ok',
		db: dbOk ? 'connected' : 'error',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
	});
});

// ─── SPA Fallback ──────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
	if (req.path.startsWith('/api/')) {
		return res
			.status(404)
			.json({ success: false, error: 'Endpoint no encontrado.' });
	}
	res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Global Error Handler ──────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
	console.error('Unhandled error:', err);

	// CORS errors
	if (err.message && err.message.startsWith('CORS:')) {
		return res
			.status(403)
			.json({ success: false, error: 'Acceso CORS denegado.' });
	}

	// JSON parse errors
	if (err.type === 'entity.parse.failed') {
		return res
			.status(400)
			.json({ success: false, error: 'JSON malformado en la petición.' });
	}

	// Payload too large
	if (err.status === 413) {
		return res
			.status(413)
			.json({ success: false, error: 'La petición es demasiado grande.' });
	}

	res.status(err.status || 500).json({
		success: false,
		error:
			process.env.NODE_ENV === 'production'
				? 'Error interno del servidor.'
				: err.message,
	});
});

// ─── Start Server ──────────────────────────────────────────────────────────────

// Initialize DB before starting
getDB();

const server = app.listen(PORT, () => {
	console.log(`
  ╔════════════════════════════════════════╗
  ║   📒 Notes Manager API                 ║
  ║   http://localhost:${PORT}              ║
  ║   Entorno: ${(process.env.NODE_ENV || 'development').padEnd(27)}║
  ╚════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
	console.log('⏳ SIGTERM received, closing server...');
	server.close(() => {
		console.log('✅ Server closed.');
		process.exit(0);
	});
});

process.on('SIGINT', () => {
	console.log('\n⏳ SIGINT received, closing server...');
	server.close(() => {
		console.log('✅ Server closed.');
		process.exit(0);
	});
});

module.exports = app;
