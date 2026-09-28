// ===== SAMP COMMUNITY HUB v2 - Firebase Real-time =====

let auth, db;
let currentUser = null;
let unsubscribeChat = null;
let unsubscribeOnline = null;
let unsubscribeMods = null;

// ----- Helpers -----
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(msg, isError = false) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function getAvatarUrl(seed) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "default")}`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function formatTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ----- Firebase Init -----
function initFirebase() {
  if (!CONFIG.firebase.apiKey || CONFIG.firebase.apiKey.includes("ISI_")) {
    showToast("Firebase belum dikonfigurasi! Edit file config.js", true);
    console.error("Isi CONFIG.firebase di config.js dulu!");
    return false;
  }

  firebase.initializeApp(CONFIG.firebase);
  auth = firebase.auth();
  db = firebase.firestore();

  // Update Discord links
  const invite = CONFIG.discordInvite || "https://discord.gg/";
  const discordLink = $("#discord-invite");
  if (discordLink) discordLink.href = invite;
  $$(".voice-room a.btn-join").forEach(a => a.href = invite);

  return true;
}

// ----- Auth -----
function initAuth() {
  $$(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".auth-tab").forEach(t => t.classList.remove("active"));
      $$(".auth-form").forEach(f => f.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.tab}-form`).classList.add("active");
    });
  });

  // Helper: ubah username jadi email internal Firebase
  function usernameToEmail(username) {
    return username.toLowerCase().replace(/[^a-z0-9]/g, "") + "@samp.community";
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#login-username").value.trim();
    const password = $("#login-password").value;

    if (!username) {
      showToast("Username wajib diisi", true);
      return;
    }

    const email = usernameToEmail(username);
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      showToast("Username atau password salah", true);
    }
  });

  $("#register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#reg-username").value.trim();
    const password = $("#reg-password").value;
    const confirm = $("#reg-confirm").value;

    if (username.length < 3) {
      showToast("Username minimal 3 karakter", true);
      return;
    }
    if (password.length < 6) {
      showToast("Password minimal 6 karakter", true);
      return;
    }
    if (password !== confirm) {
      showToast("Password tidak cocok", true);
      return;
    }

    // Cek apakah username sudah dipakai
    const existing = await db.collection("users").where("username", "==", username).get();
    if (!existing.empty) {
      showToast("Username sudah dipakai, pilih yang lain", true);
      return;
    }

    const email = usernameToEmail(username);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const profile = {
        uid: cred.user.uid,
        username,
        email,
        bio: "",
        avatarSeed: username,
        faction: "",
        joined: new Date().toISOString().slice(0, 10),
        modsShared: 0,
        lastOnline: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("users").doc(cred.user.uid).set(profile);
      showToast("Akun berhasil dibuat!");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        showToast("Username sudah dipakai", true);
      } else {
        showToast(err.message || "Register gagal", true);
      }
    }
  });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) {
        currentUser = { ...doc.data(), uid: user.uid };
      } else {
        // Fallback (seharusnya jarang terjadi)
        currentUser = {
          uid: user.uid,
          username: user.email.split("@")[0],
          email: user.email,
          bio: "",
          avatarSeed: user.email.split("@")[0],
          joined: new Date().toISOString().slice(0, 10),
          modsShared: 0
        };
        await db.collection("users").doc(user.uid).set(currentUser);
      }
      enterApp();
      setOnlineStatus(true);
    } else {
      currentUser = null;
      $("#app").classList.add("hidden");
      $("#auth-overlay").classList.remove("hidden");
      if (unsubscribeChat) unsubscribeChat();
      if (unsubscribeOnline) unsubscribeOnline();
      if (unsubscribeMods) unsubscribeMods();
    }
  });
}

function enterApp() {
  $("#auth-overlay").classList.add("hidden");
  $("#app").classList.remove("hidden");
  updateNavUser();
  loadProfileForm();
  listenMods();
  listenChat();
  listenOnline();
  updateStats();
}

