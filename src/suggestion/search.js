const { getIndex } = require('./loader');

function search(query, topic, limit = 5) {
  const index = getIndex();
  if (!index) return [];

  const parsedLimit = Number.parseInt(limit, 10);
  const normalizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;
  const safeLimit = Math.min(normalizedLimit, 10);

  let results = index.search(query, { limit: safeLimit * 3 });

  if (topic) {
    results = results.filter((r) => r.item && r.item.topic === topic);
  }

  return results.slice(0, safeLimit).map((r) => r.item);
}

module.exports = { search };
