// Preview policy only. Production must enforce the same rules on the server.
const CameraPolicy = Object.freeze({
  canManage(role) { return role === 'admin' || role === 'agencyadmin'; },
  canAccessAgency(role, agency, assignedAgency = 'lspd') {
    if (!agency || agency.archived) return false;
    if (role === 'admin') return true;
    if (!agency.enabled) return false;
    if (role === 'officer' || role === 'agencyadmin') return agency.id === assignedAgency;
    if (role === 'dispatcher') return agency.web === true;
    return role === 'supervisor';
  },
  canViewRecording(role, record, agency) {
    if (!this.canAccessAgency(role, agency)) return false;
    if (role === 'officer') return record.owner === true;
    if (role === 'dispatcher') return agency.dispatcherArchive === true;
    return ['supervisor', 'agencyadmin', 'admin'].includes(role);
  },
  canDownload(role, record, agency, globalEnabled = true) {
    if (!globalEnabled || agency?.downloads === false) return false;
    if (!this.canViewRecording(role, record, agency)) return false;
    return role !== 'dispatcher' || agency.dispatcherDownloads === true;
  },
  deviceEnabled(device, agency, fleetEnabled = true) {
    if (!agency || agency.archived) return false;
    return device.type === 'BODY 4' ? agency.body !== false : fleetEnabled && agency.fleet !== false;
  }
});
