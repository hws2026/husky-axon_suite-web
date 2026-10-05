-- Client-visible mounting geometry only. Never put Discord tokens here.
HuskyCameraConfig = {
    Body = {
        bone = 24818, -- SKEL_Spine2: chest, not head/gameplay camera.
        offset = { x = 0.0, y = 0.18, z = 0.05 },
        rotation = { pitch = -5.0, roll = 0.0, yaw = 0.0 },
        fov = 85.0
    },
    Fleet = {
        front = {
            offset = { x = 0.0, y = 0.65, z = 0.65 },
            rotation = { pitch = -3.0, roll = 0.0, yaw = 0.0 },
            fov = 90.0
        },
        rear = {
            offset = { x = 0.0, y = 0.20, z = 0.70 },
            rotation = { pitch = -12.0, roll = 0.0, yaw = 180.0 },
            fov = 90.0
        }
    },
    -- Optional per-vehicle mounts: [joaat('police')] = { front = {...}, rear = {...} }.
    VehicleOverrides = {}
}
