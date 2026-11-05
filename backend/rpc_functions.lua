local storage = require("storage")
local cjson   = require("json")

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

---@ffi
--- Removes every finished session of the games. Returns a JSON object string.
---@param appids string comma separated
---@return string
function ptResetGames(appids)
    return cjson.encode(storage.reset_games(appids))
end

---@ffi
--- Where sessions are stored, as a JSON object string.
---@return string
function ptGetStorageInfo()
    return cjson.encode(storage.info())
end

---@ffi
--- Changes the data folder (empty restores the default). Returns a JSON object string.
---@param path string
---@return string
function ptSetDataDir(path)
    return cjson.encode(storage.set_data_dir(path))
end
