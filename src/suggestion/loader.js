const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');

const FUSE_OPTIONS = {
  keys: ['q'],
  threshold: 0.4,
  minMatchCharLength: 2,
  includeScore: true,
  shouldSort: true,
};

let _index = null;
let _items = [];

function buildIndex() {
  const filePath = path.join(__dirname, '../data/questions.json');

  if (!fs.existsSync(filePath)) {
    console.warn('[suggestion] questions.json not found — suggestion disabled.');
    _items = [];
    _index = null;
    return;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.warn('[suggestion] questions.json is not an array — suggestion disabled.');
      _items = [];
      _index = null;
      return;
    }

    _items = parsed;
    _index = new Fuse(_items, FUSE_OPTIONS);
    console.log(`[suggestion] index built: ${_items.length} questions`);
  } catch (error) {
    console.warn('[suggestion] failed to build index — suggestion disabled.');
    console.warn(error);
    _items = [];
    _index = null;
  }
}

function getIndex() {
  return _index;
}

module.exports = { buildIndex, getIndex };
