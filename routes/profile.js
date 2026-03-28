const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

router.put('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios' });
  }

  try {
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.session.userId]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'E-mail já está em uso' });
    }

    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email',
      [name, email, req.session.userId]
    );
    req.session.userName = result.rows[0].name;
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

router.put('/password', async (req, res) => {
  const pool = req.app.locals.pool;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
  }

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.session.userId]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ message: 'Senha atualizada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar senha' });
  }
});

router.delete('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Senha é obrigatória para deletar a conta' });
  }

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.session.userId]);
    const valid = await bcrypt.compare(password, result.rows[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.session.userId]);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Conta deletada com sucesso' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar conta' });
  }
});

module.exports = router;
