const pool = require('../config/db');

const POST_FULL_SELECT = `
  SELECT p.id, p.class_id, p.author_id, p.type, p.title, p.body_delta, p.body_plain,
         p.session_id, p.created_at, p.updated_at,
         u.full_name AS author_name,
         s.title AS session_title,
         s.status AS session_status,
         s.scheduled_at AS session_scheduled_at
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN sessions s ON s.id = p.session_id
`;

async function findByClass(classId, limit, offset) {
  const { rows } = await pool.query(
    `${POST_FULL_SELECT}
     WHERE p.class_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [classId, limit, offset]
  );
  return rows;
}

async function countByClass(classId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS total_count FROM posts WHERE class_id = $1',
    [classId]
  );
  return rows[0]?.total_count || 0;
}

async function findById(postId) {
  const { rows } = await pool.query(
    `${POST_FULL_SELECT} WHERE p.id = $1`,
    [postId]
  );
  return rows[0] || null;
}

async function findRawById(postId) {
  const { rows } = await pool.query(
    'SELECT id, class_id, author_id, type FROM posts WHERE id = $1',
    [postId]
  );
  return rows[0] || null;
}

async function create(classId, authorId, title, bodyDelta, bodyPlain) {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO posts (class_id, author_id, type, title, body_delta, body_plain)
       VALUES ($1, $2, 'normal', $3, $4, $5)
       RETURNING id, class_id, author_id, type, title, body_delta, body_plain, session_id,
                 created_at, updated_at
     )
     SELECT i.id, i.class_id, i.author_id, i.type, i.title, i.body_delta, i.body_plain,
            i.session_id, i.created_at, i.updated_at,
            u.full_name AS author_name,
            s.title AS session_title,
            s.status AS session_status,
            s.scheduled_at AS session_scheduled_at
     FROM inserted i
     JOIN users u ON u.id = i.author_id
     LEFT JOIN sessions s ON s.id = i.session_id`,
    [classId, authorId, title, bodyDelta, bodyPlain]
  );
  return rows[0];
}

async function update(postId, hasTitle, title, hasBodyDelta, bodyDelta, hasBodyPlain, bodyPlain) {
  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE posts
       SET title = CASE WHEN $2 THEN $3 ELSE title END,
           body_delta = CASE WHEN $4 THEN $5 ELSE body_delta END,
           body_plain = CASE WHEN $6 THEN $7 ELSE body_plain END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, class_id, author_id, type, title, body_delta, body_plain, session_id,
                 created_at, updated_at
     )
     SELECT u1.id, u1.class_id, u1.author_id, u1.type, u1.title, u1.body_delta, u1.body_plain,
            u1.session_id, u1.created_at, u1.updated_at,
            u2.full_name AS author_name,
            s.title AS session_title,
            s.status AS session_status,
            s.scheduled_at AS session_scheduled_at
     FROM updated u1
     JOIN users u2 ON u2.id = u1.author_id
     LEFT JOIN sessions s ON s.id = u1.session_id`,
    [postId, hasTitle, title, hasBodyDelta, bodyDelta, hasBodyPlain, bodyPlain]
  );
  return rows[0];
}

async function deleteById(postId) {
  const { rows } = await pool.query(
    'DELETE FROM posts WHERE id = $1 RETURNING id',
    [postId]
  );
  return rows[0] || null;
}

module.exports = { findByClass, countByClass, findById, findRawById, create, update, deleteById };
