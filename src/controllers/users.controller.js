const usersService = require('../services/users.service');

async function searchUsersByFullName(req, res, next) {
  const rawQuery = req.query.query || req.query.full_name;
  const fullName = typeof rawQuery === 'string' ? rawQuery : '';

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ message: 'query is required.' });
  }

  try {
    const users = await usersService.searchByFullName(req.user.id, fullName.trim());
    return res.status(200).json({ users });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  const { id } = req.params;

  try {
    const user = await usersService.deleteUser(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ message: 'User deleted successfully.', user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { searchUsersByFullName, deleteUser };
