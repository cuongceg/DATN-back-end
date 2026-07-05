const postsModel = require('../models/posts.model');
const classesModel = require('../models/classes.model');

async function ensureClassAccess(user, classId) {
  const classData = await classesModel.findById(classId);

  if (!classData) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  if (user.role === 'teacher') {
    if (classData.teacher_id !== user.id) {
      const error = new Error('You do not have permission to access this class.');
      error.status = 403;
      throw error;
    }
    return classData;
  }

  if (user.role === 'student') {
    const isMember = await classesModel.checkMembership(classId, user.id);
    if (!isMember) {
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
  const posts = await postsModel.findByClass(classId, limit, offset);
  const totalCount = await postsModel.countByClass(classId);
  return { posts, totalCount };
}

async function getPostById(postId, user) {
  const post = await postsModel.findById(postId);

  if (!post) {
    const error = new Error('Post not found.');
    error.status = 404;
    throw error;
  }

  await ensureClassAccess(user, post.class_id);
  return post;
}

async function createPost(classId, user, { title, bodyDelta, bodyPlain }) {
  await ensureClassAccess(user, classId);
  return postsModel.create(classId, user.id, title, bodyDelta, bodyPlain);
}

async function updatePost(postId, user, {
  title,
  bodyDelta,
  bodyPlain,
  hasTitle,
  hasBodyDelta,
  hasBodyPlain,
}) {
  const post = await postsModel.findRawById(postId);

  if (!post) {
    const error = new Error('Post not found.');
    error.status = 404;
    throw error;
  }

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

  return postsModel.update(postId, hasTitle, title, hasBodyDelta, bodyDelta, hasBodyPlain, bodyPlain);
}

async function deletePost(postId, user) {
  const post = await postsModel.findRawById(postId);

  if (!post) {
    const error = new Error('Post not found.');
    error.status = 404;
    throw error;
  }

  if (post.type === 'session') {
    const error = new Error('Session posts cannot be deleted.');
    error.status = 400;
    throw error;
  }

  if (user.role === 'teacher') {
    const classResult = await classesModel.findByIdAndTeacher(post.class_id, user.id);
    if (!classResult) {
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

  return postsModel.deleteById(postId);
}

module.exports = { createPost, getPostsByClass, getPostById, updatePost, deletePost };
