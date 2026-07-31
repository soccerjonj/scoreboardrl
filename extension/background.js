const SUPABASE_URL = "https://zpdxcizzaklqvmwpvocs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZHhjaXp6YWtscXZtd3B2b2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NjMyNDMsImV4cCI6MjA5MTUzOTI0M30.BV9-nnHhN3NOckOxwdEdtMAOsyFiywan1DCEXn7-_ig";
const RL_WS_URL = "ws://localhost:49123";
const DASHBOARD_URL = "https://scoreboardrl.vercel.app/dashboard";

let ws = null;
let lastUpdateState = null;
let reconnectTimer = null;
let isConnected = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function notifyPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {}); // popup may not be open
}

async function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function normalizeName(name) {
  return (name || "").toLowerCase().trim();
}

function deriveGameMode(players) {
  const teamCounts = {};
  for (const p of players) {
    teamCounts[p.TeamNum] = (teamCounts[p.TeamNum] || 0) + 1;
  }
  const max = Math.max(...Object.values(teamCounts));
  if (max === 1) return "1v1";
  if (max === 2) return "2v2";
  if (max === 3) return "3v3";
  return "4v4";
}

// ── Supabase REST calls ───────────────────────────────────────────────────────

async function supabasePost(path, body, jwt) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${jwt}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error (${res.status}): ${err}`);
  }
  return res.json();
}

async function checkProTier(jwt, userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=tier`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${jwt}`,
      },
    }
  );
  if (!res.ok) return false;
  const data = await res.json();
  const tier = data?.[0]?.tier;
  return tier === "pro" || tier === "lifetime";
}

// ── Game logging ─────────────────────────────────────────────────────────────

async function logGame(winnerTeamNum) {
  const { jwt, userId, rlName, defaultGameType } = await getStorage([
    "jwt", "userId", "rlName", "defaultGameType",
  ]);

  if (!jwt || !userId || !rlName) {
    console.warn("[ScoreboardRL] Not signed in — skipping auto-log");
    return;
  }

  // Check Pro tier before logging
  const isPro = await checkProTier(jwt, userId);
  if (!isPro) {
    console.warn("[ScoreboardRL] Free tier — PC Companion requires Pro");
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "ScoreboardRL",
      message: "PC auto-logging requires a Pro subscription.",
    });
    return;
  }

  const players = lastUpdateState?.Players ?? [];
  if (!players.length) {
    console.warn("[ScoreboardRL] No player data available");
    return;
  }

  // Find the logged-in user's player entry
  const userPlayer = players.find(
    (p) => normalizeName(p.Name) === normalizeName(rlName)
  );

  const result = userPlayer
    ? winnerTeamNum === userPlayer.TeamNum ? "win" : "loss"
    : "loss"; // fallback if user not found in player list

  const gameMode = deriveGameMode(players);
  const gameType = defaultGameType || "competitive";

  try {
    // Insert game row
    const [game] = await supabasePost("games", {
      created_by: userId,
      game_mode: gameMode,
      game_type: gameType,
      result,
      logged_via_photo: false,
      division_change: null,
    }, jwt);

    const gameId = game.id;

    // Insert game_players rows
    const playerRows = players.map((p) => ({
      game_id: gameId,
      player_name: p.Name,
      team: p.TeamNum === 0 ? "blue" : "orange",
      score: p.Score ?? 0,
      goals: p.Goals ?? 0,
      assists: p.Assists ?? 0,
      saves: p.Saves ?? 0,
      shots: p.Shots ?? 0,
      is_mvp: false,
      submission_status: "approved",
      submitted_by: userId,
      user_id: normalizeName(p.Name) === normalizeName(rlName) ? userId : null,
    }));

    await supabasePost("game_players", playerRows, jwt);

    // Show notification
    const userStats = userPlayer
      ? `Score: ${userPlayer.Score} · G: ${userPlayer.Goals} · A: ${userPlayer.Assists} · S: ${userPlayer.Saves}`
      : "Game logged";

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: `ScoreboardRL · ${result === "win" ? "✅ Win" : "❌ Loss"}`,
      message: userStats + "\nClick to view on ScoreboardRL",
    });

    notifyPopup({ type: "GAME_LOGGED", result, gameId });
    console.log(`[ScoreboardRL] Game logged: ${gameId}`);
  } catch (err) {
    console.error("[ScoreboardRL] Failed to log game:", err);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "ScoreboardRL",
      message: "Failed to log game. Check your connection.",
    });
  }
}

// ── Notification click → open dashboard ──────────────────────────────────────

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// ── WebSocket connection ──────────────────────────────────────────────────────

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(RL_WS_URL);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    isConnected = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    notifyPopup({ type: "STATUS", connected: true });
    console.log("[ScoreboardRL] Connected to RL Stats API");
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.Event === "UpdateState") {
      lastUpdateState = msg.Data;
    } else if (msg.Event === "MatchEnded") {
      const winnerTeamNum = msg.Data?.WinnerTeamNum ?? 0;
      logGame(winnerTeamNum);
    }
  };

  ws.onclose = () => {
    isConnected = false;
    notifyPopup({ type: "STATUS", connected: false });
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 5000);
}

// ── Message handler (from popup) ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    sendResponse({ connected: isConnected });
  } else if (msg.type === "RECONNECT") {
    connect();
    sendResponse({ ok: true });
  }
  return true;
});

// ── Boot ─────────────────────────────────────────────────────────────────────

connect();
