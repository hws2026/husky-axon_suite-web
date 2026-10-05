fx_version 'cerulean'
game 'gta5'
author 'Camera dashboard prototype'
description 'BODY 4 / FLEET 3 dashboard UI starter'
ui_page 'html/index.html'
files { 'html/index.html', 'html/style.css', 'html/app.js', 'html/policy.js', 'html/media-contract.js', 'html/sync-client.js', 'html/equipment.js', 'html/watermark.js' }
client_scripts { 'camera_config.lua', 'client.lua' }
server_script 'sync_bridge.lua'
server_script 'inventory_adapter.lua'

server_script 'server_clock.lua'
