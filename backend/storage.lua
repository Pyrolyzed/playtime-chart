-- Session storage.
--
--   sessions.jsonl : one finished session per line (append-only, crash safe)
--   active.json    : sessions currently running, with a "last_seen" heartbeat
--
-- A session is { id, appid, name, start, end, duration } where start/end are
-- unix milliseconds and duration is whole seconds.
local logger     = require("logger")
local millennium = require("millennium")
local fs         = require("fs")
local utils      = require("utils")
local cjson      = require("json") -- Millennium preloads cjson under the name "json"

local M = {}

local dir, sessions_path, active_path
local active = {} -- appid (string) -> { id, appid, name, start, last_seen }

local function write_active()
    utils.write_file(active_path, cjson.encode(active))
end

local function read_active()
    if not fs.exists(active_path) then return {} end
    local raw = utils.read_file(active_path)
    if not raw or raw == "" then return {} end
    local ok, data = pcall(cjson.decode, raw)
    if ok and type(data) == "table" then return data end
    return {}
end

local function append_session(s)
    utils.append_file(sessions_path, cjson.encode(s) .. "\n")
end

local function finish_record(rec, end_ms)
    if end_ms < rec.start then end_ms = rec.start end
    local duration = math.floor((end_ms - rec.start) / 1000)
    if duration < 1 then return false end
    append_session({
        id       = rec.id,
        appid    = rec.appid,
        name     = rec.name,
        start    = rec.start,
        ["end"]  = end_ms,
        duration = duration,
    })
    return true
end

--- Call once at plugin load. Sessions left open by a crash / force close are
--- closed at their last heartbeat so no time is invented.
function M.init()
    dir = fs.join(millennium.steam_path(), "config", "playtimechart")
    fs.create_directories(dir)
    sessions_path = fs.join(dir, "sessions.jsonl")
    active_path   = fs.join(dir, "active.json")

    local leftovers = read_active()
    local recovered = 0
    for _, rec in pairs(leftovers) do
        if finish_record(rec, rec.last_seen or rec.start) then recovered = recovered + 1 end
    end
    active = {}
    write_active()
    logger:info("Storage at " .. dir .. ", recovered " .. recovered .. " interrupted session(s)")
end

function M.start(appid, name, start_ms)
    local key = tostring(math.floor(appid))
    if active[key] then return active[key].id end
    local rec = {
        id        = string.format("%d-%s", start_ms, key),
        appid     = math.floor(appid),
        name      = name,
        start     = start_ms,
        last_seen = start_ms,
    }
    active[key] = rec
    write_active()
    return rec.id
end

function M.finish(appid, end_ms)
    local key = tostring(math.floor(appid))
    local rec = active[key]
    if not rec then return false end
    active[key] = nil
    local saved = finish_record(rec, end_ms)
    write_active()
    return saved
end

function M.heartbeat(now_ms)
    local any = false
    for _, rec in pairs(active) do
        rec.last_seen = now_ms
        any = true
    end
    if any then write_active() end
end

--- All finished sessions as a JSON array string (corrupt lines are skipped).
function M.all_json()
    if not fs.exists(sessions_path) then return "[]" end
    local raw = utils.read_file(sessions_path)
    if not raw or raw == "" then return "[]" end
    local parts = {}
    for line in raw:gmatch("[^\r\n]+") do
        if pcall(cjson.decode, line) then parts[#parts + 1] = line end
    end
    return "[" .. table.concat(parts, ",") .. "]"
end

function M.delete(id)
    if not fs.exists(sessions_path) then return false end
    local raw = utils.read_file(sessions_path) or ""
    local kept, removed = {}, false
    for line in raw:gmatch("[^\r\n]+") do
        local ok, s = pcall(cjson.decode, line)
        if ok and type(s) == "table" and s.id == id then
            removed = true
        else
            kept[#kept + 1] = line
        end
    end
    if removed then
        local out = #kept > 0 and (table.concat(kept, "\n") .. "\n") or ""
        utils.write_file(sessions_path, out)
    end
    return removed
end

return M
