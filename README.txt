AXON camera operations — standalone UI starter

Open html/index.html in a browser to preview. No build tools needed.
For FiveM: copy husky-axon_suite to your resources folder, add `ensure husky-axon_suite`
to server.cfg, then use /camera. Escape closes the dashboard.

Implemented: responsive dashboard, role previews, own-feed filtering,
bodycam/dashcam filtering, recording search, viewer dialogs, device inventory,
and locally saved admin settings. The preview role selector is a design tool.
It MUST be removed and replaced by authenticated server permissions before
production. The resource is a UI prototype, not a working recording system.

Pending integrations:
- Server-side Discord role lookup and automatic role refresh, with admin user
  override. Store the bot token in a private convar using `set`, never `setr`.
  No token belongs in client scripts, HTML, or localStorage.
- Enforce every live-view, recording-list, download, and settings request on
  the server. Officer identity must come from server player identifiers.
  Missing Discord identity or API failures must deny access.
- Select a real video capture/streaming service and evidence storage backend.
  The UI does not capture GTA gameplay. Download links need server-issued,
  short-lived authorization. Confirm external-browser handoff for saving
  videos to a PC, since FiveM NUI download behavior needs runtime validation.
- Integrate provided BODY 4 / FLEET 3 models and authorized AXON audio assets.
  Nearby tones need server-controlled proximity events; recorded tones must
  be mixed into the captured audio. Playback checkbox is a UI placeholder.
- Add persistent configuration, audit logs, device assignments, recording
  retention, and permission-revocation behavior.

No Discord requests, external video connections, or authentic AXON audio are
included. Sample feeds and evidence entries are clearly labeled. This is an
independent concept; no affiliation with AXON is implied.

Website / dispatcher option:
The same HTML dashboard runs in a normal browser. Dispatcher preview exposes
department live cameras and device assignments, with archive access disabled
by default. Admin preview includes a portal toggle and dispatcher Discord role
ID. These are local UI settings only, not active access controls.
Production website needs Discord OAuth sign-in, server-side role validation,
HTTPS hosting, session security, and the shared camera/evidence backend.
Keep the FiveM game server token off the website client. Dispatchers should
receive authorized stream access from the backend without joining FiveM.

Multi-agency UI:
Includes LSPD, BCSO, and SASP sample agencies, agency switching, agency-filtered
cameras/recordings, and overall-admin all-agency preview. Officers stay limited
to their own sample LSPD devices. Admins can add agencies, configure names,
enable/disable agencies, map agency-specific Discord roles, and enable each
agency's dispatcher website access. Changes persist in browser preview storage.
Global website enable and per-agency website switches are design settings only.
The production backend must intersect both settings and validate actual agency
membership. Agency admins/supervisors must stay within their own agencies;
only an explicitly configured overall admin can receive all-agency access.
Tag every stored device, stream, recording, and download authorization with an
agency ID. Do not trust the browser role selector or agency selection.

Expanded preview features:
- Agency admin role is restricted to the sample LSPD agency; overall admin can
  manage every agency. Actual Discord membership is not implemented.
- Per-agency dispatcher archive and download privileges; downloads also require
  agency and global download switches.
- Per-agency body/fleet visibility, retention, pre-event buffer (default 30s),
  recording reminder (default 120s), buffer audio, emergency lights/siren
  activation, and linked fleet/body capture configuration. Camera activation
  and audio settings are design settings only.
- Owned-camera ready/recording simulation. Stopping creates a session-only
  sample evidence record, without recording video. Front/rear fleet selector
  changes the preview label without switching a real camera.
- Local case numbers, categories, notes, and duration-validated bookmarks.
- Local activity history records preview actions. It is editable browser data,
  not an immutable evidence audit trail. Production must write server logs.

Evidence design references:
https://www.axon.com/help/axon-body-4/cameras-and-sensors/body/operation.htm
https://www.axon.com/help/fleet-3/cameras-and-sensors/fleet/3/user-guide/introduction.htm
https://www.axon.com/help/axon-evidence/software/axon-evidence/audit-trail/audit-trail.htm

Suggested implementation order:
1. Server identity and per-agency authorization, including Discord OAuth for
   dispatchers, role revocation, overall-admin bootstrap and private secrets.
2. Validate gameplay capture, live transport, synchronized game audio and
   actual download behavior on a FiveM test server. Choose storage and bandwidth
   limits before promising retention, pre-event buffering or video quality.
3. Persistent evidence metadata, case links, protected audit records, and
   authorized short-lived download links.
4. Physical BODY 4/FLEET 3 assets, audio files, proximity tones, recording HUD
   and game-event triggers; connect preview settings to runtime behavior.
