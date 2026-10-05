-- OPTIONAL SAMPLE-DATA BRIDGE. Disabled by default, never use with live evidence.
local enabled = GetConvarInt('husky_sync_demo', 0) == 1
local port = GetConvarInt('husky_sync_port', 8787)
local endpoint = ('http://127.0.0.1:%d/api/state'):format(port)
local revision = -1
local cached = nil
local lastRequest = {}

local function respond(player, requestId, result)
    TriggerClientEvent('husky:sync:response', player, requestId, result)
end

RegisterNetEvent('husky:sync:request', function(requestId, method, payload)
    local player = source
    if type(requestId) ~= 'number' or (method ~= 'GET' and method ~= 'PUT') then return end
    if not enabled then respond(player, requestId, { disabled = true }); return end
    local now = GetGameTimer()
    lastRequest[player] = lastRequest[player] or {}
    if lastRequest[player][method] and now - lastRequest[player][method] < 150 then
        respond(player, requestId, { ok = false, error = 'Sync request rate limited.' })
        return
    end
    lastRequest[player][method] = now
    local body = ''
    if method == 'PUT' then
        if type(payload) ~= 'table' then respond(player, requestId, { ok = false }); return end
        body = json.encode(payload)
        if #body > 140000 then respond(player, requestId, { ok = false, error = 'State too large.' }); return end
    elseif cached then
        respond(player, requestId, cached)
        return
    end
    PerformHttpRequest(endpoint, function(status, data)
        local ok, result = pcall(json.decode, data or '')
        if not ok or type(result) ~= 'table' then
            respond(player, requestId, { ok = false, error = 'Local sync service unavailable.' })
            return
        end
        if status ~= 200 and status ~= 409 then result.ok = false end
        respond(player, requestId, result)
    end, method, body, { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('playerDropped', function() lastRequest[source] = nil end)

if enabled then
    print('[husky-axon_suite] SAMPLE DATA SYNC ENABLED. No real authorization or evidence allowed.')
    CreateThread(function()
        local delay = 250
        while true do
            local completed = false
            PerformHttpRequest(endpoint, function(status, data)
                if status == 200 then
                    local ok, snapshot = pcall(json.decode, data or '')
                    if ok and type(snapshot) == 'table' and type(snapshot.revision) == 'number' then
                        cached = snapshot
                        if snapshot.revision ~= revision then
                            revision = snapshot.revision
                            TriggerClientEvent('husky:sync:snapshot', -1, snapshot)
                        end
                        delay = 250
                    end
                else
                    delay = math.min(delay * 2, 10000)
                    TriggerClientEvent('husky:sync:status', -1, 'Offline · local sync service unavailable')
                end
                completed = true
            end, 'GET', '', {})
            local started = GetGameTimer()
            while not completed and GetGameTimer() - started < 10000 do Wait(50) end
            Wait(completed and delay or 10000)
        end
    end)
end
