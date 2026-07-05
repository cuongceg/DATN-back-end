const usersModel = require('../models/users.model');

async function findById(id) {
  return usersModel.findById(id);
}

async function searchByFullName(requesterId, fullName) {
  return usersModel.searchByFullName(requesterId, fullName);
}

async function deleteUser(id) {
  return usersModel.deleteById(id);
}

module.exports = { findById, searchByFullName, deleteUser };