5. Add ALPR integration, emergency alerts, game-world dispatch map, or
   redaction only after the recording and permission foundations work.

FiveM mounted POV preview:
Use /camera, open an owned sample live camera, and select Preview my mounted
POV in FiveM. This previews YOUR local officer or current vehicle, regardless
of the sample feed's name. For FLEET select front/rear before starting. Escape
or Return to dashboard restores gameplay rendering. Resource stop, death, ped
replacement, vehicle deletion/exit also clean up the camera. Fleet preview
requires game build 2189+. No remote player targeting is implemented.
The NUI frame exposes the dedicated scripted game camera beneath it. This is
a local render preview, not an encoded video inside an HTML video element. It
temporarily replaces the local game camera. Independent recording while the
player stays in third person still needs a validated capture/renderer backend.
Chest position follows a spine bone; direction follows the officer entity,
not mouse/gameplay-camera rotation. Tune offsets/FOV in camera_config.lua for
your ped clothes, physical camera model and vehicle interiors. Vehicle model
overrides can prevent dashboard clipping. Current offsets require in-game QA.

Mandatory media requirements are saved in capture_requirements.json:
- Native 3840x2160 archived video at a target 30 FPS, never upscale and call 4K.
- Gameplay audio, including engines, sirens and gunfire, must be captured and
  synchronized. Voice chat needs validation with the installed voice resource.
  NUI tones or a separate microphone track are not game-audio capture.
- Lower resolution 1080p live preview is the chosen starting point to reduce
  dispatch bandwidth; archive quality must remain independently validated.
- Hardware encoding and bounded buffering are preferred. A failed resolution,
  FPS or audio validation must show a capture failure rather than silent success.
- No working video/audio encoder or capture path is shipped. Mounted preview
  lets you hear gameplay normally but does not save audio or video.
- Zero lag cannot be promised without hardware and load tests. Measure client
  frame time, encoder latency, dropped frames, audio sync and network throughput.

POV natives reference:
https://github.com/citizenfx/natives/blob/master/CAM/AttachCamToPedBone.md
https://github.com/citizenfx/natives/blob/master/CAM/HardAttachCamToEntity.md

Synchronized recording requirement:
Capture video and gameplay audio using the same monotonic clock. Attach real
presentation timestamps to frames and audio samples; do not start separate
untimed recordings and concatenate them later. Prefer a 48 kHz audio pipeline.
The target maximum absolute A/V drift is 50 ms throughout a recording, including
after seeks. Detect timestamp resets, encoder backlog, interruptions and device
changes. During video frame drops preserve elapsed timestamps; do not compress
video time while audio continues. Finalize the container and verify real exported
files before reporting success. Preserve failed captures for diagnosis with an
explicit warning instead of presenting them as normal validated evidence.
html/media-contract.js validates diagnostic reports from a future backend. It
does not generate, probe, encode or independently verify a recording. Current UI
readiness remains unverified, and sample entries still have no audio/video files.

Agency management in the dashboard preview:
Select Overall admin, open Administration, and choose Add agency. Enter its
name, Discord role IDs and agency options, then Save settings. Existing agency
fields can be edited from the same panel. Remove agency excludes it from access
and active lists while retaining evidence records. Restore agency reverses that
removal. Agency admins cannot add, remove or restore agencies. Changes persist
in browser local storage; the optional loopback demo service shares snapshots.
These UI roles are preview controls, not production Discord authorization.
Server-side authenticated permissions and persistent evidence storage still
require implementation before use with real recordings.

Branding and watermark preview:
Overall admin > Branding & watermark offers panel title, accent color, compact
spacing, watermark placement, and optional agency/officer labels. The mark is
a styled AXON text/triangle placeholder, not an official logo asset.
Watermark date/time uses the FiveM server wall clock, sent every five seconds
and advanced with a monotonic browser timer between updates. Disconnected clocks
are marked stale after 15 seconds. The server host timezone determines display.
Device serial is always included when watermarking is enabled. Browser-only
preview and the demo website show awaiting FiveM until a trusted clock is wired.
No permanent video watermark or capture backend is implemented. Encoded video
needs the capture timeline mapped to server timestamps, not UI receipt times.

Watermark visual refinement: timestamp on first line, AXON device model and
serial together on second line, white text with a separate yellow triangle mark.
Optional agency/officer labels add lines below. Server timezone offsets are
shown accurately; Z is used only for UTC. No official logo asset is bundled.

Mounted local POV preview now uses the same watermark layout and server clock
as dashboard camera cards. This is a NUI overlay, not burned-in captured footage.
