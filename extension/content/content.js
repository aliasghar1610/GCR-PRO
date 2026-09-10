// Injected into classroom.google.com. Kept deliberately minimal: it never
// reads assignment content out of the page (that data comes from our backend,
// which got it from the official Classroom API) and every DOM interaction is
// wrapped so a layout change on Google's side degrades to "nothing happens"
// rather than a thrown error.

const COURSE_ID_RE = /\/c\/([^/]+)/;
const ASSIGNMENT_ID_RE = /\/c\/[^/]+\/a\/([^/]+)/;

let lastHref = "";

function currentIds() {
  const course = location.pathname.match(COURSE_ID_RE)?.[1] ?? null;
  const assignment = location.pathname.match(ASSIGNMENT_ID_RE)?.[1] ?? null;
  return { course, assignment };
}

function syncCourseContext() {
  if (location.href === lastHref) return;
  lastHref = location.href;

  const { course, assignment } = currentIds();
  try {
    chrome.storage.local.set({ currentCourseId: course });
  } catch {
    // Extension context can go away on reload/update — nothing to do.
    return;
  }

  updateDueBadge(assignment);
}

function injectFloatingButton() {
  if (document.getElementById("gcr-pro-fab")) return;

  const button = document.createElement("button");
  button.id = "gcr-pro-fab";
  button.type = "button";
  button.textContent = "GCR PRO";
  button.addEventListener("click", () => {
    try {
      chrome.runtime.sendMessage({ type: "OPEN_PANEL" });
    } catch {
      // ignore — background worker may be restarting
    }
  });

  document.body?.appendChild(button);
}

// Rather than inject into Classroom's own (unstable, class-name-churning)
// DOM, the due-soon badge is our own small overlay — it never depends on
// Google's markup, so there's nothing there to break.
function updateDueBadge(assignmentId) {
  const existing = document.getElementById("gcr-pro-badge");
  if (!assignmentId) {
    existing?.remove();
    return;
  }

  chrome.runtime.sendMessage({ type: "API_FETCH", path: "/api/extension/summary" }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) return;
    const match = res.data?.deadlines?.find((d) => d.id === assignmentId);
    document.getElementById("gcr-pro-badge")?.remove();
    if (!match || match.daysLeft > 2 || match.daysLeft < 0) return;

    const badge = document.createElement("div");
    badge.id = "gcr-pro-badge";
    badge.textContent =
      match.daysLeft === 0 ? "Due today" : `Due in ${match.daysLeft}d`;
    document.body?.appendChild(badge);
  });
}

function init() {
  injectFloatingButton();
  syncCourseContext();
}

init();
// Classroom is a single-page app — poll the URL rather than trying to hook
// its router, which isn't a public API.
setInterval(syncCourseContext, 1500);
