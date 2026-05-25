const { performance } = require('perf_hooks');
const { search } = require('../suggestion/search');

const VALID_TOPICS = new Set(['ip', 'ipv4', 'classful', 'cidr', 'subnet', 'ipv6']);

function parseLimit(limitRaw) {
  if (limitRaw === undefined) return 5;
  const parsed = Number.parseInt(String(limitRaw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.min(parsed, 10);
}

function normalizeTopic(topicRaw) {
  if (typeof topicRaw !== 'string') return undefined;
  const normalized = topicRaw.trim().toLowerCase();
  if (!normalized) return undefined;
  return VALID_TOPICS.has(normalized) ? normalized : undefined;
}

async function getSuggestions(req, res) {
  const qRaw = req.query.q;
  const q = typeof qRaw === 'string' ? qRaw.trim() : '';

  if (!q) {
    return res.status(400).json({ message: 'q is required.' });
  }

  if (q.length < 2) {
    return res.status(400).json({ message: 'q must be at least 2 characters.' });
  }

  const limit = parseLimit(req.query.limit);
  const topic = normalizeTopic(req.query.topic);

  const t0 = performance.now();
  const results = search(q, topic, limit);
  const latency_ms = +(performance.now() - t0).toFixed(2);

  return res.status(200).json({ results, latency_ms });
}

module.exports = {
  getSuggestions,
};
