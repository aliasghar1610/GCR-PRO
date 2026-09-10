// Side panel logic. Runs as an extension page, so it can fetch the backend
// directly (host_permissions covers localhost:3000) — no keys live here,
// only the bearer token handed over by the web app at connect time.

const API_BASE = "http://localhost:3000";
const MAX_DEADLINES = 8;
const TAG_COUNT = 8;

const els = {
  disconnected: document.getElementById("disconnected"),
  connected: document.getElementById("connected"),
  connectBtn: document.getElementById("connect-btn"),
  search: document.getElementById("search-input"),
  searchResults: document.getElementById("search-results"),
  deadlines: document.getElementById("deadlines"),
  courseHeading: document.getElementById("course-heading"),
  professors: document.getElementById("professors"),
  syncDot: document.getElementById("sync-dot"),
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// Mirrors lib/courseColor.ts's djb2 hash so a course keeps the same tag
// color here as it has in the web app.
function courseColorIndex(courseId) {
  let hash = 5381;
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 33) ^ courseId.charCodeAt(i);
  }
  return (hash >>> 0) % TAG_COUNT;
}

function courseInitials(name) {
  const words = (name || "").trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function badgeHtml(courseId, courseName) {
  const n = courseColorIndex(courseId || courseName || "") + 1;
  return `<span class="badge" style="background:var(--tag-${n}-soft);color:var(--tag-${n}-solid)">${escapeHtml(
    courseInitials(courseName)
  )}</span>`;
}

async function apiFetch(path) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return { ok: false, status: 401, data: null };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function applyTheme(theme) {
  const dark =
    theme === "dark" ||
    (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function setSyncState(state) {
  els.syncDot.classList.toggle("failed", state === "failed");
  els.syncDot.title = state === "failed" ? "Couldn't load — click dashboard to retry" : "Synced";
}

function daysLeftPill(daysLeft) {
  if (daysLeft < 0) return `<span class="pill pill-overdue">Overdue</span>`;
  if (daysLeft <= 2) return `<span class="pill pill-soon">Due Soon</span>`;
  return `<span class="pill pill-upcoming">${daysLeft}d</span>`;
}

async function loadDeadlines() {
  els.deadlines.innerHTML = `<div class="muted-note">Loading…</div>`;
  const res = await apiFetch("/api/extension/summary");
  if (!res.ok) {
    els.deadlines.innerHTML = `<div class="muted-note">Couldn&rsquo;t load deadlines.</div>`;
    setSyncState("failed");
    return;
  }
  setSyncState("idle");
  const items = (res.data?.deadlines ?? []).slice(0, MAX_DEADLINES);
  if (items.length === 0) {
    els.deadlines.innerHTML = `<div class="muted-note">Nothing due soon.</div>`;
    return;
  }
  els.deadlines.innerHTML = `<div class="card">${items
    .map(
      (d) => `
      <a class="row" href="${escapeHtml(d.alternateLink ?? "#")}" target="_blank" rel="noopener">
        ${badgeHtml(d.courseId, d.courseName)}
        <span class="row-body">
          <span class="row-title">${escapeHtml(d.title)}</span>
          <span class="row-sub">${escapeHtml(d.courseName)}</span>
        </span>
        ${daysLeftPill(d.daysLeft)}
      </a>`
    )
    .join("")}</div>`;
}

async function loadProfessors() {
  const { currentCourseId } = await chrome.storage.local.get("currentCourseId");
  if (!currentCourseId) {
    els.courseHeading.textContent = "This Course";
    els.professors.innerHTML = `<div class="muted-note">Open a course on Classroom to see its instructors.</div>`;
    return;
  }
  els.professors.innerHTML = `<div class="muted-note">Loading…</div>`;
  const res = await apiFetch(`/api/extension/professors?courseId=${encodeURIComponent(currentCourseId)}`);
  if (!res.ok) {
    els.professors.innerHTML = `<div class="muted-note">Couldn&rsquo;t load instructors.</div>`;
    return;
  }
  els.courseHeading.textContent = res.data?.courseName ?? "This Course";
  const teachers = res.data?.teachers ?? [];
  if (teachers.length === 0) {
    els.professors.innerHTML = `<div class="muted-note">No instructor info synced for this course yet.</div>`;
    return;
  }
  els.professors.innerHTML = `<div class="card">${teachers
    .map(
      (t) => `
      <div class="row">
        <span class="row-body">
          <span class="row-title">${escapeHtml(t.name)}</span>
          <span class="row-sub">${t.email ? escapeHtml(t.email) : "Email not shared"}</span>
        </span>
        ${
          t.email
            ? `<button class="copy-btn" data-email="${escapeHtml(t.email)}" title="Copy email">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
              </button>`
            : ""
        }
      </div>`
    )
    .join("")}</div>`;

  els.professors.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.email);
      btn.style.color = "var(--success)";
      setTimeout(() => (btn.style.color = ""), 1000);
    });
  });
}

let searchDebounce;
els.search.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = els.search.value.trim();
  if (!q) {
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
    return;
  }
  els.searchResults.hidden = false;
  searchDebounce = setTimeout(async () => {
    els.searchResults.innerHTML = `<div class="muted-note">Searching…</div>`;
    const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      els.searchResults.innerHTML = `<div class="muted-note">Search failed.</div>`;
      return;
    }
    const { courses = [], assignments = [], announcements = [] } = res.data ?? {};
    if (courses.length + assignments.length + announcements.length === 0) {
      els.searchResults.innerHTML = `<div class="muted-note">No results.</div>`;
      return;
    }
    els.searchResults.innerHTML = [
      ...courses.map(
        (c) => `<div class="row">${badgeHtml(c.id, c.name)}<span class="row-body"><span class="row-title">${escapeHtml(
          c.name
        )}</span><span class="row-sub">Course</span></span></div>`
      ),
      ...assignments.map(
        (a) => `<div class="row">${badgeHtml(a.courseId, a.courseName)}<span class="row-body"><span class="row-title">${escapeHtml(
          a.title
        )}</span><span class="row-sub">${escapeHtml(a.courseName)}</span></span></div>`
      ),
      ...announcements.map(
        (a) => `<div class="row">${badgeHtml(a.courseId, a.courseName)}<span class="row-body"><span class="row-title">${escapeHtml(
          (a.text ?? "").slice(0, 60)
        )}</span><span class="row-sub">${escapeHtml(a.courseName)}</span></span></div>`
      ),
    ].join("");
  }, 300);
});

els.connectBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/extension-connect` });
});

async function init() {
  const { token, theme } = await chrome.storage.local.get(["token", "theme"]);
  applyTheme(theme ?? "system");

  if (!token) {
    els.disconnected.hidden = false;
    els.connected.hidden = true;
    return;
  }

  els.disconnected.hidden = true;
  els.connected.hidden = false;
  loadDeadlines();
  loadProfessors();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.token || changes.theme)) init();
});

init();
