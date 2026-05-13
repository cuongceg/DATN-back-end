const postsService = require('../services/posts.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

function hasBodyDeltaContent(bodyDelta) {
  if (!bodyDelta || typeof bodyDelta !== 'object') {
    return false;
  }

  if (Array.isArray(bodyDelta.ops)) {
    return bodyDelta.ops.length > 0;
  }

  return false;
}

async function createPost(req, res, next) {
  const { classId, title, bodyDelta, bodyPlain } = req.body;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  let normalizedTitle = null;
  if (title !== undefined) {
    if (typeof title !== 'string') {
      return res.status(400).json({ message: 'title must be a string.' });
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 500) {
      return res.status(400).json({ message: 'title must be at most 500 characters.' });
    }

    normalizedTitle = trimmedTitle.length > 0 ? trimmedTitle : null;
  }

  const trimmedBodyPlain = typeof bodyPlain === 'string' ? bodyPlain.trim() : '';
  const hasPlain = trimmedBodyPlain.length > 0;
  const hasDelta = hasBodyDeltaContent(bodyDelta);

  if (!hasPlain && !hasDelta) {
    return res.status(400).json({ message: 'bodyDelta or bodyPlain is required.' });
  }

  try {
    const post = await postsService.createPost(classId, req.user, {
      title: normalizedTitle,
      bodyDelta: hasDelta ? bodyDelta : null,
      bodyPlain: hasPlain ? trimmedBodyPlain : null,
    });

    return res.status(201).json({
      message: 'Post created successfully.',
      post,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getPostsByClass(req, res, next) {
  const { classId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = limitRaw === undefined ? 20 : Number.parseInt(limitRaw, 10);
  if (Number.isNaN(limit) || limit <= 0) {
    return res.status(400).json({ message: 'limit must be a positive integer.' });
  }

  const offset = offsetRaw === undefined ? 0 : Number.parseInt(offsetRaw, 10);
  if (Number.isNaN(offset) || offset < 0) {
    return res.status(400).json({ message: 'offset must be a non-negative integer.' });
  }

  const cappedLimit = Math.min(limit, 100);

  try {
    const { posts, totalCount } = await postsService.getPostsByClass(classId, req.user, {
      limit: cappedLimit,
      offset,
    });

    return res.status(200).json({
      posts,
      total_count: totalCount,
      limit: cappedLimit,
      offset,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getPostById(req, res, next) {
  const { postId } = req.params;

  if (!isUuid(postId)) {
    return res.status(400).json({ message: 'postId must be a valid UUID.' });
  }

  try {
    const post = await postsService.getPostById(postId, req.user);
    return res.status(200).json({ post });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function updatePost(req, res, next) {
  const { postId } = req.params;

  if (!isUuid(postId)) {
    return res.status(400).json({ message: 'postId must be a valid UUID.' });
  }

  const { title, bodyDelta, bodyPlain } = req.body;
  const hasTitle = title !== undefined;
  const hasBodyDelta = bodyDelta !== undefined;
  const hasBodyPlain = bodyPlain !== undefined;

  if (!hasTitle && !hasBodyDelta && !hasBodyPlain) {
    return res.status(400).json({ message: 'At least one field is required.' });
  }

  let normalizedTitle = undefined;
  if (hasTitle) {
    if (title !== null && typeof title !== 'string') {
      return res.status(400).json({ message: 'title must be a string.' });
    }

    if (typeof title === 'string') {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length > 500) {
        return res.status(400).json({ message: 'title must be at most 500 characters.' });
      }

      normalizedTitle = trimmedTitle.length > 0 ? trimmedTitle : null;
    } else {
      normalizedTitle = null;
    }
  }

  let normalizedBodyPlain = undefined;
  if (hasBodyPlain) {
    if (bodyPlain !== null && typeof bodyPlain !== 'string') {
      return res.status(400).json({ message: 'bodyPlain must be a string.' });
    }

    if (typeof bodyPlain === 'string') {
      const trimmedBodyPlain = bodyPlain.trim();
      normalizedBodyPlain = trimmedBodyPlain.length > 0 ? trimmedBodyPlain : null;
    } else {
      normalizedBodyPlain = null;
    }
  }

  let normalizedBodyDelta = undefined;
  if (hasBodyDelta) {
    if (bodyDelta !== null && typeof bodyDelta !== 'object') {
      return res.status(400).json({ message: 'bodyDelta must be an object.' });
    }

    normalizedBodyDelta = bodyDelta;
  }

  try {
    const post = await postsService.updatePost(postId, req.user, {
      title: normalizedTitle,
      bodyDelta: normalizedBodyDelta,
      bodyPlain: normalizedBodyPlain,
      hasTitle,
      hasBodyDelta,
      hasBodyPlain,
    });

    return res.status(200).json({
      message: 'Post updated successfully.',
      post,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deletePost(req, res, next) {
  const { postId } = req.params;

  if (!isUuid(postId)) {
    return res.status(400).json({ message: 'postId must be a valid UUID.' });
  }

  try {
    const deleted = await postsService.deletePost(postId, req.user);
    return res.status(200).json({
      message: 'Post deleted successfully.',
      post: deleted,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  createPost,
  getPostsByClass,
  getPostById,
  updatePost,
  deletePost,
};
