const inGame = typeof GetParentResourceName === 'function';
const app = document.querySelector('#app');
if (inGame) { app.classList.add('hidden'); document.body.classList.add('in-game'); }
let page = 'overview', role = 'supervisor', agency = 'lspd', activeItem = null, povActive = false, povBusy = false, dashboardSync = null, sharedSettings = null, syncEditDirty = false;
const defaultAgencies = [
 {id:'lspd',name:'Los Santos Police',enabled:true,web:true},
 {id:'bcso',name:'Blaine County Sheriff',enabled:true,web:true},
 {id:'sasp',name:'San Andreas State Police',enabled:true,web:true}
];
let agencies;
try { const saved=JSON.parse(localStorage.getItem('husky-agencies')||'null'); agencies=Array.isArray(saved)&&saved.length?saved:defaultAgencies; } catch { agencies=defaultAgencies; }
function globalSettings(){if(sharedSettings)return sharedSettings;try{return JSON.parse(localStorage.getItem('axon-preview-settings')||'{}')||{}}catch{return {}}}
const managedAgencies = () => agencies.filter(a=>!a.archived&&(role==='admin'||a.id==='lspd'));
const selectedAgency = () => agencies.find(a=>a.id===agency);
const canReadArchive = () => role!=='dispatcher'||selectedAgency()?.dispatcherArchive===true;
let equipment=structuredClone(HuskyEquipment.defaults);
try{const saved=JSON.parse(localStorage.getItem('husky-equipment-preview')||'null');if(saved)equipment={...equipment,...saved}}catch{}
let lastBatteryTick=Date.now();
function saveEquipment(){try{localStorage.setItem('husky-equipment-preview',JSON.stringify(equipment));dashboardSync?.changed();return true}catch{toast('Equipment settings could not be saved.');return false}}
function equipmentField(name,label,value,type='text'){return `<label>${label}<input name="${escapeHtml(name)}" type="${type}" ${type==='number'?'step="0.01" min="-10000" max="10000"':''} value="${escapeHtml(value)}" required></label>`}
function mountFields(prefix,values){return ['x','y','z'].map(axis=>equipmentField(prefix+'_'+axis,axis.toUpperCase()+' offset (m)',values[axis],'number')).join('')}
function equipmentPanel(){return `<form id="equipmentForm"><div class="settings"><article><h2>Inventory-backed BODY 4</h2><p class="notice">Item metadata owns the camera serial and battery. Attachment switches to the matching male/female asset without issuing a second camera.</p>${equipmentField('item','Inventory item name',equipment.item)}<label>Inventory adapter<select name="inventory">${['unconfigured','ox_inventory','qb-inventory','standalone'].map(v=>`<option ${v===equipment.inventory?'selected':''}>${v}</option>`).join('')}</select></label><label>Male model / EUP asset<input name="bodyModelMale" value="${escapeHtml(equipment.bodyModelMale)}" placeholder="Asset not installed"></label><label>Female model / EUP asset<input name="bodyModelFemale" value="${escapeHtml(equipment.bodyModelFemale)}" placeholder="Asset not installed"></label><h3>Male mounting profile</h3><div class="agency-fields">${mountFields('male',equipment.male)}</div><h3>Female mounting profile</h3><div class="agency-fields">${mountFields('female',equipment.female)}</div></article><article><h2>Power & servicing</h2><p class="notice">BODY 4 has an internal rechargeable battery. Use station charging or exchange the complete camera at an equipment desk.</p>${equipmentField('readyDrainPerHour','Ready drain (% / hour, RP setting)',equipment.readyDrainPerHour,'number')}${equipmentField('recordingDrainPerHour','Recording drain (% / hour, RP setting)',equipment.recordingDrainPerHour,'number')}${equipmentField('chargePerHour','Dock charge (% / hour, RP setting)',equipment.chargePerHour,'number')}${equipmentField('fleetShutdownSeconds','Fleet shutdown after ignition off (seconds)',equipment.fleetShutdownSeconds,'number')}<p class="notice">Rates are configurable roleplay values, not AXON hardware specifications. No battery drain timer runs inside the dashboard.</p></article></div><article class="agency-settings"><div class="section-title"><h2>Vehicle mounting presets</h2><button type="button" id="addVehiclePreset">Add vehicle preset</button></div><p class="notice">Model and variation identify an installation preset. Only overall admins configure or assign the fleet system. Mounts require the chosen licensed asset and in-game alignment.</p>${equipment.vehiclePresets.map(v=>`<fieldset><legend>${escapeHtml(v.id)}</legend><div class="agency-fields">${equipmentField(v.id+'_model','Vehicle spawn/model name',v.model)}${equipmentField(v.id+'_variation','Variation / preset name',v.variation)}<label>Agency<select name="${escapeHtml(v.id)}_agency">${agencies.map(a=>`<option value="${escapeHtml(a.id)}" ${v.agency===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}</select></label><label>Fleet prop asset<input name="${escapeHtml(v.id)}_prop" value="${escapeHtml(v.prop)}" placeholder="Asset not installed"></label></div><h3>Front camera position</h3><div class="agency-fields">${mountFields(v.id+'_front',v.front)}</div><h3>Rear camera position</h3><div class="agency-fields">${mountFields(v.id+'_rear',v.rear)}</div></fieldset>`).join('')}</article><article class="agency-settings"><div class="section-title"><h2>Dock / spare-camera locations</h2><button type="button" id="addServiceLocation">Add service location</button></div><p class="notice">Coordinates are world positions. Backend interactions must check player distance, agency access and inventory ownership.</p>${equipment.serviceLocations.map(l=>`<fieldset><legend>${escapeHtml(l.id)}</legend><div class="agency-fields">${equipmentField(l.id+'_name','Location name',l.name)}<label>Agency<select name="${escapeHtml(l.id)}_agency">${agencies.map(a=>`<option value="${escapeHtml(a.id)}" ${l.agency===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}</select></label>${['x','y','z','radius'].map(axis=>equipmentField(l.id+'_'+axis,axis==='radius'?'Interaction radius (m)':axis.toUpperCase(),l[axis],'number')).join('')}</div><label><input name="${escapeHtml(l.id)}_charge" type="checkbox" ${l.charge?'checked':''}> Charging dock</label><label><input name="${escapeHtml(l.id)}_exchange" type="checkbox" ${l.exchange?'checked':''}> Whole-camera exchange</label></fieldset>`).join('')}</article><div class="section-title"><p>Saved and shared as preview configuration.</p><button class="primary" type="submit">Save equipment setup</button></div></form>`}
const agencyName = id => agencies.find(a=>a.id===id)?.name || id;
function saveAgencies(){try{localStorage.setItem('husky-agencies',JSON.stringify(agencies));return true}catch{toast('Agency settings could not be saved.');return false}}
function agencyOptions(){return agencies.filter(a=>CameraPolicy.canAccessAgency(role,a))}
function agencyEditor(){return `<article class="agency-settings"><div class="section-title"><h2>${role==='admin'?'Multi-agency configuration':'Your agency configuration'}</h2>${role==='admin'?'<button type="button" id="addAgency">Add agency</button>':''}</div><p class="notice">Changes apply to the preview only. Each agency has separate roles and camera settings.</p><div class="agency-rows">${managedAgencies().map(a=>`<fieldset data-agency-id="${escapeHtml(a.id)}"><legend>${escapeHtml(a.id.toUpperCase())}</legend>${role==='admin'?`<button type="button" class="danger" data-remove-agency="${escapeHtml(a.id)}">Remove agency</button>`:''}<label>Agency name<input name="agency_${escapeHtml(a.id)}_name" type="text" required maxlength="80" value="${escapeHtml(a.name)}"></label><div class="agency-fields">${['admin','supervisor','officer','dispatcher'].map(r=>`<label>${r[0].toUpperCase()+r.slice(1)} role ID<input name="agency_${escapeHtml(a.id)}_${r}" type="text" inputmode="numeric" pattern="[0-9]{17,20}" value="${escapeHtml(a[r]||'')}" placeholder="Discord role ID"></label>`).join('')}</div><div class="agency-fields">${[['enabled','Agency enabled',true],['web','Dispatcher website access',false],['body','BODY 4 cameras',true],['fleet','FLEET 3 cameras',true],['downloads','Recording downloads',true],['dispatcherArchive','Dispatcher archive viewing',false],['dispatcherDownloads','Dispatcher downloads',false],['worldSounds','Nearby camera tones',true],['recordedSounds','Tones in recorded video',true],['bufferAudio','Audio in pre-event buffer',false],['autoLights','Record on emergency lights',true],['autoSiren','Record on siren',false],['linkedBody','Link fleet and body recording',true]].map(([key,label,fallback])=>`<label><input name="agency_${escapeHtml(a.id)}_${key}" type="checkbox" ${(a[key]??fallback)?'checked':''}> ${label}</label>`).join('')}<label>Pre-event buffer (seconds)<input name="agency_${escapeHtml(a.id)}_buffer" type="number" min="0" max="120" required value="${Number.isFinite(a.buffer)?a.buffer:30}"></label><label>Reminder interval (seconds)<input name="agency_${escapeHtml(a.id)}_reminder" type="number" min="30" max="600" required value="${Number(a.reminder)||120}"></label><label>Retention (days)<input name="agency_${escapeHtml(a.id)}_retention" type="number" min="1" max="3650" required value="${Number(a.retention)||30}"></label></div><p class="notice">Dispatcher downloads require archive viewing and recording downloads. Buffer, triggers, reminders, and retention are configuration previews; they do not capture or delete video.</p></fieldset>`).join('')}</div>${role==='admin'&&agencies.some(a=>a.archived)?`<div class="section-title"><h2>Removed agencies</h2></div>${agencies.filter(a=>a.archived).map(a=>`<div class="removed-agency"><span>${escapeHtml(a.name)}<small>Evidence retained · excluded from access</small></span><button type="button" data-restore-agency="${escapeHtml(a.id)}">Restore agency</button></div>`).join('')}`:''}</article>`}


const cameras = [
  {id:'B4-0241',name:'Jordan Mitchell',unit:'Officer · 2-LINCOLN-12',type:'BODY 4',owner:true,agency:'lspd'},
  {id:'F3-0812',name:'Patrol unit 812',unit:'Jordan Mitchell · Mission Row',type:'FLEET 3',owner:true,agency:'lspd'},
  {id:'B4-0198',name:'Alex Rivera',unit:'Officer · 2-ADAM-06',type:'BODY 4',owner:false,agency:'bcso'},
  {id:'F3-0736',name:'Patrol unit 736',unit:'Alex Rivera · Downtown',type:'FLEET 3',owner:false,agency:'bcso'}
];
const recordings = [
  {id:'EV-2026-1048',title:'Traffic stop · Vespucci Boulevard',officer:'Jordan Mitchell',type:'BODY 4',time:'Today, 14:32',duration:'08:42',owner:true,agency:'lspd'},
  {id:'EV-2026-1047',title:'Traffic stop · vehicle perspective',officer:'Jordan Mitchell',type:'FLEET 3',time:'Today, 14:32',duration:'11:06',owner:true,agency:'lspd'},
  {id:'EV-2026-1046',title:'Incident response · Legion Square',officer:'Alex Rivera',type:'BODY 4',time:'Today, 13:58',duration:'22:17',owner:false,agency:'bcso'},
  {id:'EV-2026-1045',title:'Routine patrol · Downtown',officer:'Alex Rivera',type:'FLEET 3',time:'Today, 13:24',duration:'16:39',owner:false,agency:'bcso'}
];
cameras.push({id:'B4-0301',name:'Sam Carter',unit:'Trooper · 1-STATE-03',type:'BODY 4',owner:false,agency:'sasp'}, {id:'F3-0901',name:'State patrol 901',unit:'Sam Carter · Route 68',type:'FLEET 3',owner:false,agency:'sasp'});
recordings.push({id:'EV-2026-1050',title:'Highway stop · Route 68',officer:'Sam Carter',type:'BODY 4',time:'Today, 15:10',duration:'09:18',owner:false,agency:'sasp'});
let evidenceState={},activity=[];
try{evidenceState=JSON.parse(localStorage.getItem('husky-evidence-preview')||'{}')||{};activity=JSON.parse(localStorage.getItem('husky-activity-preview')||'[]');if(!Array.isArray(activity))activity=[]}catch{}
cameras.forEach(c=>{c.state='ready';c.startedAt=null;if(c.type==='BODY 4')c.battery=92;c.docked=false});
function evidenceDetails(id){return evidenceState[id]||{caseNumber:'',category:'Uncategorized',notes:'',bookmarks:[]}}
function logActivity(action,item){
 const entry={id:Date.now()+'-'+Math.random().toString(36).slice(2),time:new Date().toISOString(),action,item:item.id,agency:item.agency,owner:item.owner===true,role};
 activity.push(entry);activity=activity.slice(-300);
 try{localStorage.setItem('husky-activity-preview',JSON.stringify(activity))}catch{}
 dashboardSync?.changed();
}
function activityPanel(){const entries=activity.filter(a=>(agency==='all'||a.agency===agency)&&CameraPolicy.canAccessAgency(role,agencies.find(x=>x.id===a.agency))&&(role!=='officer'||a.owner)&&(role!=='dispatcher'||a.action==='Opened live monitor'));
 return `<p class="notice">Local preview history only. Production audit records must be written by the server and protected against edits.</p><div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>TIME</th><th>ACTION</th><th>RESOURCE</th><th>AGENCY</th><th>PREVIEW ROLE</th></tr></thead><tbody>${entries.slice().reverse().map(a=>`<tr><td>${escapeHtml(new Date(a.time).toLocaleString())}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.item)}</td><td>${escapeHtml(agencyName(a.agency))}</td><td>${escapeHtml(a.role)}</td></tr>`).join('')||'<tr><td colspan="5">No activity yet. Open a camera or recording to begin.</td></tr>'}</tbody></table></div>`;
}
function evidenceEditor(item){const details=evidenceDetails(item.id),editable=role!=='dispatcher';
 return `<div class="evidence-panel"><h2>Evidence details</h2><form id="evidenceForm"><div class="agency-fields"><label>Case / incident number<input name="caseNumber" maxlength="80" value="${escapeHtml(details.caseNumber)}" ${editable?'':'disabled'} placeholder="e.g. LS-2026-1048"></label><label>Category<select name="category" ${editable?'':'disabled'}>${['Uncategorized','Traffic stop','Pursuit','Arrest','Use of force','Incident response','Routine patrol'].map(c=>`<option ${c===details.category?'selected':''}>${c}</option>`).join('')}</select></label></div><label>Notes<textarea name="notes" rows="3" maxlength="2000" ${editable?'':'disabled'} placeholder="Add relevant incident details">${escapeHtml(details.notes)}</textarea></label>${editable?'<button type="submit">Save evidence details</button>':''}</form><div class="section-title"><h2>Bookmarks</h2></div><div id="bookmarks">${bookmarkList(details)}</div>${editable?'<form id="bookmarkForm" class="toolbar"><input name="time" placeholder="MM:SS" pattern="[0-9]{1,3}:[0-5][0-9]" required aria-label="Bookmark timestamp"><input name="label" placeholder="Bookmark description" maxlength="120" required aria-label="Bookmark description"><button type="submit">Add bookmark</button></form>':''}<p class="notice">Bookmarks and evidence details are saved locally. No video is attached to this sample.</p></div>`;
}
function bookmarkList(details){return (details.bookmarks||[]).map(b=>`<div class="bookmark"><span class="tag">${escapeHtml(b.time)}</span> ${escapeHtml(b.label)}</div>`).join('')||'<p class="notice">No bookmarks yet.</p>'}
function persistEvidence(next){try{localStorage.setItem('husky-evidence-preview',JSON.stringify(next));evidenceState=next;syncEditDirty=false;dashboardSync?.changed();return true}catch{toast('Browser storage is unavailable; changes were not saved.');return false}}
function cameraControls(item){return `<div class="camera-control-bar"><span class="tag">${item.state==='recording'?'● DEMO RECORDING':'READY · DEMO'}</span>${item.type==='FLEET 3'?'<label>Camera view <select id="fleetView"><option>Front / road</option><option>Rear / prisoner compartment</option></select></label>':''}${item.owner&&role!=='dispatcher'?`<button id="toggleRecording" class="primary">${item.state==='recording'?'Stop demo recording':'Start demo recording'}</button>`:''}</div>${item.owner&&inGame?'<button id="previewMount">Preview my mounted POV in FiveM</button>':''}<p class="notice">Recording controls are simulated. Mounted POV uses your current officer or vehicle, not a remote stream.</p>`}
const visible = list => list.filter(item => {
 const config=agencies.find(a=>a.id===item.agency);
 if (!CameraPolicy.canAccessAgency(role,config) || !(agency==='all'||item.agency===agency)) return false;
 if (list===recordings) return CameraPolicy.canViewRecording(role,item,config);
 return (role!=='officer'||item.owner) && CameraPolicy.deviceEnabled(item,config,globalSettings().fleet!==false);
});
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',4200)}
function cameraCard(c){return `<article class="camera"><div class="scene ${c.type==='FLEET 3'?'fleet':''}"><div class="scene-top"><span class="live-badge">${c.state==='recording'?'● DEMO RECORDING':'● DEMO READY'}</span><span>AXON ${c.type} △</span></div>${watermarkMarkup(c)}<span class="scene-label">Stream preview · ${c.type==='BODY 4'?'Officer perspective':'Vehicle perspective'}</span><div class="scene-bottom">${c.id} · VIDEO SERVICE PENDING</div><button class="play" data-camera="${c.id}" aria-label="Open ${c.name} camera">↗</button></div><div class="camera-info"><div><strong>${c.name}</strong><small>${c.unit} · ${escapeHtml(agencyName(c.agency))}</small></div><span class="tag">${c.type}</span></div></article>`}
function rows(items){return items.map(r=>`<tr><td>${r.title}<small>${r.id} · ${escapeHtml(agencyName(r.agency))} · ${escapeHtml(evidenceDetails(r.id).category)}</small></td><td>${r.officer}</td><td><span class="tag">${r.type}</span></td><td>${r.time}</td><td>${r.duration}</td><td><button data-recording="${r.id}">View / download ↗</button></td></tr>`).join('') || '<tr><td colspan="6">No recordings match your search.</td></tr>'}
function table(items){return `<div class="table-wrap"><table><thead><tr><th>RECORDING</th><th>OFFICER</th><th>DEVICE</th><th>RECORDED</th><th>DURATION</th><th>ACTIONS</th></tr></thead><tbody>${rows(items)}</tbody></table></div>`}
function render(){
 applyAppearance();
 const allowed=agencyOptions();
 if(role==='officer'||role==='agencyadmin')agency='lspd';
 if(agency==='all'&&role!=='admin')agency=allowed[0]?.id||'';
 if(agency!=='all'&&!allowed.some(a=>a.id===agency))agency=allowed[0]?.id||'';
 const selector=document.querySelector('#agencySelect');
 selector.innerHTML=(role==='admin'?'<option value="all">All agencies</option>':'')+allowed.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
 selector.value=agency;selector.disabled=role==='officer'||role==='agencyadmin'||!allowed.length;
 document.querySelector('#agencyName').textContent=agency==='all'?'All agencies':agencyName(agency)||'No agency access';
 document.querySelector('nav button[data-page="live"] b').textContent=String(visible(cameras).length).padStart(2,'0');
 if(page==='appearance'&&role!=='admin')page='overview';
 if(page==='equipment'&&role!=='admin')page='devices';
 if(page==='admin'&&!CameraPolicy.canManage(role))page='overview';
 if(!canReadArchive()&&page==='recordings')page='live';
 document.querySelectorAll('nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page==='admin')b.classList.toggle('hidden',!CameraPolicy.canManage(role));if(b.dataset.page==='appearance')b.classList.toggle('hidden',role!=='admin');if(b.dataset.page==='equipment')b.classList.toggle('hidden',role!=='admin');if(b.dataset.page==='recordings')b.classList.toggle('hidden',!canReadArchive())});
 document.querySelector('#roleLabel').textContent=({agencyadmin:'Agency admin',admin:'Overall admin'})[role]||role[0].toUpperCase()+role.slice(1);
 const titles={appearance:['Branding & watermark','Customize the dashboard and camera overlay.'],overview:['Camera operations','A clear view of your officers, vehicles, and evidence.'],live:['Live cameras',role==='officer'?'Monitor your assigned bodycam and dashcam.':'Monitor bodycams and dashcams across your department.'],recordings:['Recording library',role==='officer'?'Review and download your own recordings.':'Review bodycam and vehicle evidence in one place.'],devices:['Device inventory','AXON BODY 4 and AXON FLEET 3 assignments.'],equipment:['Equipment setup','Configure inventory cameras, vehicle mounts, and service locations.'],activity:['Activity log','Review local preview camera and evidence actions.'],admin:['Administration','Manage Discord access, recording behavior, and camera audio.']};
 document.querySelector('#title').textContent=titles[page][0];document.querySelector('#subtitle').textContent=titles[page][1];document.querySelector('#crumb').textContent=page[0].toUpperCase()+page.slice(1);
 const cs=visible(cameras),rs=visible(recordings);let html='';syncEditDirty=false;
 if(page==='overview'){html=`<div class="stats">${[['Live cameras',String(cs.length).padStart(2,'0'),'Simulated active feeds'],['Body cameras',String(cs.filter(c=>c.type==='BODY 4').length).padStart(2,'0'),'AXON BODY 4'],['Fleet cameras',String(cs.filter(c=>c.type==='FLEET 3').length).padStart(2,'0'),'AXON FLEET 3'],['Recordings',String(rs.length).padStart(2,'0'),'Sample evidence records']].map(s=>`<div class="stat"><span class="label">${s[0]}</span><strong>${s[1]}</strong><small>${s[2]}</small></div>`).join('')}</div><div class="section-title"><h2>Live activity <span class="tag">DEMO</span></h2><button class="text-button" data-go="live">View all cameras ↗</button></div><div class="cameras">${cs.slice(0,2).map(cameraCard).join('')}</div><div class="section-title ${!canReadArchive()?'hidden':''}"><h2>Recent recordings</h2><button class="text-button" data-go="recordings">Open library ↗</button></div>${!canReadArchive()?'':table(rs.slice(0,3))}`}
 if(page==='live')html=`<div class="toolbar"><select id="cameraType" aria-label="Camera type"><option>All cameras</option><option>BODY 4</option><option>FLEET 3</option></select><span class="notice" style="margin:8px">${cs.length} cameras available in this role preview</span></div><div class="cameras" id="cameraGrid">${cs.map(cameraCard).join('')}</div>`;
 if(page==='recordings')html=`<div class="toolbar"><input id="search" type="search" placeholder="Search recording, officer, or evidence ID…" aria-label="Search recordings"><select id="recordingType" aria-label="Recording device"><option>All devices</option><option>BODY 4</option><option>FLEET 3</option></select></div>${table(rs)}`;
 if(page==='equipment'&&role==='admin')html=equipmentPanel();
 if(page==='appearance')html=appearancePanel();
 if(page==='activity')html=activityPanel();
 if(page==='devices')html=`<div class="table-wrap"><table><thead><tr><th>DEVICE ID</th><th>MODEL</th><th>ASSIGNMENT</th><th>POWER</th><th>INSTALLATION</th><th>STATUS</th></tr></thead><tbody>${cs.map(c=>`<tr><td>${c.id}</td><td>${c.type}</td><td>${c.name}<small>${c.unit} · ${escapeHtml(agencyName(c.agency))}</small></td><td>${c.type==='BODY 4'?Math.round(c.battery??100)+'% · internal battery':'Vehicle powered'}</td><td>${c.type==='FLEET 3'?(role==='admin'?`<select data-install-device="${c.id}" aria-label="Installation preset"><option value="">Not assigned</option>${equipment.vehiclePresets.filter(v=>v.agency===c.agency).map(v=>`<option value="${escapeHtml(v.id)}" ${c.installation===v.id?'selected':''}>${escapeHtml(v.model+' · '+v.variation)}</option>`).join('')}</select>`:escapeHtml(equipment.vehiclePresets.find(v=>v.id===c.installation)?.variation||'Not assigned')):'Inventory item · '+escapeHtml(equipment.item)}</td><td class="status">${c.state.toUpperCase()} · demo</td></tr>`).join('')}</tbody></table></div>`;
 if(page==='admin'&&CameraPolicy.canManage(role)){let settings={};settings=globalSettings();html=`<form id="settings">${agencyEditor()}<div class="settings ${role!=='admin'?'hidden':''}"><article><h2>Discord permissions</h2><p class="notice">Automatic role sync will use a server-side Discord bot.</p>${[['guild','Discord server ID'],['owner','Overall admin Discord user ID'],['admin','Admin role ID'],['supervisor','Supervisor role ID'],['officer','Officer role ID'],['dispatcher','Dispatcher role ID']].map(([key,label])=>`<label>${label}<input type="text" inputmode="numeric" name="${key}" value="${escapeHtml(settings[key]||'')}" placeholder="Discord snowflake ID" pattern="[0-9]{17,20}"></label>`).join('')}<p class="notice">Bot token: configure through a private server convar. Token entry and display are intentionally excluded from the NUI.</p></article><article><h2>Recording & audio</h2><div class="capture-requirements"><strong>Target: 4K · 30 FPS</strong><p>3840 × 2160 archive · mounted camera POV</p><p>Gameplay audio required · 48 kHz target</p><p>A/V sync target: ≤50 ms drift · shared capture clock</p><p>Live preview target: 1080p · 30 FPS</p><p>Capture readiness: not verified</p></div><label><input type="checkbox" name="webPortal" ${settings.webPortal===true?'checked':''}> Enable out-of-game dispatcher portal</label><label><input type="checkbox" name="worldSounds" ${settings.worldSounds!==false?'checked':''}> Camera tones audible to nearby players</label><label><input type="checkbox" name="recordedSounds" ${settings.recordedSounds!==false?'checked':''}> Include camera tones in recorded video</label><label><input type="checkbox" name="fleet" ${settings.fleet!==false?'checked':''}> Enable AXON FLEET 3 dashcams</label><label><input type="checkbox" name="downloads" ${settings.downloads!==false?'checked':''}> Allow authorized video downloads</label><p class="notice">Officers: own cameras and recordings.<br>Supervisors: selected agency cameras and recordings.<br>Dispatchers: department live cameras; no archive access by default.<br>Agency admins: their assigned agency configuration.<br>Overall admins: all agencies and system configuration.</p><p class="notice">Audio files, video storage, proximity playback, and server authorization are pending integration.</p></article></div><div class="section-title"><p>Settings save to this browser preview only.</p><button class="primary" type="submit">Save preview settings</button></div></form>`}
 document.querySelector('#body').innerHTML=html;
 bindEquipmentForm();
 bindAppearanceForm();
 document.querySelector('#cameraType')?.addEventListener('change',e=>{document.querySelector('#cameraGrid').innerHTML=cs.filter(c=>e.target.value==='All cameras'||c.type===e.target.value).map(cameraCard).join('')});
 const filter=()=>{const query=document.querySelector('#search').value.toLowerCase(),type=document.querySelector('#recordingType').value;document.querySelector('tbody').innerHTML=rows(rs.filter(r=>(type==='All devices'||r.type===type)&&(Object.values(r).join(' ')+' '+Object.values(evidenceDetails(r.id)).join(' ')).toLowerCase().includes(query)))};
 document.querySelector('#search')?.addEventListener('input',filter);document.querySelector('#recordingType')?.addEventListener('change',filter);
 document.querySelector('#settings')?.addEventListener('submit',e=>{
 e.preventDefault();if(!CameraPolicy.canManage(role))return;
 const form=e.currentTarget, editable=new Set(managedAgencies().map(a=>a.id));
 const next=agencies.map(a=>{
  if(!editable.has(a.id))return a;
  const get=key=>form.elements[`agency_${a.id}_${key}`];
  const update={...a,name:get('name').value.trim()||a.name,retention:Number(get('retention').value),buffer:Number(get('buffer').value),reminder:Number(get('reminder').value)};
  ['enabled','web','body','fleet','downloads','dispatcherArchive','dispatcherDownloads','worldSounds','recordedSounds','bufferAudio','autoLights','autoSiren','linkedBody'].forEach(key=>update[key]=get(key).checked);
  ['admin','supervisor','officer','dispatcher'].forEach(key=>update[key]=get(key).value);
  if(!update.dispatcherArchive)update.dispatcherDownloads=false;
  return update;
 });
 try{
  // Only commit the in-memory settings after the browser accepts the save.
  localStorage.setItem('husky-agencies',JSON.stringify(next));
  if(role==='admin'){
   const settings={...globalSettings(),...Object.fromEntries(new FormData(form))};
   Object.keys(settings).filter(key=>key.startsWith('agency_')).forEach(key=>delete settings[key]);
   ['worldSounds','recordedSounds','fleet','downloads','webPortal'].forEach(key=>settings[key]=form.elements[key].checked);
   localStorage.setItem('axon-preview-settings',JSON.stringify(settings));
  }
  agencies=next;sharedSettings=null;syncEditDirty=false;dashboardSync?.changed();toast(dashboardSync?.enabled?'Preview settings saved · sync pending.':'Preview settings saved on this device.');render();
 }catch{toast('Browser storage is unavailable; save could not be completed.')}
});
}
document.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;if(target.dataset.page||target.dataset.go){page=target.dataset.page||target.dataset.go;render()}if(target.dataset.camera||target.dataset.recording){const recording=!!target.dataset.recording;const item=visible(recording?recordings:cameras).find(x=>x.id===(target.dataset.recording||target.dataset.camera));if(!item)return;document.querySelector('#viewerTitle').textContent=recording?item.title:`${item.name} · ${item.type}`;document.querySelector('#viewerStatus').textContent=recording?'Recording service pending':'Live stream service pending';const config=agencies.find(a=>a.id===item.agency);
 const captureCheck=HuskyMediaContract.validate(null);
 const downloadAllowed=recording&&CameraPolicy.canDownload(role,item,config,globalSettings().downloads!==false);
 document.querySelector('#download').disabled=!downloadAllowed;
 document.querySelector('#downloadNote').textContent=recording?(downloadAllowed?'No recording file is connected yet. Video downloads require the recording backend.':'Downloads are disabled for this role or agency.'):'Live monitor preview. No stream is connected yet.';
 document.querySelector('#viewerMeta').innerHTML=`<div><small>AGENCY</small>${escapeHtml(agencyName(item.agency))}</div><div><small>${recording?'EVIDENCE ID':'DEVICE ID'}</small>${escapeHtml(item.id)}</div><div><small>DEVICE</small>${escapeHtml(item.type)}</div><div><small>${recording?'DURATION':'ASSIGNMENT'}</small>${escapeHtml(recording?item.duration:item.unit)}</div>`;
 document.querySelector('#videoSound').checked=config?.recordedSounds!==false;
 if(recording)document.querySelector('#downloadNote').textContent+=' Capture validation: '+captureCheck.errors[0];activeItem={item,recording};logActivity(recording?'Opened evidence viewer':'Opened live monitor',item);
 document.querySelector('#cameraControls').innerHTML=recording?'':cameraControls(item);
 document.querySelector('#evidenceEditor').innerHTML=recording?evidenceEditor(item):'';
 bindViewerControls();document.querySelector('#viewer').showModal()}});
