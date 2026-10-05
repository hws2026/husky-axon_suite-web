RegisterNetEvent('husky:clock', function(clock)
    SendNUIMessage({ action = 'serverClock', clock = clock })
end)

local pov = nil
local syncRequestId = 0
local pendingSync = {}

RegisterNetEvent('husky:sync:response', function(requestId, result)
    local cb = pendingSync[requestId]
    if cb then pendingSync[requestId] = nil; cb(result) end
end)

RegisterNetEvent('husky:sync:snapshot', function(snapshot)
    SendNUIMessage({ action = 'syncSnapshot', snapshot = snapshot })
end)

RegisterNetEvent('husky:sync:status', function(status)
    SendNUIMessage({ action = 'syncStatus', status = status })
end)

local function syncRequest(method, data, cb)
    syncRequestId = syncRequestId + 1
    local id = syncRequestId
    pendingSync[id] = cb
    TriggerServerEvent('husky:sync:request', id, method, data)
    SetTimeout(8000, function()
        if pendingSync[id] then
            pendingSync[id] = nil
            cb({ ok = false, error = 'Sync request timed out.' })
        end
    end)
end

RegisterNUICallback('syncRead', function(_, cb) syncRequest('GET', {}, cb) end)
RegisterNUICallback('syncWrite', function(data, cb) syncRequest('PUT', data, cb) end)

local function stopPov(notify)
    if not pov then return end
    local old = pov
    pov = nil
    RenderScriptCams(false, false, 0, true, true)
    if DoesCamExist(old.cam) then DestroyCam(old.cam, false) end
    if notify then SendNUIMessage({ action = 'povStopped' }) end
end

local function startPov(mode)
    if mode ~= 'body' and mode ~= 'front' and mode ~= 'rear' then
        return { ok = false, error = 'Invalid camera view.' }
    end
    local ped = PlayerPedId()
    if not DoesEntityExist(ped) or IsEntityDead(ped) then
        return { ok = false, error = 'Your officer must be alive to preview a camera.' }
    end
    local target, mount
    if mode == 'body' then
        target = ped
        mount = HuskyCameraConfig.Body
    else
        target = GetVehiclePedIsIn(ped, false)
        if target == 0 then
            return { ok = false, error = 'Enter a vehicle to preview its FLEET 3 camera.' }
        end
        if GetGameBuildNumber() < 2189 then
            return { ok = false, error = 'Vehicle camera mounts require game build 2189 or newer.' }
        end
        local overrides = HuskyCameraConfig.VehicleOverrides[GetEntityModel(target)]
        mount = (overrides and overrides[mode]) or HuskyCameraConfig.Fleet[mode]
    end
    stopPov(false)
    local cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', false)
    if not DoesCamExist(cam) then
        return { ok = false, error = 'Unable to create the mounted camera.' }
    end
    SetCamFov(cam, mount.fov)
    SetCamNearClip(cam, 0.05)
    if mode == 'body' then
        AttachCamToPedBone(cam, ped, GetPedBoneIndex(ped, mount.bone),
            mount.offset.x, mount.offset.y, mount.offset.z, true)
        local rot = GetEntityRotation(ped, 2)
        -- Direction follows the officer's body; orbit camera input is never read.
        SetCamRot(cam, rot.x + mount.rotation.pitch, mount.rotation.roll,
            rot.z + mount.rotation.yaw, 2)
    else
        HardAttachCamToEntity(cam, target,
            mount.rotation.pitch, mount.rotation.roll, mount.rotation.yaw,
            mount.offset.x, mount.offset.y, mount.offset.z, true)
    end
    pov = { cam = cam, mode = mode, ped = ped, target = target, mount = mount }
    SetCamActive(cam, true)
    RenderScriptCams(true, false, 0, true, true)
    return { ok = true, mode = mode, localOnly = true }
end

RegisterCommand('camera', function()
    stopPov(true)
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open' })
end, false)

-- Geometry preview only. No remote player ID or entity can be supplied.
RegisterNUICallback('previewPov', function(data, cb)
    cb(startPov(data.mode))
end)

RegisterNUICallback('stopPov', function(_, cb)
    stopPov(true)
    cb({ ok = true })
end)

RegisterNUICallback('close', function(_, cb)
    stopPov(true)
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb({ ok = true })
end)

CreateThread(function()
    while true do
        if pov then
            local state = pov
            if PlayerPedId() ~= state.ped or IsEntityDead(state.ped)
                or not DoesEntityExist(state.target) or not DoesCamExist(state.cam)
                or (state.mode ~= 'body' and GetVehiclePedIsIn(state.ped, false) ~= state.target) then
                stopPov(true)
            else
                if state.mode == 'body' then
                    local rot = GetEntityRotation(state.ped, 2)
                    SetCamRot(state.cam, rot.x + state.mount.rotation.pitch,
                        state.mount.rotation.roll, rot.z + state.mount.rotation.yaw, 2)
                end
                HideHudAndRadarThisFrame()
                if IsDisabledControlJustPressed(0, 200) then stopPov(true) end
            end
            Wait(0)
        else
            Wait(200)
        end
    end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        stopPov(false)
        SetNuiFocus(false, false)
    end
end)
