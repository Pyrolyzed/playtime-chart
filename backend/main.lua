local logger     = require("logger")
local millennium = require("millennium")
local storage    = require("storage")

-- registers the RPC functions the frontend calls via `backend.*`
require("rpc_functions")

local function on_load()
    logger:info("Playtime Chart loaded (Millennium " .. millennium.version() .. ")")
    storage.init()
    millennium.ready()
end

local function on_unload()
    logger:info("Playtime Chart unloaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
}
