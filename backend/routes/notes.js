/**
 * routes/notes.js
 * Full CRUD for notes, with search, pin, archive
 */

const express = require('express');
const xss = require('xss');
const { getDB } = require('../backend/database');
const { authenticate } = require('../middleware/auth');
const {
	validateCreateNote,
	validateUpdateNote,
	validateNoteId,
	validateSearchQuery,
} = require('../middleware/validation');

const router = express.Router();

// All notes routes require authentication
router.use(authenticate);

// ─── Sanitize note data ────────────────────────────────────────────────────────

function sanitizeNote(data) {
	return {
		title: data.title ? xss(data.title.trim()) : undefined,
		content: data.content !== undefined ? xss(data.content) : undefined,
		color: data.color,
		pinned: data.pinned !== undefined ? (data.pinned ? 1 : 0) : undefined,
		archived: data.archived !== undefined ? (data.archived ? 1 : 0) : undefined,
	};
}

function formatNote(row) {
	if (!row) return null;
	return {
		...row,
		pinned: row.pinned === 1,
		archived: row.archived === 1,
	};
}

// ─── GET /notes ────────────────────────────────────────────────────────────────

router.get('/', validateSearchQuery, (req, res) => {
	try {
		const db = getDB();
		const { q, archived } = req.query;
		const userId = req.user.id;

		const showArchived = archived === 'true' ? 1 : 0;

		let sql, params;

		if (q && q.trim()) {
			const search = `%${q.trim()}%`;
			sql = `
        SELECT * FROM notes
        WHERE user_id = ? AND archived = ?
          AND (title LIKE ? OR content LIKE ?)
        ORDER BY pinned DESC, updated_at DESC
      `;
			params = [userId, showArchived, search, search];
		} else {
			sql = `
        SELECT * FROM notes
        WHERE user_id = ? AND archived = ?
        ORDER BY pinned DESC, updated_at DESC
      `;
			params = [userId, showArchived];
		}

		const notes = db
			.prepare(sql)
			.all(...params)
			.map(formatNote);

		return res.json({
			success: true,
			data: { notes, count: notes.length },
		});
	} catch (err) {
		console.error('Get notes error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al obtener las notas.' });
	}
});

// ─── GET /notes/:id ────────────────────────────────────────────────────────────

router.get('/:id', validateNoteId, (req, res) => {
	try {
		const db = getDB();
		const note = db
			.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
			.get(req.params.id, req.user.id);

		if (!note) {
			return res
				.status(404)
				.json({ success: false, error: 'Nota no encontrada.' });
		}

		return res.json({ success: true, data: { note: formatNote(note) } });
	} catch (err) {
		console.error('Get note error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al obtener la nota.' });
	}
});

// ─── POST /notes ───────────────────────────────────────────────────────────────

router.post('/', validateCreateNote, (req, res) => {
	try {
		const db = getDB();
		const {
			title,
			content = '',
			color = '#ffffff',
			pinned = false,
		} = sanitizeNote(req.body);

		const result = db
			.prepare(
				`
        INSERT INTO notes (user_id, title, content, color, pinned)
        VALUES (?, ?, ?, ?, ?)
      `
			)
			.run(req.user.id, title, content, color, pinned ? 1 : 0);

		const note = db
			.prepare('SELECT * FROM notes WHERE id = ?')
			.get(result.lastInsertRowid);

		return res.status(201).json({
			success: true,
			message: 'Nota creada correctamente.',
			data: { note: formatNote(note) },
		});
	} catch (err) {
		console.error('Create note error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al crear la nota.' });
	}
});

// ─── PUT /notes/:id ────────────────────────────────────────────────────────────

router.put('/:id', validateUpdateNote, (req, res) => {
	try {
		const db = getDB();

		// Verify ownership
		const existing = db
			.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
			.get(req.params.id, req.user.id);

		if (!existing) {
			return res
				.status(404)
				.json({ success: false, error: 'Nota no encontrada.' });
		}

		const updates = sanitizeNote(req.body);
		const fields = [];
		const values = [];

		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				fields.push(`${key} = ?`);
				values.push(value);
			}
		}

		if (fields.length === 0) {
			return res
				.status(422)
				.json({ success: false, error: 'No hay campos para actualizar.' });
		}

		values.push(req.params.id, req.user.id);

		db.prepare(
			`UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
		).run(...values);

		const note = db
			.prepare('SELECT * FROM notes WHERE id = ?')
			.get(req.params.id);

		return res.json({
			success: true,
			message: 'Nota actualizada correctamente.',
			data: { note: formatNote(note) },
		});
	} catch (err) {
		console.error('Update note error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al actualizar la nota.' });
	}
});

// ─── PATCH /notes/:id/pin ──────────────────────────────────────────────────────

router.patch('/:id/pin', validateNoteId, (req, res) => {
	try {
		const db = getDB();
		const note = db
			.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
			.get(req.params.id, req.user.id);

		if (!note) {
			return res
				.status(404)
				.json({ success: false, error: 'Nota no encontrada.' });
		}

		const newPinned = note.pinned === 1 ? 0 : 1;
		db.prepare('UPDATE notes SET pinned = ? WHERE id = ?').run(
			newPinned,
			note.id
		);

		return res.json({
			success: true,
			message: newPinned ? 'Nota fijada.' : 'Nota desfijada.',
			data: { pinned: newPinned === 1 },
		});
	} catch (err) {
		console.error('Pin note error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al fijar la nota.' });
	}
});

// ─── PATCH /notes/:id/archive ──────────────────────────────────────────────────

router.patch('/:id/archive', validateNoteId, (req, res) => {
	try {
		const db = getDB();
		const note = db
			.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
			.get(req.params.id, req.user.id);

		if (!note) {
			return res
				.status(404)
				.json({ success: false, error: 'Nota no encontrada.' });
		}

		const newArchived = note.archived === 1 ? 0 : 1;
		db.prepare('UPDATE notes SET archived = ?, pinned = 0 WHERE id = ?').run(
			newArchived,
			note.id
		);

		return res.json({
			success: true,
			message: newArchived ? 'Nota archivada.' : 'Nota restaurada.',
			data: { archived: newArchived === 1 },
		});
	} catch (err) {
		console.error('Archive note error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al archivar la nota.' });
	}
});

// ─── DELETE /notes/:id ─────────────────────────────────────────────────────────

router.delete('/:id', validateNoteId, (req, res) => {
	try {
		const db = getDB();
		const result = db
			.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
			.run(req.params.id, req.user.id);

		if (result.changes === 0) {
			return res
				.status(404)
				.json({ success: false, error: 'Nota no encontrada.' });
		}

		return res.json({
			success: true,
			message: 'Nota eliminada correctamente.',
		});
	} catch (err) {
		console.error('Delete note error:', err);
		return res
			.status(500)
			.json({ success: false, error: 'Error al eliminar la nota.' });
	}
});

module.exports = router;
