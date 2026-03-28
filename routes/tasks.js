const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { status, priority } = req.query;

  let query = 'SELECT * FROM tasks WHERE user_id = $1';
  const params = [req.session.userId];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  if (priority) {
    params.push(priority);
    query += ` AND priority = $${params.length}`;
  }

  query += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar tarefas' });
  }
});

router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { title, description, priority, due_date } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Título é obrigatório' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO tasks (user_id, title, description, priority, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.session.userId, title, description || null, priority || 'medium', due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

router.put('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { title, description, status, priority, due_date } = req.body;
  const taskId = req.params.id;

  try {
    const check = await pool.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, req.session.userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    const result = await pool.query(
      `UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4, due_date = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [title, description || null, status || 'pending', priority || 'medium', due_date || null, taskId, req.session.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
});

router.patch('/:id/status', async (req, res) => {
  const pool = req.app.locals.pool;
  const { status } = req.body;
  const taskId = req.params.id;

  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [status, taskId, req.session.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

router.delete('/:id', async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.session.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ message: 'Tarefa deletada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar tarefa' });
  }
});

module.exports = router;
