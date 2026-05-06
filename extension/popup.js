const SUPABASE_URL = "https://hnzrshgdhtukxgmlcjpw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuenJzaGdkaHR1a3hnbWxjanB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjY5OTgsImV4cCI6MjA5MTQ0Mjk5OH0.nqgjJcXIZXi98hQQcdFkslaDtd_qLOulaf7TQuuVBuk";

// ── Elements ──────────────────────────────────────────────────────────────────
const viewAuth    = document.getElementById("view-auth");
const viewMain    = document.getElementById("view-main");
const statusDot   = document.getElementById("statusDot");
const connLabel   = document.getElementById("connLabel");
const rlNameDisp  = document.getElementById("rlNameDisplay");
const authError   = document.getElementById("authError");
const emailInput  = document.getElementById("email");
const passInput   = document.getElementById("password");
const signInBtn   = document.getElementById("signInBtn");
const signOutBtn  = document.getElementById("signOutBtn");
const typeToggle  = document.getElementById("gameTypeToggle");
const typeLabel   = document.getElementById("typeLabel");

// ── Helpers ───────────────────────────────────────────────────────────────────
function showView(loggedIn) {
  viewAuth.style.display = loggedIn ? "none"  : "block";
  viewMain.style.display = loggedIn ? "block" : "none";
}

function setStatus(connected) {
  statusDot.className = `status-dot ${connected ? "connected" : "disconnected"}`;
  connLabel.className = `status-label ${connected ? "ok" : "bad"}`;
  connLabel.textContent = connected ? "Connected" : "Disconnected";
}

function showError(msg) {
  authError.textContent = msg;
  authError.style.display = "block";
}

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.storage.local.get(["jwt", "rlName", "defaultGameType"], (data) => {
  if (data.jwt && data.rlName) {
    showView(true);
    rlNameDisp.textContent = data.rlName;
    typeToggle.checked = (data.defaultGameType === "casual");
    typeLabel.textContent = typeToggle.checked ? "Casual" : "Competitive";
  } else {
    showView(false);
  }

  // Ask background for current connection status
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (resp) => {
    if (resp) setStatus(resp.connected);
  });
});

// ── Game type toggle ──────────────────────────────────────────────────────────
typeToggle.addEventListener("change", () => {
  const val = typeToggle.checked ? "casual" : "competitive";
  typeLabel.textContent = typeToggle.checked ? "Casual" : "Competitive";
  chrome.storage.local.set({ defaultGameType: val });
});

// ── Sign in ───────────────────────────────────────────────────────────────────
signInBtn.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passInput.value;
  if (!email || !password) { showError("Enter email and password."); return; }

  authError.style.display = "none";
  signInBtn.disabled = true;
  signInBtn.textContent = "Signing in…";

  try {
    // Authenticate with Supabase
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(authData.error_description || authData.msg || "Sign in failed");

    const jwt    = authData.access_token;
    const userId = authData.user?.id;

    // Fetch RL account name from profiles
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=rl_account_name,username`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${jwt}`,
        },
      }
    );
    const profiles = await profileRes.json();
    const profile  = profiles?.[0];
    const rlName   = profile?.rl_account_name || profile?.username || email;

    // Store credentials
    chrome.storage.local.set({ jwt, userId, rlName, defaultGameType: "competitive" });

    showView(true);
    rlNameDisp.textContent = rlName;

    // Kick background to reconnect with new credentials
    chrome.runtime.sendMessage({ type: "RECONNECT" });
  } catch (err) {
    showError(err.message);
  } finally {
    signInBtn.disabled = false;
    signInBtn.textContent = "Sign In";
  }
});

// ── Sign out ──────────────────────────────────────────────────────────────────
signOutBtn.addEventListener("click", () => {
  chrome.storage.local.remove(["jwt", "userId", "rlName"], () => {
    showView(false);
    emailInput.value = "";
    passInput.value  = "";
    setStatus(false);
  });
});

// ── Live status updates from background ──────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATUS") setStatus(msg.connected);
});