async function setOnlineStatus(online) {
  if (!currentUser) return;
  try {
    await db.collection("users").doc(currentUser.uid).update({
      lastOnline: firebase.firestore.FieldValue.serverTimestamp(),
      online: online
    });
  } catch (e) {}
}

function logout() {
  setOnlineStatus(false);
  auth.signOut();
}

// ----- Navigation -----
function initNav() {
  $$(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => goToPage(btn.dataset.page));
  });
  $$(".feature-card").forEach(card => {
    card.addEventListener("click", () => goToPage(card.dataset.goto));
  });
  $("#logout-btn").addEventListener("click", logout);
}

function goToPage(page) {
  $$(".nav-btn").forEach(b => b.classList.remove("active"));
  $$(".page").forEach(p => p.classList.remove("active"));
  const navBtn = $(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add("active");
  const pageEl = $(`#page-${page}`);
  if (pageEl) pageEl.classList.add("active");
}

function updateNavUser() {
  if (!currentUser) return;
  $("#nav-username").textContent = currentUser.username;
  $("#nav-avatar").src = getAvatarUrl(currentUser.avatarSeed);
}

// ----- Mods (Realtime) -----
function listenMods() {
  if (unsubscribeMods) unsubscribeMods();
  unsubscribeMods = db.collection("mods")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      const mods = [];
      snap.forEach(doc => mods.push({ id: doc.id, ...doc.data() }));
      renderMods(mods);
      $("#stat-mods").textContent = mods.length;
    }, err => console.error(err));
}

function renderMods(mods, filter = "") {
  const list = $("#mod-list");
  const filtered = mods.filter(m =>
    !filter ||
    m.name.toLowerCase().includes(filter.toLowerCase()) ||
    (m.desc || "").toLowerCase().includes(filter.toLowerCase()) ||
    (m.category || "").toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim);grid-column:1/-1;text-align:center;padding:40px;">Belum ada modpack. Jadilah yang pertama share!</p>`;
    return;
  }

  list.innerHTML = filtered.map(m => `
    <div class="mod-card">
      <div class="mod-card-header">
        <h3>${escapeHtml(m.name)}</h3>
        <span class="mod-category">${escapeHtml(m.category || "Other")}</span>
      </div>
      <p>${escapeHtml(m.desc)}</p>
      <div class="mod-card-footer">
        <span class="mod-author"><i class="fas fa-user"></i> ${escapeHtml(m.author)}</span>
        <a href="${escapeHtml(m.link)}" target="_blank" rel="noopener" class="btn-download">
          <i class="fas fa-download"></i> Download
        </a>
      </div>
    </div>
  `).join("");
}

function initMods() {
  $("#btn-add-mod").addEventListener("click", () => $("#mod-modal").classList.remove("hidden"));
  $$(".modal-close").forEach(btn => btn.addEventListener("click", () => $("#mod-modal").classList.add("hidden")));
  $("#mod-modal").addEventListener("click", e => {
    if (e.target === $("#mod-modal")) $("#mod-modal").classList.add("hidden");
  });

  $("#mod-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await db.collection("mods").add({
        name: $("#mod-name").value.trim(),
        desc: $("#mod-desc").value.trim(),
        link: $("#mod-link").value.trim(),
        category: $("#mod-category").value,
        author: currentUser.username,
        authorUid: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("users").doc(currentUser.uid).update({
        modsShared: firebase.firestore.FieldValue.increment(1)
      });
      currentUser.modsShared = (currentUser.modsShared || 0) + 1;
      $("#profile-mods").textContent = currentUser.modsShared;
      $("#mod-form").reset();
      $("#mod-modal").classList.add("hidden");
      showToast("Modpack berhasil di-share!");
    } catch (err) {
      showToast("Gagal share modpack", true);
    }
  });

  $("#mod-search").addEventListener("input", (e) => {
    // Re-render from current snapshot is complex; simple filter on last known
    // For simplicity we just trigger a re-listen or keep last mods in memory
  });
}

