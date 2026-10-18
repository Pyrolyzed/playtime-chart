local storage = require("storage")

---@ffi
--- A game started. Timestamps are unix milliseconds.
---@param appid number
---@param name string
---@param start_ms number
---@return string
function ptSessionStart(appid, name, start_ms)
    return storage.start(appid, name, start_ms)
end

---@ffi
--- A game exited.
---@param appid number
---@param end_ms number
---@return boolean
function ptSessionEnd(appid, end_ms)
    return storage.finish(appid, end_ms)
end

---@ffi
--- Keeps running sessions alive so a crash can be recovered at the last beat.
---@param now_ms number
---@return boolean
function ptHeartbeat(now_ms)
    storage.heartbeat(now_ms)
    return true
end

---@ffi
--- Every finished session as a JSON array string.
---@return string
function ptGetSessions()
    return storage.all_json()
end

---@ffi
---@param id string
---@return boolean
function ptDeleteSession(id)
    return storage.delete(id)
end
