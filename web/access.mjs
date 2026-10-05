export function agencyAccess(userId, memberRoles, config) {
  const roles = new Set(memberRoles);
  const overallAdmin = config.overallAdminIds.includes(userId) || config.overallAdminRoles.some(id => roles.has(id));
  const agencies = config.agencies.filter(a => a.enabled !== false).flatMap(a => {
    const role = overallAdmin ? 'admin' : ['agencyadmin','supervisor','officer','dispatcher'].find(name => (a.roles[name] || []).some(id => roles.has(id)));
    return role ? [{ id: a.id, name: a.name, role }] : [];
  });
  return { overallAdmin, agencies, allowed: overallAdmin || agencies.length > 0 };
}
export function validateAccessConfig(config) {
  const ids = value => Array.isArray(value) && value.every(id => typeof id === 'string' && /^\d{17,20}$/.test(id));
  if (!config || !ids(config.overallAdminIds) || !ids(config.overallAdminRoles) || !Array.isArray(config.agencies)) throw new Error('Invalid access configuration.');
  const seen = new Set();
  for (const a of config.agencies) {
    if (!/^[a-z0-9_-]{1,40}$/.test(a.id) || seen.has(a.id) || typeof a.name !== 'string' || !a.roles) throw new Error('Invalid agency.');
    seen.add(a.id);
    for (const role of ['agencyadmin','supervisor','officer','dispatcher']) if (!ids(a.roles[role] || [])) throw new Error('Invalid role IDs.');
  }
  return config;
}