// ----- Chat (Realtime) -----
function listenChat() {
  if (unsubscribeChat) unsubscribeChat();
  unsubscribeChat = db.collection("chat")
    .orderBy("createdAt", "asc")
    .limitToLast(100)
    .onSnapshot(snap => {
      const messages = [];
      snap.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
      renderChat(messages);
    });
}

function renderChat(messages) {
  const container = $("#chat-messages");
  container.innerHTML = messages.map(m => {
    const isSelf = m.uid === currentUser?.uid;
    return `
      <div class="chat-msg ${isSelf ? "self" : "other"}">
        <div class="msg-author">${escapeHtml(m.author)}</div>
        <div>${escapeHtml(m.text)}</div>
        <div class="msg-time">${formatTime(m.createdAt)}</div>
      </div>
    `;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

function initChat() {
  $("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chat-input");
    const text = input.value.trim();
    if (!text || !currentUser) return;

    try {
      await db.collection("chat").add({
        text,
        author: currentUser.username,
        uid: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      input.value = "";
    } catch (err) {
      showToast("Gagal kirim pesan", true);
    }
  });
}

// ----- Online Users -----
function listenOnline() {
  if (unsubscribeOnline) unsubscribeOnline();
  // Consider online if lastOnline within last 5 minutes
  unsubscribeOnline = db.collection("users")
    .onSnapshot(snap => {
      const now = Date.now();
      const online = [];
      snap.forEach(doc => {
        const u = doc.data();
        if (u.lastOnline) {
          const last = u.lastOnline.toDate ? u.lastOnline.toDate().getTime() : 0;
          if (now - last < 5 * 60 * 1000) {
            online.push({ ...u, uid: doc.id });
          }
        }
      });
      renderOnline(online);
      $("#stat-online").textContent = online.length;
      $("#chat-online").textContent = online.length;
    });
}

function renderOnline(users) {
  const list = $("#online-list");
  list.innerHTML = users.map(u => `
    <li>
      <img src="${getAvatarUrl(u.avatarSeed)}" alt="">
      <span>${escapeHtml(u.username)}</span>
      <span class="status"></span>
    </li>
  `).join("");
}

// ----- Profile -----
function loadProfileForm() {
  if (!currentUser) return;
  $("#edit-username").value = currentUser.username || "";
  $("#edit-bio").value = currentUser.bio || "";
  $("#edit-avatar").value = currentUser.avatarSeed || "";
  $("#edit-faction").value = currentUser.faction || "";
  $("#profile-name").textContent = currentUser.username;
  $("#profile-bio").textContent = currentUser.bio || "Belum ada bio";
  $("#profile-avatar").src = getAvatarUrl(currentUser.avatarSeed);
  $("#profile-joined").textContent = currentUser.joined || "-";
  $("#profile-mods").textContent = currentUser.modsShared || 0;
}

function initProfile() {
  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const updates = {
      username: $("#edit-username").value.trim(),
      bio: $("#edit-bio").value.trim(),
      avatarSeed: $("#edit-avatar").value.trim() || currentUser.username,
      faction: $("#edit-faction").value.trim()
    };
    try {
      await db.collection("users").doc(currentUser.uid).update(updates);
      currentUser = { ...currentUser, ...updates };
      updateNavUser();
      loadProfileForm();
      showToast("Profil berhasil disimpan!");
    } catch (err) {
      showToast("Gagal simpan profil", true);
    }
  });

  $("#edit-avatar").addEventListener("input", (e) => {
    $("#profile-avatar").src = getAvatarUrl(e.target.value || currentUser.username);
  });
}

// ----- Stats -----
async function updateStats() {
  try {
    const usersSnap = await db.collection("users").get();
    $("#stat-members").textContent = usersSnap.size;
  } catch (e) {}
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => $("#loading-screen").classList.add("hidden"), 1000);

  if (!initFirebase()) return;

  initAuth();
  initNav();
  initMods();
  initChat();
  initProfile();

  // Keep online status fresh
  setInterval(() => {
    if (currentUser) setOnlineStatus(true);
  }, 60000);

  window.addEventListener("beforeunload", () => {
    if (currentUser) setOnlineStatus(false);
  });
});
