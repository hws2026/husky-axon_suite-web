-- Server-only adapter. These exports are intended for trusted server resources.
-- No client can issue a camera or update battery metadata through these exports.
local adapter = GetConvar('husky_inventory', 'standalone')
local itemName = GetConvar('husky_body_item', 'axon_body4')
local standalone = {}
local function copy(value)
    if type(value) ~= 'table' then return value end
    local result = {}
    for key, item in pairs(value) do result[key] = copy(item) end
    return result
end

local function getItem(player, slot)
    if type(slot) ~= 'number' or slot < 1 or slot ~= math.floor(slot) then return nil end
    if adapter == 'ox_inventory' then
        if GetResourceState('ox_inventory') ~= 'started' then return nil end
        return exports.ox_inventory:GetSlot(player, slot)
    elseif adapter == 'qb-inventory' then
        if GetResourceState('qb-inventory') ~= 'started' then return nil end
        return exports['qb-inventory']:GetItemBySlot(player, slot)
    elseif adapter == 'standalone' then
        return standalone[player] and standalone[player][slot]
    end
    return nil
end

exports('GetBodyCameraItem', function(player, slot)
    local item = getItem(player, slot)
    if not item or item.name ~= itemName then return nil end
    return { slot = slot, metadata = copy(item.metadata or item.info or {}), count = item.count or item.amount or 1 }
end)

exports('SetBodyCameraMetadata', function(player, slot, expectedSerial, metadata)
    local item = getItem(player, slot)
    local previous = item and (item.metadata or item.info or {})
    if not item or item.name ~= itemName or type(metadata) ~= 'table'
        or previous.serial ~= expectedSerial or metadata.serial ~= expectedSerial then return false end
    if type(metadata.battery) ~= 'number' or metadata.battery < 0 or metadata.battery > 100 then return false end
    local nextMetadata = copy(metadata)
    if adapter == 'ox_inventory' then
        exports.ox_inventory:SetMetadata(player, slot, nextMetadata)
        return true
    elseif adapter == 'qb-inventory' then
        -- Slot-aware API varies by qb-inventory release. Explicitly validate the
        -- entire slot list via core rather than updating the first matching name.
        if GetResourceState('qb-core') ~= 'started' then return false end
        local core = exports['qb-core']:GetCoreObject()
        local qbPlayer = core.Functions.GetPlayer(player)
        if not qbPlayer then return false end
        local items = copy(qbPlayer.PlayerData.items)
        if not items[slot] or items[slot].name ~= itemName
            or (items[slot].info or {}).serial ~= expectedSerial then return false end
        items[slot].info = nextMetadata
        exports['qb-inventory']:SetInventory(player, items)
        return true
    elseif adapter == 'standalone' then
        standalone[player][slot].metadata = nextMetadata
        return true
    end
    return false
end)

exports('IssueBodyCameraItem', function(player, slot, metadata)
    if not GetPlayerName(player) or type(metadata) ~= 'table' or type(metadata.serial) ~= 'string'
        or metadata.serial == '' or type(metadata.battery) ~= 'number'
        or metadata.battery < 0 or metadata.battery > 100 then return false end
    if slot ~= nil and (type(slot) ~= 'number' or slot < 1 or slot ~= math.floor(slot)) then return false end
    if adapter == 'ox_inventory' and GetResourceState('ox_inventory') == 'started' then
        return exports.ox_inventory:AddItem(player, itemName, 1, copy(metadata), slot)
    elseif adapter == 'qb-inventory' and GetResourceState('qb-inventory') == 'started' then
        return exports['qb-inventory']:AddItem(player, itemName, 1, slot, copy(metadata), 'husky-camera-issue')
    elseif adapter == 'standalone' then
        standalone[player] = standalone[player] or {}
        slot = slot or 1
        if standalone[player][slot] then return false end
        standalone[player][slot] = { name = itemName, count = 1, metadata = copy(metadata) }
        return true
    end
    return false
end)

AddEventHandler('playerDropped', function() standalone[source] = nil end)
