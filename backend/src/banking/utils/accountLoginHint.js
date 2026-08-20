const buildAccountLoginHint = (username) => {
  if (typeof username !== 'string') return null;

  const normalized = username.trim();
  if (!normalized) return null;

  const identifier = normalized.includes('@')
    ? normalized.slice(0, normalized.indexOf('@'))
    : normalized;

  return `Login ending ${identifier.slice(-4)}`;
};

module.exports = { buildAccountLoginHint };