document.querySelector('#agencySelect').addEventListener('change',e=>{agency=e.target.value;document.querySelector('#viewer').close();render()});
document.addEventListener('click',e=>{if(e.target.closest('#addAgency')&&role==='admin'){const form=document.querySelector('#settings');const draft=form?Array.from(form.elements).filter(el=>el.name).map(el=>({name:el.name,type:el.type,value:el.value,checked:el.checked})):[];const id='agency'+Date.now();agencies.push({id,name:'New agency',enabled:true,web:false});render();const refreshed=document.querySelector('#settings');draft.forEach(saved=>{const el=refreshed?.elements[saved.name];if(el){if(saved.type==='checkbox')el.checked=saved.checked;else el.value=saved.value}});toast('New agency draft added. Save settings to keep it.')}});
document.querySelector('#role').addEventListener('change',e=>{role=e.target.value;document.querySelector('#viewer').close();render()});
document.querySelector('#viewLive').onclick=()=>{page='live';render()};
document.querySelector('#dismiss').onclick=()=>document.querySelector('#viewer').close();
document.querySelector('#download').onclick=()=>{if(!activeItem?.recording)return;const item=activeItem.item,config=agencies.find(a=>a.id===item.agency);if(!visible(recordings).includes(item)||!CameraPolicy.canDownload(role,item,config,globalSettings().downloads!==false))return;logActivity('Requested download · no file connected',item);toast('No video file is connected. Download requires the recording backend.')};
function bindViewerControls(){
 document.querySelector('#previewMount')?.addEventListener('click',startMountedPov);
 document.querySelector('#fleetView')?.addEventListener('change',e=>{document.querySelector('#viewerStatus').textContent=e.target.value+' · stream service pending'});
 document.querySelector('#toggleRecording')?.addEventListener('click',()=>{
  const item=activeItem?.item;if(!item||!item.owner||role==='dispatcher'||!visible(cameras).includes(item))return;
  if(item.state==='ready'){item.state='recording';item.startedAt=Date.now();logActivity('Started simulated recording',item)}
  else{const seconds=Math.max(1,Math.floor((Date.now()-item.startedAt)/1000));item.state='ready';const record={id:'DEMO-'+Date.now(),title:'Simulated recording · '+item.name,officer:item.type==='BODY 4'?item.name:'Jordan Mitchell',type:item.type,time:'This session',duration:String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'),owner:item.owner,agency:item.agency};recordings.unshift(record);logActivity('Stopped simulated recording · sample created',record);toast('Sample evidence entry created. No video file was captured.');}
  document.querySelector('#cameraControls').innerHTML=cameraControls(item);bindViewerControls();render();
 });
 document.querySelector('#evidenceForm')?.addEventListener('submit',e=>{e.preventDefault();const item=activeItem?.item;if(!activeItem?.recording||role==='dispatcher'||!visible(recordings).includes(item))return;const values=Object.fromEntries(new FormData(e.currentTarget));const next={...evidenceState,[item.id]:{...evidenceDetails(item.id),...values}};if(persistEvidence(next)){logActivity('Updated evidence details',item);toast('Evidence details saved locally.');render()}});
 document.querySelector('#bookmarkForm')?.addEventListener('submit',e=>{e.preventDefault();const item=activeItem?.item;if(!activeItem?.recording||role==='dispatcher'||!visible(recordings).includes(item))return;const values=Object.fromEntries(new FormData(e.currentTarget)),parts=values.time.split(':').map(Number),duration=item.duration.split(':').map(Number);if(parts[0]*60+parts[1]>duration[0]*60+duration[1]){toast('Bookmark must fall within the recording duration.');return;}const details=evidenceDetails(item.id);const next={...evidenceState,[item.id]:{...details,bookmarks:[...(details.bookmarks||[]),values]}};if(persistEvidence(next)){logActivity('Added evidence bookmark',item);document.querySelector('#bookmarks').innerHTML=bookmarkList(evidenceDetails(item.id));e.currentTarget.reset();toast('Bookmark saved locally.')}});
} 
async function close(){if(povActive){await stopMountedPov();return;}document.querySelector('#viewer').close();if(inGame){try{await fetch(`https://${GetParentResourceName()}/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}catch{toast('Unable to close the dashboard; retry Escape.')}}else toast('Use /camera in FiveM to open and Escape to close.');}
document.querySelector('#close').onclick=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(povActive){e.preventDefault();stopMountedPov()}else if(!document.querySelector('#viewer').open)close()}});
window.addEventListener('message',e=>{if(e.data?.action==='syncSnapshot'&&dashboardSync?.enabled)dashboardSync.receive(e.data.snapshot);if(e.data?.action==='syncStatus')document.querySelector('#syncStatus').textContent=e.data.status;if(e.data?.action==='open')app.classList.remove('hidden');if(e.data?.action==='povStopped')resetMountedPov();if(e.data?.action==='close'){resetMountedPov();app.classList.add('hidden')}});
render();

async function nuiRequest(action,payload={}){
 const response=await fetch(`https://${GetParentResourceName()}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw new Error('NUI callback failed');return response.json();
}
async function startMountedPov(){
 if(!inGame||povBusy||!activeItem||activeItem.recording||!activeItem.item.owner)return;
 povBusy=true;
 const mode=activeItem.item.type==='BODY 4'?'body':(document.querySelector('#fleetView')?.selectedIndex===1?'rear':'front');
 try{const result=await nuiRequest('previewPov',{mode});if(!result.ok){toast(result.error||'POV unavailable.');return;}
 document.querySelector('#viewer').close();povActive=true;
 document.querySelector('#povWatermark').innerHTML=watermarkMarkup(activeItem.item);
 document.body.classList.add('pov-mode');app.classList.add('hidden');
 document.querySelector('#povPanel').classList.remove('hidden');
 document.querySelector('#povTitle').textContent=mode==='body'?'MY BODY 4 · CHEST POV':`MY FLEET 3 · ${mode.toUpperCase()} POV`;
 }catch{toast('Mounted POV could not start. Try again in FiveM.');try{await nuiRequest('stopPov')}catch{}}
 finally{povBusy=false;}
}
function resetMountedPov(){document.querySelector('#povWatermark').innerHTML='';povActive=false;document.body.classList.remove('pov-mode');document.querySelector('#povPanel').classList.add('hidden');app.classList.remove('hidden')}
async function stopMountedPov(){if(povBusy)return;povBusy=true;try{const result=await nuiRequest('stopPov');if(result.ok){resetMountedPov();render()}else toast('POV did not stop. Retry Escape.')}catch{toast('Unable to exit POV. Retry Escape or use /camera.')}finally{povBusy=false}}
document.querySelector('#exitPov').onclick=stopMountedPov;

function getSharedState(){return {agencies,cameras,recordings,evidence:evidenceState,activity,settings:globalSettings(),equipment}}
function applySharedState(state){
 if(!Array.isArray(state.agencies)||!Array.isArray(state.cameras)||!Array.isArray(state.recordings)||!Array.isArray(state.activity)||!state.evidence||!state.settings)throw new Error('Invalid sync state');
 agencies=state.agencies;cameras.splice(0,cameras.length,...state.cameras);recordings.splice(0,recordings.length,...state.recordings);
 evidenceState=state.evidence;activity=state.activity;sharedSettings=state.settings;if(state.equipment)equipment=state.equipment;
 try{localStorage.setItem('husky-agencies',JSON.stringify(agencies));localStorage.setItem('husky-evidence-preview',JSON.stringify(evidenceState));localStorage.setItem('husky-activity-preview',JSON.stringify(activity));localStorage.setItem('axon-preview-settings',JSON.stringify(sharedSettings));localStorage.setItem('husky-equipment-preview',JSON.stringify(equipment))}catch{}
 // Close an old viewer rather than leave a recording visible after access changes.
 document.querySelector('#viewer').close();activeItem=null;syncEditDirty=false;render();
}
document.addEventListener('input',e=>{if(e.target.closest?.('#settings, #equipmentForm, #appearanceForm, #evidenceForm, #bookmarkForm'))syncEditDirty=true});
document.addEventListener('change',e=>{if(e.target.closest?.('#settings, #equipmentForm, #appearanceForm, #evidenceForm, #bookmarkForm'))syncEditDirty=true});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-page], [data-go]')){syncEditDirty=false;dashboardSync?.applyPending()}});
if(typeof HuskyDashboardSync!=='undefined' && (inGame || (typeof location!=='undefined' && ['127.0.0.1','localhost'].includes(location.hostname) && location.protocol==='http:'))){
 dashboardSync=new HuskyDashboardSync({inGame,getState:getSharedState,applyState:applySharedState,isEditing:()=>syncEditDirty,
 onStatus:message=>document.querySelector('#syncStatus').textContent=message,
 onConflict:()=>{syncEditDirty=false;toast('Another panel saved first. Latest shared state loaded; reapply your edit.')}});
 dashboardSync.connect();
}

function captureEquipmentForm(){
 const form=document.querySelector('#equipmentForm');if(!form)return;
 const value=name=>form.elements[name].value, num=name=>Number(value(name)), coords=prefix=>Object.fromEntries(['x','y','z'].map(k=>[k,num(prefix+'_'+k)]));
 const next={...equipment,item:value('item').trim(),inventory:value('inventory'),bodyModelMale:value('bodyModelMale').trim(),bodyModelFemale:value('bodyModelFemale').trim(),male:coords('male'),female:coords('female')};
 for(const key of ['readyDrainPerHour','recordingDrainPerHour','chargePerHour','fleetShutdownSeconds']){next[key]=num(key);if(!Number.isFinite(next[key])||next[key]<0)throw new Error('Power rates and shutdown delay must be nonnegative.')}
 next.vehiclePresets=equipment.vehiclePresets.map(v=>({...v,model:value(v.id+'_model').trim(),variation:value(v.id+'_variation').trim(),agency:value(v.id+'_agency'),prop:value(v.id+'_prop').trim(),front:coords(v.id+'_front'),rear:coords(v.id+'_rear')}));
 next.serviceLocations=equipment.serviceLocations.map(l=>({...l,name:value(l.id+'_name').trim(),agency:value(l.id+'_agency'),...coords(l.id),radius:num(l.id+'_radius'),charge:form.elements[l.id+'_charge'].checked,exchange:form.elements[l.id+'_exchange'].checked}));
 if(next.serviceLocations.some(l=>l.radius<=0))throw new Error('Service radius must be greater than zero.');
 equipment=next;
}
function bindEquipmentForm(){
 document.querySelector('#equipmentForm')?.addEventListener('submit',e=>{e.preventDefault();if(role!=='admin')return;try{captureEquipmentForm();if(saveEquipment()){syncEditDirty=false;toast('Equipment preview configuration saved.');render()}}catch(error){toast(error.message)}});
 for(const [button,type] of [['#addVehiclePreset','vehicle'],['#addServiceLocation','service']])document.querySelector(button)?.addEventListener('click',()=>{if(role!=='admin')return;try{captureEquipmentForm();const id='preset'+Date.now();if(type==='vehicle')equipment.vehiclePresets.push({id,model:'police',variation:'New variant',agency:agency==='all'?agencies[0]?.id:agency,prop:'',front:{x:0,y:0.65,z:0.65},rear:{x:0,y:0.2,z:0.7}});else equipment.serviceLocations.push({id,name:'New equipment desk',agency:agency==='all'?agencies[0]?.id:agency,x:0,y:0,z:0,radius:2,charge:true,exchange:true});render();syncEditDirty=true;toast('Draft added. Save equipment setup to keep it.')}catch(error){toast(error.message)}});
}
document.addEventListener('change',e=>{const id=e.target.dataset?.installDevice;if(!id||role!=='admin')return;const device=cameras.find(c=>c.id===id),preset=equipment.vehiclePresets.find(v=>v.id===e.target.value&&v.agency===device?.agency);if(!device||!visible(cameras).includes(device))return;device.installation=preset?.id||'';logActivity('Updated demo fleet installation',device);dashboardSync?.changed();toast('Preview assignment saved. No physical vehicle has been modified.')});

document.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-remove-agency], [data-restore-agency]');if(!button||role!=='admin')return;
 const id=button.dataset.removeAgency||button.dataset.restoreAgency,target=agencies.find(a=>a.id===id);if(!target)return;
 const before=target.archived;target.archived=!!button.dataset.removeAgency;
 if(saveAgencies()){syncEditDirty=false;dashboardSync?.changed();render();toast(target.archived?'Agency removed from active access. Evidence retained; restore is available.':'Agency restored.')}else target.archived=before;
});

function appearanceSettings(){return {title:'AXON',accent:'#e7f56a',compact:false,watermark:true,agencyLabel:false,officerLabel:false,timeZone:'server',position:'top-right',...globalSettings().appearance}}
function watermarkMarkup(camera){
 const options=appearanceSettings();if(!options.watermark)return '';
 const lines=HuskyWatermark.lines(camera,agencyName(camera.agency),options,new Date());
 return `<div class="camera-watermark ${options.position==='top-left'?'top-left':'top-right'}"><div class="watermark-copy">${lines.map((line,index)=>index===0?`<span class="watermark-time">${escapeHtml(line)}</span>`:`<span>${escapeHtml(line)}</span>`).join('')}</div><svg class="watermark-triad" viewBox="0 0 48 44" aria-hidden="true"><path d="M24 3 L45 40 H3 Z" fill="none" stroke="#ffdf00" stroke-width="5" stroke-linejoin="miter"/><path d="M24 14 L34 33 H14 Z" fill="none" stroke="#ffdf00" stroke-width="2"/></svg></div>`;
}
function applyAppearance(){
 const options=appearanceSettings();
 const accent=/^#[0-9a-f]{6}$/i.test(options.accent)?options.accent:'#e7f56a';
 if(typeof document.documentElement?.style?.setProperty==='function')document.documentElement.style.setProperty('--yellow',accent);
 document.body?.classList?.toggle('compact',options.compact===true);
 document.querySelector('#brandTitle').textContent=String(options.title||'AXON').slice(0,40);
}
function appearancePanel(){
 const options=appearanceSettings(),sample={id:'B4-0241',type:'BODY 4',name:'Jordan Mitchell',agency:'lspd'};
 return `<form id="appearanceForm"><div class="settings"><article><h2>Dashboard branding</h2><label>Panel title<input name="title" required maxlength="40" value="${escapeHtml(options.title)}"></label><label>Accent color<input name="accent" type="color" value="${/^#[0-9a-f]{6}$/i.test(options.accent)?options.accent:'#e7f56a'}"></label><label><input name="compact" type="checkbox" ${options.compact?'checked':''}> Compact panel spacing</label><p class="notice">The AXON text and triangle are a styled placeholder, not an official logo asset.</p></article><article><h2>Recording watermark</h2>${[['watermark','Show camera watermark'],['agencyLabel','Include agency'],['officerLabel','Include officer / unit']].map(([name,label])=>`<label><input name="${name}" type="checkbox" ${options[name]?'checked':''}> ${label}</label>`).join('')}<label>Time basis<input value="FiveM server clock" readonly></label><label>Position<select name="position"><option value="top-right" ${options.position==='top-right'?'selected':''}>Upper right · AXON layout</option><option value="top-left" ${options.position==='top-left'?'selected':''}>Upper left</option></select></label><p class="notice">Date, time and device serial stay included. Gameplay audio is mandatory; mute is not offered. Display time comes from the FiveM server. Export timestamps must use the same server clock mapping and capture timeline.</p></article></div><article class="agency-settings"><h2>Watermark preview</h2><div class="scene watermark-example">${watermarkMarkup(sample)}<span class="scene-label">Sample camera frame · no footage</span></div><p class="notice">This is a dashboard overlay. Permanent watermarking of exported recordings awaits the capture/encoder backend.</p></article><div class="section-title"><p>Applies to the panel and sample camera cards.</p><button type="submit" class="primary">Save appearance</button></div></form>`;
}
function bindAppearanceForm(){document.querySelector('#appearanceForm')?.addEventListener('submit',event=>{
 event.preventDefault();if(role!=='admin')return;const form=event.currentTarget;
 const appearance={title:form.elements.title.value.trim()||'AXON',accent:form.elements.accent.value,compact:form.elements.compact.checked,watermark:form.elements.watermark.checked,agencyLabel:form.elements.agencyLabel.checked,officerLabel:form.elements.officerLabel.checked,timeZone:'server',position:form.elements.position.value};
 const next={...globalSettings(),appearance};try{localStorage.setItem('axon-preview-settings',JSON.stringify(next));sharedSettings=next;syncEditDirty=false;dashboardSync?.changed();render();toast('Appearance and watermark preview saved.')}catch{toast('Appearance could not be saved.')}
})}

window.addEventListener('message',event=>{
 if(event.data?.action!=='serverClock')return;
 HuskyWatermark.receive(event.data.clock);
 document.querySelectorAll('.camera-watermark').forEach(element=>{
  const line=element.querySelector('.watermark-time');if(line)line.textContent=HuskyWatermark.timestamp();
 });
});
if(typeof setInterval==='function')setInterval(()=>{
 document.querySelectorAll('.watermark-time').forEach(line=>line.textContent=HuskyWatermark.timestamp());
},1000);
