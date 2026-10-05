// Local equipment design data. Inventory, prop assets and installation authority
// must come from the game server before production use.
const HuskyEquipment = {
  defaults: {
    item: 'axon_body4', inventory: 'unconfigured',
    bodyModelMale: '', bodyModelFemale: '',
    male: { x: 0, y: 0.18, z: 0.05 }, female: { x: 0, y: 0.18, z: 0.05 },
    readyDrainPerHour: 4, recordingDrainPerHour: 7, chargePerHour: 35,
    fleetShutdownSeconds: 300,
    vehiclePresets: [{ id: 'police-front', model: 'police', variation: 'Patrol · front/rear', agency: 'lspd', prop: '', front: { x: 0, y: 0.65, z: 0.65 }, rear: { x: 0, y: 0.20, z: 0.70 } }],
    serviceLocations: [{ id: 'mission-row-dock', name: 'Mission Row equipment desk', agency: 'lspd', x: 441.2, y: -981.9, z: 30.7, radius: 2, charge: true, exchange: true }]
  },
  advanceBattery(device, elapsedSeconds, settings) {
    if (device.type !== 'BODY 4') return { ...device, powerSource: 'vehicle' };
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return { ...device };
    const rate = device.docked ? settings.chargePerHour :
      device.state === 'recording' ? -settings.recordingDrainPerHour :
      device.state === 'ready' ? -settings.readyDrainPerHour : 0;
    const battery = Math.max(0, Math.min(100, (device.battery ?? 100) + rate * elapsedSeconds / 3600));
    return { ...device, battery, state: battery === 0 ? 'off' : device.state,
      batteryWarning: battery <= 5 ? 'Critical battery' : battery <= 10 ? 'Low battery' : '' };
  }
};
