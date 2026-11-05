-- Session storage.
--
-- In the data folder (configurable, e.g. a network share):
--   sessions.jsonl : one finished session per line (append-only, crash safe)
--
-- Always in <Steam>/config/playtimechart, so they work per PC and without the share:
--   settings.json  : { data_dir } when a custom data folder is set
--   active.json    : sessions currently running, with a "last_seen" heartbeat
--   pending.jsonl  : finished sessions waiting for an unreachable data folder
--
-- A session is { id, appid, name, start, end, duration } where start/end are
-- unix milliseconds and duration is whole seconds.
local logger     = require("logger")
local millennium = require("millennium")
local fs         = require("fs")
local utils      = require("utils")
local cjson      = require("json") -- Millennium preloads cjson under the name "json"

local M = {}

local local_dir, settings_path, active_path, pending_path
local data_dir, sessions_path
local custom_dir = false
local active = {} -- appid (string) -> { id, appid, name, start, last_seen }

--- Uses the platform's separator throughout: Steam's path has forward slashes
--- even on Windows, where fs.join adds backslashes.
local function normalize(path)
    return fs.join("a", "b"):sub(2, 2) == "\\" and (path:gsub("/", "\\")) or path
end

local function use_data_dir(path)
    custom_dir = path ~= nil
    data_dir = path and normalize(path) or local_dir
    sessions_path = fs.join(data_dir, "sessions.jsonl")
end

--- The folder is only ever created when the user sets it. Recreating it at
--- runtime could put data on the local disk under an unmounted share's path.
local function data_available()
    return fs.is_directory(data_dir)
end

local function saved_data_dir()
    if not fs.exists(settings_path) then return nil end
    local ok, data = pcall(cjson.decode, utils.read_file(settings_path) or "")
    if ok and type(data) == "table" and type(data.data_dir) == "string" then return data.data_dir end
    return nil
end

--- Moves sessions saved while the data folder was unreachable into it.
local function flush_pending()
    if not fs.exists(pending_path) then return true end
    if not data_available() then return false end
    local raw = utils.read_file(pending_path)
    if not raw then return false end
    if raw ~= "" and not utils.append_file(sessions_path, raw) then return false end
    fs.remove(pending_path)
    return true
end

--- Calls fn(line) for each valid line of a sessions file, once per session id.
local function each_session(raw, seen, fn)
    for line in raw:gmatch("[^\r\n]+") do
        local ok, s = pcall(cjson.decode, line)
        if ok and type(s) == "table" then
            local key = s.id or line
            if not seen[key] then
                seen[key] = true
                fn(line)
            end
        end
    end
end

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
    local line = cjson.encode(s) .. "\n"
    if flush_pending() and utils.append_file(sessions_path, line) then return end
    logger:warn("Data folder unreachable, keeping session locally: " .. data_dir)
    utils.append_file(pending_path, line)
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
    local_dir = fs.join(millennium.steam_path(), "config", "playtimechart")
    fs.create_directories(local_dir)
    -- canonical also restores the real casing, which Steam's path lowercases
    local_dir = normalize(fs.canonical(local_dir) or local_dir)
    settings_path = fs.join(local_dir, "settings.json")
    active_path   = fs.join(local_dir, "active.json")
    pending_path  = fs.join(local_dir, "pending.jsonl")
    use_data_dir(saved_data_dir())
    flush_pending()

    local leftovers = read_active()
    local recovered = 0
    for _, rec in pairs(leftovers) do
        if finish_record(rec, rec.last_seen or rec.start) then recovered = recovered + 1 end
    end
    active = {}
    write_active()
    local state = data_available() and "" or " (unreachable)"
    logger:info("Storage at " .. data_dir .. state .. ", recovered " .. recovered .. " interrupted session(s)")
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

