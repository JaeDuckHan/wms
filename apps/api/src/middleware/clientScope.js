function getScopedClientId(req) {
  if (req.user?.role !== "client_viewer") {
    return null;
  }

  const clientId = Number(req.user?.client_id || 0);
  return Number.isInteger(clientId) && clientId > 0 ? clientId : null;
}

function isScopedClientUser(req) {
  return getScopedClientId(req) != null;
}

module.exports = {
  getScopedClientId,
  isScopedClientUser
};
