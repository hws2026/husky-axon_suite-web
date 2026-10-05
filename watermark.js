// Display overlay only. Exported footage needs an encoder and capture timestamps.
globalThis.HuskyWatermark = {
 clock:null,
 receive(clock){
  if(!clock || !Number.isFinite(clock.unixSeconds) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(clock.displayTime))return;
  this.clock={...clock,received:performance.now(),calendar:Date.parse(clock.displayTime.replace(' ','T')+'Z')};
 },
 timestamp(){
  if(!this.clock)return 'SERVER TIME · awaiting FiveM';
  const elapsed=performance.now()-this.clock.received;
  if(elapsed>15000)return 'SERVER TIME · connection stale';
  return new Date(this.clock.calendar+elapsed).toISOString().replace('T',' ').slice(0,19)+this.offsetLabel();
 },
 offsetLabel(){
  const offset=String(this.clock?.offset||'');
  if(offset==='+0000'||offset==='-0000')return 'Z';
  if(/^[+-]\d{4}$/.test(offset))return offset.slice(0,3)+':'+offset.slice(3);
  return ' '+String(this.clock?.zone||'SERVER');
 },
 lines(camera,agency,options){
  const lines=[this.timestamp(),'AXON '+camera.type+' '+String(camera.id)];
  if(options.agencyLabel)lines.push(String(agency));
  if(options.officerLabel)lines.push(String(camera.name));
  return lines;
 }
};