--- All finished sessions as a JSON array string (corrupt lines are skipped),
--- including any still waiting for an unreachable data folder.
function M.all_json()
    flush_pending()
    local parts, seen = {}, {}
    local function add(line) parts[#parts + 1] = line end
    for _, path in ipairs({ sessions_path, pending_path }) do
        if fs.exists(path) then each_session(utils.read_file(path) or "", seen, add) end
    end
    return "[" .. table.concat(parts, ",") .. "]"
end

--- Removes the sessions matching `drop` from a sessions file, keeping every other
--- line as is. Returns the number removed, or nil if the file couldn't be changed.
local function remove_sessions(path, drop)
    if not fs.exists(path) then return 0 end
    local raw = utils.read_file(path)
    if not raw then return nil end
    local kept, removed = {}, 0
    for line in raw:gmatch("[^\r\n]+") do
        local ok, s = pcall(cjson.decode, line)
        if ok and type(s) == "table" and drop(s) then
            removed = removed + 1
        else
            kept[#kept + 1] = line
        end
    end
    if removed > 0 then
        -- written beside the original and renamed, so a dropped connection can't truncate it
        local tmp = path .. ".tmp"
        local out = #kept > 0 and (table.concat(kept, "\n") .. "\n") or ""
        if not utils.write_file(tmp, out) or not fs.rename(tmp, path) then
            fs.remove(tmp)
            return nil
        end
    end
    return removed
end

function M.delete(id)
    if not flush_pending() then return false end
    local removed = remove_sessions(sessions_path, function(s) return s.id == id end)
    return removed ~= nil and removed > 0
end

--- Removes every finished session of the given games, in one write so a selection
--- can't end up half reset. `appids` is comma separated. Returns { ok, error?, removed? }.
function M.reset_games(appids)
    local ids = {}
    for id in appids:gmatch("%d+") do ids[tonumber(id)] = true end
    for _, rec in pairs(active) do
        if ids[rec.appid] then
            return { ok = false, error = "Close " .. rec.name .. " before resetting its data. Nothing was reset." }
        end
    end
    -- refused while unreachable: the sessions on the share would come back later
    if not data_available() or not flush_pending() then
        return { ok = false, error = "Can't reach the data folder " .. data_dir .. ", so nothing was reset." }
    end

    local function drop(s) return s.appid ~= nil and ids[s.appid] == true end
    local removed = remove_sessions(sessions_path, drop)
    if not removed then
        return { ok = false, error = "Could not update " .. sessions_path }
    end

    -- A flush that couldn't clean up leaves copies in pending. The default folder keeps a
    -- copy after moving to a custom one, which switching back would otherwise merge in.
    for _, path in ipairs({ pending_path, fs.join(local_dir, "sessions.jsonl") }) do
        if not remove_sessions(path, drop) then
            logger:warn("Could not remove apps " .. appids .. " from " .. path)
        end
    end

    logger:info("Reset apps " .. appids .. ", removed " .. removed .. " session(s)")
    return { ok = true, removed = removed }
end

function M.info()
    return {
        dir         = data_dir,
        default_dir = local_dir,
        custom      = custom_dir,
        available   = data_available(),
        pending     = fs.exists(pending_path),
    }
end

--- Adds the current folder's sessions that the target doesn't have yet. It only
--- appends, so history already in the target is never rewritten, and the source
--- is left as it was. Returns the number copied, or nil and an error.
local function copy_sessions_to(target)
    if not fs.exists(sessions_path) then return 0 end
    local source_raw = utils.read_file(sessions_path)
    if not source_raw then return nil, "Could not read " .. sessions_path end

    local target_raw = ""
    if fs.exists(target) then
        target_raw = utils.read_file(target)
        if not target_raw then return nil, "Could not read " .. target end
    end

    local seen, lines = {}, {}
    each_session(target_raw, seen, function() end)
    each_session(source_raw, seen, function(line) lines[#lines + 1] = line end)
    if #lines == 0 then return 0 end

    -- a line left unterminated by an interrupted write must not swallow the first new one
    local lead = (target_raw == "" or target_raw:sub(-1) == "\n") and "" or "\n"
    local ok, err = utils.append_file(target, lead .. table.concat(lines, "\n") .. "\n")
    if not ok then return nil, "Could not write " .. target .. ": " .. tostring(err) end
    return #lines
end

--- Switches the data folder; an empty path restores the default. Sessions from
--- the current folder are merged into the new one if it is reachable.
--- Returns { ok, error?, copied?, source_unreachable?, info? }.
function M.set_data_dir(path)
    path = normalize((utils.trim(path or ""):gsub('^"(.*)"$', "%1"))) -- "Copy as path" adds quotes
    local use_default = path == ""
    local target_dir = use_default and local_dir or path

    if not use_default then
        -- drive, UNC or POSIX root; a relative path would depend on Steam's working directory
        if not (path:match("^%a:[\\/]") or path:match("^[\\/]")) then
            return { ok = false, error = "Enter a full path, e.g. Z:\\Playtime or \\\\server\\share\\Playtime" }
        end
        fs.create_directories(target_dir)
        if not fs.is_directory(target_dir) then
            return { ok = false, error = "Could not create or open " .. target_dir }
        end
        local probe = fs.join(target_dir, ".playtimechart-write-test")
        local wrote = utils.write_file(probe, "ok")
        fs.remove(probe)
        if not wrote then
            return { ok = false, error = "Cannot write to " .. target_dir }
        end
    end

    local source_reachable = data_available()
    local copied, err = 0, nil
    if source_reachable then
        copied, err = copy_sessions_to(fs.join(target_dir, "sessions.jsonl"))
        if not copied then return { ok = false, error = err } end
    end

    local saved, save_err = utils.write_file(settings_path, cjson.encode(use_default and {} or { data_dir = path }))
    if not saved then
        return { ok = false, error = "Could not save settings: " .. tostring(save_err) }
    end

    use_data_dir(not use_default and path or nil)
    flush_pending()
    logger:info("Data folder set to " .. data_dir .. ", copied " .. copied .. " session(s)")
    return { ok = true, copied = copied, source_unreachable = not source_reachable, info = M.info() }
end

return M
