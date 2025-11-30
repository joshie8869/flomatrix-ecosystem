// =============================================================
// FloMatrix — AI Builder Control Panel
// Full JS for the HTML dashboard
// Backend runs as:
//   python -m uvicorn aibuilder.main:app --host 0.0.0.0 --port 9000 --reload
//
// Backend Swagger (http://localhost:9000/docs) shows:
//
//   GET  /api/ai-builder/jobs                 -> list jobs
//   POST /api/ai-builder/jobs                 -> create job
//   GET  /api/ai-builder/jobs/{job_id}        -> get job (status+meta)
//   POST /api/ai-builder/jobs/{job_id}/run    -> run job
//   POST /api/ai-builder/jobs/{job_id}/approve-> approve job
//
// Logs/diff endpoints don’t exist yet; UI will handle 404s gracefully.
// =============================================================

// ----------- Backend URLs (SAME ORIGIN) ----------------------

// IMPORTANT: we no longer hard-code localhost. Whatever host/port
// the UI is served from (http://localhost:9000/ui/), we use that
// as the API origin. This avoids CORS headaches entirely.
const ORIGIN = window.location.origin;
const API_BASE = `${ORIGIN}/api/ai-builder`;
const DOCS_URL = `${ORIGIN}/docs`;

const API_ROUTES = {
  listJobs: () => `${API_BASE}/jobs`,
  jobStatus: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}`,
  approve: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}/approve`,
  run: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}/run`,
  logs: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}/logs`,   // optional
  diff: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}/diff`,   // optional
  health: () => DOCS_URL,
};

// ----------- DOM helpers ------------------------------------------------
function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  return String(value);
}

// ----------- State ------------------------------------------------------
const state = {
  jobs: [],
  selectedJobId: null,
  backendOnline: false,
  autoRefresh: true,
  autoIntervalMs: 15000,
  autoTimer: null,
  lastError: null,
};

// ----------- Elements (expected IDs in index.html) ----------------------
// Top bar
const elBackendStatus = $("#backend-status-pill");
const elBackendDot = $("#backend-status-dot"); // optional, may not exist
const elRefreshAll = $("#btn-refresh-all");
const elAutoToggle = $("#auto-toggle");
const elAutoLabel = $("#auto-label");
const elAutoSelect = $("#auto-interval-select");
const elDesignModeBtn = $("#btn-design-mode");

// Job queue pane
const elJobsList = $("#jobs-list");
const elJobsFilter = $("#job-filter-input");
const elJobsReload = $("#btn-reload-jobs");
const elJobsEmptyMsg = $("#jobs-empty-msg");

// Job details pane
const elJobTitle = $("#job-title");
const elJobMeta = $("#job-meta");
const elJobStatusBadge = $("#job-status-badge");
const elJobTimeline = $("#job-timeline");

const elApproveBtn = $("#btn-approve-patch");
const elRunBtn = $("#btn-run-job");
const elReloadSelectedBtn = $("#btn-reload-selected");

const elLoadIdInput = $("#job-load-id-input");
const elLoadIdBtn = $("#btn-load-job-id");

// Logs / diff / AI tools
const elLogsTabBtn = $("#tab-logs");
const elDiffTabBtn = $("#tab-diff");
const elAITabBtn = $("#tab-ai-tools");
const elLogsPanel = $("#logs-panel");
const elDiffPanel = $("#diff-panel");
const elAIToolsPanel = $("#ai-tools-panel");
const elLogsText = $("#logs-text");
const elDiffText = $("#diff-text");

// AI tools panel elements
const elBacktesterBtn = $("#btn-open-backtester");
const elIdeaList = $("#ai-ideas-list");

// Footer status
const elFooterStatus = $("#footer-status");
const elFooterAutoStatus = $("#footer-auto-status");

// ----------- Backend communication --------------------------------------

async function checkBackend() {
  try {
    const res = await fetch(API_ROUTES.health(), { method: "GET" });
    state.backendOnline = res.ok;
    updateBackendStatusUI();
  } catch (err) {
    state.backendOnline = false;
    state.lastError = err;
    updateBackendStatusUI();
  }
}

async function fetchJobs() {
  // Ensure we have a fresh backend check
  if (!state.backendOnline) {
    await checkBackend();
    if (!state.backendOnline) {
      renderJobs(true);
      return;
    }
  }

  try {
    const res = await fetch(API_ROUTES.listJobs());
    if (!res.ok) {
      throw new Error(`Jobs list returned HTTP ${res.status}`);
    }
    const data = await res.json();
    let jobs = Array.isArray(data) ? data : data.jobs || [];
    if (!Array.isArray(jobs)) jobs = [];

    state.jobs = jobs;
    renderJobs();
  } catch (err) {
    console.error("Failed to fetch jobs:", err);
    state.lastError = err;
    renderJobs(true);
  }
}

async function fetchJobDetails(jobId) {
  if (!jobId) return;
  try {
    const res = await fetch(API_ROUTES.jobStatus(jobId));
    if (!res.ok) {
      throw new Error(`Job status ${jobId} HTTP ${res.status}`);
    }
    const job = await res.json();
    state.selectedJobId = jobId;
    renderJobDetails(job);
    highlightSelectedJob(jobId);
    loadLogs(jobId);
    loadDiff(jobId);
  } catch (err) {
    console.error("Failed to load job:", err);
    state.lastError = err;
    renderJobDetails(null, true);
  }
}

async function approveJob(jobId) {
  if (!jobId) return;
  try {
    setFooterStatus(`Approving job ${jobId}…`);
    const res = await fetch(API_ROUTES.approve(jobId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Approved via FloMatrix AI Builder UI",
      }),
    });
    if (!res.ok) {
      throw new Error(`Approve HTTP ${res.status}`);
    }
    setFooterStatus(`Job ${jobId} approved.`);
    await fetchJobs();
    await fetchJobDetails(jobId);
  } catch (err) {
    console.error("Approve failed:", err);
    state.lastError = err;
    setFooterStatus(`Failed to approve job ${jobId}. Check console logs.`);
  }
}

async function runJob(jobId) {
  if (!jobId) return;
  try {
    setFooterStatus(`Running job ${jobId}…`);
    const res = await fetch(API_ROUTES.run(jobId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual-ui" }),
    });
    if (!res.ok) {
      throw new Error(`Run HTTP ${res.status}`);
    }
    setFooterStatus(`Job ${jobId} run triggered.`);
    await fetchJobs();
    await fetchJobDetails(jobId);
  } catch (err) {
    console.error("Run failed:", err);
    state.lastError = err;
    setFooterStatus(`Failed to run job ${jobId}. Check console logs.`);
  }
}

async function loadLogs(jobId) {
  if (!elLogsText || !jobId) return;
  try {
    const res = await fetch(API_ROUTES.logs(jobId));
    if (!res.ok) {
      elLogsText.textContent =
        "Don't worry, Josh — we are not there yet! (Logs endpoint not implemented yet.)";
      return;
    }
    const text = await res.text();
    elLogsText.textContent = text || "No logs.";
  } catch {
    elLogsText.textContent = "Unable to load logs right now.";
  }
}

async function loadDiff(jobId) {
  if (!elDiffText || !jobId) return;
  try {
    const res = await fetch(API_ROUTES.diff(jobId));
    if (!res.ok) {
      elDiffText.textContent =
        "Don't worry, Josh — we are not there yet! (Patch diff endpoint not implemented yet.)";
      return;
    }
    const text = await res.text();
    elDiffText.textContent = text || "No diff.";
  } catch {
    elDiffText.textContent = "Unable to load diff right now.";
  }
}

// ----------- UI rendering -----------------------------------------------

function updateBackendStatusUI() {
  const online = state.backendOnline;

  if (elBackendStatus) {
    elBackendStatus.textContent = online ? "Backend: ONLINE" : "Backend: OFFLINE";
    elBackendStatus.classList.toggle("status-online", online);
    elBackendStatus.classList.toggle("status-offline", !online);
  }
  if (elBackendDot) {
    elBackendDot.classList.toggle("dot-online", online);
    elBackendDot.classList.toggle("dot-offline", !online);
  }
}

function renderJobs(error = false) {
  if (!elJobsList) return;

  elJobsList.innerHTML = "";

  if (error) {
    if (elJobsEmptyMsg) {
      elJobsEmptyMsg.textContent =
        "Unable to load jobs. Check that the AI Builder backend is running on localhost:9000 and that /api/ai-builder/jobs is reachable.";
      elJobsEmptyMsg.style.display = "block";
    }
    return;
  }

  const filter = (elJobsFilter?.value || "").toLowerCase().trim();

  let jobs = state.jobs || [];
  if (filter) {
    jobs = jobs.filter((job) => {
      const id = safeText(job.id || job.job_id || "").toLowerCase();
      const status = safeText(job.status || job.state || "").toLowerCase();
      const repo = safeText(job.repo || job.repository || "").toLowerCase();
      const path = safeText(job.path || job.target_path || "").toLowerCase();
      return (
        id.includes(filter) ||
        status.includes(filter) ||
        repo.includes(filter) ||
        path.includes(filter)
      );
    });
  }

  if (jobs.length === 0) {
    if (elJobsEmptyMsg) {
      elJobsEmptyMsg.textContent = state.backendOnline
        ? "No jobs yet. Use the AI Tools tab or your other agents to create an AI job."
        : "Unable to load jobs. Check that the AI Builder backend is running.";
      elJobsEmptyMsg.style.display = "block";
    }
    return;
  } else if (elJobsEmptyMsg) {
    elJobsEmptyMsg.style.display = "none";
  }

  jobs.forEach((job) => {
    const jobId = job.id || job.job_id || job.uuid || "(no id)";
    const status = job.status || job.state || "unknown";
    const repo = job.repo || job.repository || "";
    const path = job.path || job.target_path || "";

    const row = document.createElement("div");
    row.className = "job-row";
    row.dataset.jobId = jobId;

    row.innerHTML = `
      <div class="job-row-main">
        <div class="job-row-id">${safeText(jobId)}</div>
        <div class="job-row-status job-row-status-${safeText(status)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "")}">
          ${safeText(status)}
        </div>
      </div>
      <div class="job-row-sub">
        <span class="job-row-repo">${safeText(repo)}</span>
        <span class="job-row-path">${safeText(path)}</span>
      </div>
    `;

    row.addEventListener("click", () => {
      fetchJobDetails(jobId);
    });

    elJobsList.appendChild(row);
  });

  if (!state.selectedJobId && jobs.length > 0) {
    const firstId = jobs[0].id || jobs[0].job_id || jobs[0].uuid;
    if (firstId) {
      fetchJobDetails(firstId);
    }
  }

  highlightSelectedJob(state.selectedJobId);
}

function highlightSelectedJob(jobId) {
  if (!elJobsList) return;
  $all(".job-row").forEach((row) => {
    const isSelected = jobId && row.dataset.jobId === String(jobId);
    row.classList.toggle("job-row-selected", isSelected);
  });
}

function renderJobDetails(job, error = false) {
  if (!elJobTitle || !elJobMeta) return;

  if (error || !job) {
    elJobTitle.textContent = "No job selected";
    elJobMeta.textContent = "";
    if (elJobStatusBadge) elJobStatusBadge.textContent = "";
    if (elJobTimeline) elJobTimeline.innerHTML = "";
    return;
  }

  const jobId = job.id || job.job_id || job.uuid || "(no id)";
  const status = job.status || job.state || "unknown";
  const repo = job.repo || job.repository || "";
  const path = job.path || job.target_path || "";
  const createdAt =
    job.created_at || job.created || job.timestamp || job.createdAt || "";

  elJobTitle.textContent = `Job ${jobId}`;
  elJobMeta.textContent = [
    repo && `Repo: ${repo}`,
    path && `Path: ${path}`,
    createdAt && `Created: ${createdAt}`,
  ]
    .filter(Boolean)
    .join(" • ");

  if (elJobStatusBadge) {
    elJobStatusBadge.textContent = safeText(status);
    elJobStatusBadge.className = "fm-job-status-badge";
    elJobStatusBadge.classList.add(
      `job-status-${safeText(status).toLowerCase().replace(/[^a-z0-9_-]/g, "")}`
    );
  }

  if (elJobTimeline) {
    elJobTimeline.innerHTML = "";
    const steps = job.timeline || job.events || [];
    if (Array.isArray(steps) && steps.length > 0) {
      steps.forEach((step) => {
        const li = document.createElement("div");
        li.className = "timeline-item";
        const label = step.label || step.event || "Event";
        const ts = step.timestamp || step.time || "";
        const msg = step.message || step.detail || "";
        li.innerHTML = `
          <div class="timeline-header">
            <span class="timeline-label">${safeText(label)}</span>
            <span class="timeline-time">${safeText(ts)}</span>
          </div>
          <div class="timeline-body">${safeText(msg)}</div>
        `;
        elJobTimeline.appendChild(li);
      });
    }
  }
}

// ----------- Auto-refresh management ------------------------------------

function setupAutoRefresh() {
  if (!state.autoRefresh) {
    clearAutoTimer();
    updateAutoUI();
    return;
  }
  clearAutoTimer();
  state.autoTimer = setInterval(() => {
    fetchJobs();
  }, state.autoIntervalMs);
  updateAutoUI();
}

function clearAutoTimer() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }
}

function updateAutoUI() {
  if (elAutoToggle && elAutoLabel) {
    elAutoToggle.classList.toggle("auto-on", state.autoRefresh);
    elAutoToggle.classList.toggle("auto-off", !state.autoRefresh);
    elAutoLabel.textContent = state.autoRefresh
      ? `Auto: ON (${Math.round(state.autoIntervalMs / 1000)}s)`
      : "Auto: OFF";
  }
  if (elAutoSelect) {
    elAutoSelect.value = String(state.autoIntervalMs);
  }
  if (elFooterAutoStatus) {
    elFooterAutoStatus.textContent = state.autoRefresh ? "ON" : "OFF";
  }
}

// ----------- Footer status ----------------------------------------------

function setFooterStatus(text) {
  if (elFooterStatus) {
    elFooterStatus.textContent = text || "";
  }
}

// ----------- Event wiring -----------------------------------------------

function wireEvents() {
  if (elRefreshAll) {
    elRefreshAll.addEventListener("click", async () => {
      setFooterStatus("Refreshing backend status + jobs…");
      await checkBackend();
      await fetchJobs();
      setFooterStatus("");
    });
  }

  if (elJobsReload) {
    elJobsReload.addEventListener("click", async () => {
      setFooterStatus("Reloading jobs…");
      await fetchJobs();
      setFooterStatus("");
    });
  }

  if (elJobsFilter) {
    elJobsFilter.addEventListener("input", () => {
      renderJobs();
    });
  }

  if (elLoadIdBtn && elLoadIdInput) {
    elLoadIdBtn.addEventListener("click", () => {
      const id = elLoadIdInput.value.trim();
      if (!id) return;
      fetchJobDetails(id);
    });
  }

  if (elApproveBtn) {
    elApproveBtn.addEventListener("click", () => {
      if (!state.selectedJobId) return;
      approveJob(state.selectedJobId);
    });
  }

  if (elRunBtn) {
    elRunBtn.addEventListener("click", () => {
      if (!state.selectedJobId) return;
      runJob(state.selectedJobId);
    });
  }

  if (elReloadSelectedBtn) {
    elReloadSelectedBtn.addEventListener("click", () => {
      if (!state.selectedJobId) return;
      fetchJobDetails(state.selectedJobId);
    });
  }

  if (elAutoToggle) {
    elAutoToggle.addEventListener("click", () => {
      state.autoRefresh = !state.autoRefresh;
      setupAutoRefresh();
    });
  }

  if (elAutoSelect) {
    elAutoSelect.addEventListener("change", () => {
      const ms = parseInt(elAutoSelect.value, 10);
      if (!Number.isNaN(ms) && ms > 1000) {
        state.autoIntervalMs = ms;
        setupAutoRefresh();
      }
    });
  }

  if (elLogsTabBtn && elDiffTabBtn && elAITabBtn) {
    const updateTabs = (active) => {
      const map = {
        logs: [elLogsTabBtn, elLogsPanel],
        diff: [elDiffTabBtn, elDiffPanel],
        ai: [elAITabBtn, elAIToolsPanel],
      };
      for (const key of Object.keys(map)) {
        const [btn, panel] = map[key];
        if (!btn || !panel) continue;
        const on = key === active;
        btn.classList.toggle("tab-active", on);
        panel.style.display = on ? "block" : "none";
      }
    };

    elLogsTabBtn.addEventListener("click", () => updateTabs("logs"));
    elDiffTabBtn.addEventListener("click", () => updateTabs("diff"));
    elAITabBtn.addEventListener("click", () => updateTabs("ai"));

    // default to logs
    updateTabs("logs");
  }

  if (elDesignModeBtn) {
    elDesignModeBtn.addEventListener("click", () => {
      document.body.classList.toggle("fm-design-mode");
    });
  }

  if (elBacktesterBtn) {
    elBacktesterBtn.addEventListener("click", () => {
      alert(
        "Backtester workspace: this button will eventually open a dedicated FloMatrix backtesting UI.\n\nFor now, use this as a navigation anchor and design target."
      );
    });
  }

  if (elIdeaList) {
    // placeholder: later we can dynamically inject new idea items
  }
}

// ----------- Boot -------------------------------------------------------

async function boot() {
  updateBackendStatusUI();
  updateAutoUI();
  wireEvents();
  await checkBackend();
  await fetchJobs();
  setupAutoRefresh();
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("Boot failed:", err);
    state.lastError = err;
    setFooterStatus("Failed to initialize AI Builder UI.");
  });
});
