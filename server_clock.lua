-- Authoritative wall clock from the FiveM server, independent of demo sync.
CreateThread(function()
    while true do
        TriggerClientEvent('husky:clock', -1, {
            unixSeconds = os.time(),
            displayTime = os.date('%Y-%m-%d %H:%M:%S'),
            zone = os.date('%Z'),
            offset = os.date('%z')
        })
        Wait(5000)
    end
end)
