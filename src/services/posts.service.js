const pool = require('../config/db');

async function ensureClassAccess(user, classId) {
  const classResult = await pool.query(
    'SELECT id, teacher_id FROM classes WHERE id = $1',
    [classId]
  );

  if (classResult.rows.length === 0) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  const classData = classResult.rows[0];

  if (user.role === 'teacher') {
    if (classData.teacher_id !== user.id) {
      const error = new Error('You do not have permission to access this class.');
      error.status = 403;
      throw error;
    }

    return classData;
  }

  if (user.role === 'student') {
    const memberResult = await pool.query(
      'SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2',
      [classId, user.id]
    );

    if (memberResult.rows.length === 0) {
      const error = new Error('You are not a member of this class.');
      error.status = 403;
      throw error;
    }

    return classData;
  }

  const error = new Error('You do not have permission to access this class.');
  error.status = 403;
  throw error;
}

async function getPostsByClass(classId, user, { limit, offset }) {
  await ensureClassAccess(user, classId);

  const postsResult = await pool.query(
    `SELECT p.id,
            p.class_id,
            p.author_id,
            p.type,
            p.title,
            p.body_delta,
            p.body_plain,
            p.session_id,
            p.created_at,
            p.updated_at,
            u.full_name AS author_name,
            s.title AS session_title,
            s.status AS session_status,
            s.scheduled_at AS session_scheduled_at
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN sessions s ON s.id = p.session_id
     WHERE p.class_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [classId, limit, offset]
  );

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS total_count FROM posts WHERE class_id = $1',
    [classId]
  );

  return {
    posts: postsResult.rows,
    totalCount: countResult.rows[0]?.total_count || 0,
  };
}

async function getPostById(postId, user) {
  const postResult = await pool.query(
    `SELECT p.id,
            p.class_id,
            p.author_id,
            p.type,
            p.title,
            p.body_delta,
            p.body_plain,
            p.session_id,
            p.created_at,
            p.updated_at,
            u.full_name AS author_name,
            s.title AS session_title,
            s.status AS session_status,
            s.scheduled_at AS session_scheduled_at
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN sessions s ON s.id = p.session_id
     WHERE p.id = $1`,
    [postId]
  );

  if (postResult.rows.length === 0) {
    const error = new Error('Post not found.');
    error.status = 404;
    throw error;
  }

  const post = postResult.rows[0];
  await ensureClassAccess(user, post.class_id);

  return post;
}

async function createPost(classId, user, { title, bodyDelta, bodyPlain }) {
  await ensureClassAccess(user, classId);

  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO posts (class_id, author_id, type, title, body_delta, body_plain)
       VALUES ($1, $2, 'normal', $3, $4, $5)
       RETURNING id, class_id, author_id, type, title, body_delta, body_plain, session_id,
                 created_at, updated_at
     )
     SELECT i.id,
            i.class_id,
            i.author_id,
            i.type,
            i.title,
            i.body_delta,
            i.body_plain,
            i.session_id,
            i.created_at,
            i.updated_at,
            u.full_name AS author_name,
            s.title AS session_title,
            s.status AS session_status,
            s.scheduled_at AS session_scheduled_at
     FROM inserted i
     JOIN users u ON u.id = i.author_id
     LEFT JOIN sessions s ON s.id = i.session_id`,
    [classId, user.id, title, bodyDelta, bodyPlain]
  );

  return result.rows[0];
}

async function updatePost(postId, user, {
  title,
  bodyDelta,
  bodyPlain,
  hasTitle,
  hasBodyDelta,
  hasBodyPlain,
}) {
  const postResult = await pool.query(
    'SELECT id, class_id, author_id, type FROM posts WHERE id = $1',
    [postId]
  );

  if (postResult.rows.length === 0) {
    const error = new Error('Post not found.');
    error.status = 404;
    throw error;
  }

  const post = postResult.rows[0];

  if (post.type === 'session') {
    const error = new Error('Session posts cannot be updated.');
    error.status = 400;
    throw error;
  }

  if (post.author_id !== user.id) {
    const error = new Error('You do not have permission to update this post.');
    error.status = 403;
    throw error;
  }

  const result = await pool.query(
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
     SELECT u1.id,
            u1.class_id,
            u1.author_id,
            u1.type,
            u1.title,
            u1.body_delta,
            u1.body_plain,
            u1.session_id,
            u1.created_at,
            u1.updated_at,
            u2.full_name AS author_name,
            s.title AS session_title,
            s.status AS session_status,
            s.scheduled_at AS session_scheduled_at
     FROM updated u1
     JOIN users u2 ON u2.id = u1.author_id
     LEFT JOIN sessions s ON s.id = u1.session_id`,
    [postId, hasTitle, title, hasBodyDelta, bodyDelta, hasBodyPlain, bodyPlain]
  );

  return result.rows[0];
}

async function deletePost(postId, user) {
  const postResult = await pool.query(
    'SELECT id, class_id, author_id, type FROM posts WHERE id = $1',
    [postId]
  );

  if (postResult.rows.length === 0) {
    const error = new Error('Post not found.');
    error.status = 404;
    throw error;
  }

  const post = postResult.rows[0];

  if (post.type === 'session') {
    const error = new Error('Session posts cannot be deleted.');
    error.status = 400;
    throw error;
  }

  if (user.role === 'teacher') {
    const classResult = await pool.query(
      'SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2',
      [post.class_id, user.id]
    );

    if (classResult.rows.length === 0) {
      const error = new Error('You do not have permission to delete this post.');
      error.status = 403;
      throw error;
    }
  } else if (user.role === 'student') {
    if (post.author_id !== user.id) {
      const error = new Error('You do not have permission to delete this post.');
      error.status = 403;
      throw error;
    }
  } else {
    const error = new Error('You do not have permission to delete this post.');
    error.status = 403;
    throw error;
  }

  const deleteResult = await pool.query(
    'DELETE FROM posts WHERE id = $1 RETURNING id',
    [postId]
  );

  return deleteResult.rows[0];
}

module.exports = {
  createPost,
  getPostsByClass,
  getPostById,
  updatePost,
  deletePost,
};
