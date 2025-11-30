// FloMatrix AI Builder Control Panel
// Standalone HTML+JS UI talking to the AI Builder backend.
//
// IMPORTANT: This assumes your backend exposes (from your Swagger):
//   GET  /api/jobs               -> list jobs  (if available)
//   GET  /api/jobs/status/{id}   -> job status + metadata
//   POST /api/jobs/approve/{id}  -> approve a patch
//   POST /api/jobs/reject/{id}   -> reject a patch
//   GET  /api/jobs/logs/{id}     -> text logs    (optional, we handle 404)
//   GET  /api/jobs/diff/{id}     -> unified diff (optional, we handle 404)
//
// If any URL is different, just adjust API_ROUTES below.

const API_BASE = "http://localhost:9000";

const API_ROUTES = {
  listJobs: () => `${API_BASE}/api/jobs`,
  jobStatus: (id) => `${API_BASE}/api/jobs/status/${encodeURIComponent(id)}`,
  approve: (id) => `${API_BASE}/api/jobs/approve/${encodeURIComponent(id)}`,
  reject: (id) => `${API_BASE}/api/jobs/reject/${encodeURIComponent(id)}`,
  logs: (id) => `${API_BASE}/api/jobs/logs/${encodeURIComponent(id)}`,
  diff: (id) => `${API_BASE}/api/jobs/diff/${encodeURIComponent(id)}`,
  // If you create a health endpoint, plug it here
  health: () => `${API_BASE}/api/jobs`, // quick GET to check backend is alive
};

const state = {
  jobs: [],
  selectedJobId: null,
  autoRefreshMs: 15000,
  autoRefreshTimer: null,
};

// DOM refs
const backendStatusChip = document.getElementById("backend-status-chip");
const backendStatusText = document.getElementById("backend-status-text");
const jobsListEl = document.getElementById("jobs-list");
const jobsCountPill = document.getElementById("jobs-count-pill");
const jobSearchInput = document.getElementById("job-search-input");
const selectedJobIdLabel = document.getElementById("selected-job-id-label");
const jobMetaGrid = document.getElementById("job-meta-grid");
const jobTimeline = document.getElementById("job-timeline");
const btnApproveJob = document.getElementById("btn-approve-job");
const btnRejectJob = document.getElementById("btn-reject-job");
const btnReloadSelected = document.getElementById("btn-reload-selected");
const btnRefreshJobs = document.getElementById("btn-refresh-jobs");
const btnRefreshAll = document.getElementById("btn-refresh-all");
const logsOutput = document.getElementById("logs-output");
const diffOutput = document.getElementById("diff-output");
const autoRefreshIndicator = document.getElementById(
  "auto-refresh-indicator"
);

// Tabs
const tabLogsBtn = document.getElementById("tab-logs-btn");
const tabDiffBtn = document.getElementById("tab-diff-btn");
const tabLogs = document.getElementById("tab-logs");
const tabDiff = document.getElementById("tab-diff");

// -------------------------
// Helpers
// -------------------------

function setBackendStatus(ok, message) {
  const dot = backendStatusChip.querySelector(".dot");
  if (!dot) return;

  backendStatusText.textContent = message;
  dot.classList.remove("dot-on", "dot-off");

  if (ok) {
    dot.classList.add("dot-on");
  } else {
    dot.classList.add("dot-off");
  }
}

async function checkBackend() {
  try {
    const res = await fetch(API_ROUTES.health(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      setBackendStatus(false, `Backend error: HTTP ${res.status}`);
      return false;
    }

    setBackendStatus(true, "Backend: ONLINE");
    return true;
  } catch (err) {
    console.error("Backend check failed:", err);
    setBackendStatus(false, "Backend: OFFLINE");
    return false;
  }
}

function clearSelectionUI() {
  selectedJobIdLabel.textContent = "No job selected";
  jobMetaGrid.innerHTML = "";
  jobTimeline.innerHTML = "";
  logsOutput.textContent = "No job selected yet.";
  diffOutput.textContent = "No patch diff loaded yet.";
  btnApproveJob.disabled = true;
  btnRejectJob.disabled = true;
  btnReloadSelected.disabled = true;
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  // Attempt to format ISO timestamp
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function createMetaCard(label, value) {
  const div = document.createElement("div");
  div.className = "fm-meta-card";

  const l = document.createElement("div");
  l.className = "fm-meta-label";
  l.textContent = label;

  const v = document.createElement("div");
  v.className = "fm-meta-value";
  v.textContent = value ?? "—";

  div.appendChild(l);
  div.appendChild(v);
  return div;
}

function statusToTagClass(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("error") || s.includes("failed")) return "fm-tag-status-error";
  if (s.includes("completed") || s.includes("done"))
    return "fm-tag-status-complete";
  if (s.includes("running") || s.includes("in_progress"))
    return "fm-tag-status-running";
  if (s.includes("queued") || s.includes("pending"))
    return "fm-tag-status-pending";
  return "";
}

// Simple diff formatting by prefix
function renderDiffText(raw) {
  if (!raw) {
    diffOutput.textContent = "No diff available for this job.";
    return;
  }

  const lines = raw.split("\n");
  const styledLines = lines.map((line) => {
    const span = document.createElement("span");
    let cls = "";

    if (line.startsWith("+")) cls = "fm-diff-line-add";
    else if (line.startsWith("-")) cls = "fm-diff-line-del";
    else if (
      line.startsWith("@@") ||
      line.startsWith("diff ") ||
      line.startsWith("index ")
    )
      cls = "fm-diff-line-meta";

    if (cls) span.classList.add(cls);
    span.textContent = line || " ";
    return span;
  });

  diffOutput.textContent = "";
  styledLines.forEach((span, idx) => {
    diffOutput.appendChild(span);
    if (idx < styledLines.length - 1) diffOutput.appendChild(document.createTextNode("\n"));
  });
}

// -------------------------
// Jobs List
// -------------------------

function renderJobsList() {
  const filter = (jobSearchInput.value || "").toLowerCase();

  jobsListEl.innerHTML = "";

  const jobsToRender = state.jobs.filter((job) => {
    if (!filter) return true;
    const combined =
      (job.id || "") +
      " " +
      (job.status || "") +
      " " +
      (job.repo || "") +
      " " +
      (job.path || "") +
      " " +
      (job.summary || "");
    return combined.toLowerCase().includes(filter);
  });

  jobsCountPill.textContent = `${jobsToRender.length} job${
    jobsToRender.length === 1 ? "" : "s"
  }`;

  if (jobsToRender.length === 0) {
    const empty = document.createElement("div");
    empty.className = "fm-job-row";
    empty.innerHTML =
      '<div class="fm-job-row-main">No jobs found.</div><div class="fm-job-row-sub">Create or trigger a job from your AI Builder backend.</div>';
    jobsListEl.appendChild(empty);
    return;
  }

  for (const job of jobsToRender) {
    const row = document.createElement("div");
    row.className = "fm-job-row";
    row.dataset.jobId = job.id;

    if (job.id === state.selectedJobId) {
      row.classList.add("fm-job-selected");
    }

    const main = document.createElement("div");
    main.className = "fm-job-row-main";
    main.textContent =
      job.summary ||
      job.title ||
      job.description ||
      `Job ${job.id || "(unknown id)"}`;

    const sub = document.createElement("div");
    sub.className = "fm-job-row-sub";
    const repoPart = job.repo ? `[${job.repo}] ` : "";
    const pathPart = job.path ? job.path : "";
    const statusPart = job.status || "unknown";
    sub.textContent = `${repoPart}${pathPart} • ${statusPart}`;

    const left = document.createElement("div");
    left.appendChild(main);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "fm-job-row-tags";

    const statusTag = document.createElement("span");
    statusTag.className = `fm-tag ${statusToTagClass(job.status)}`;
    statusTag.textContent = job.status || "unknown";
    right.appendChild(statusTag);

    if (job.mode) {
      const modeTag = document.createElement("span");
      modeTag.className = "fm-tag";
      modeTag.textContent = job.mode;
      right.appendChild(modeTag);
    }

    if (job.repo && !job.mode) {
      const repoTag = document.createElement("span");
      repoTag.className = "fm-tag";
      repoTag.textContent = job.repo;
      right.appendChild(repoTag);
    }

    row.appendChild(left);
    row.appendChild(right);

    row.addEventListener("click", () => {
      selectJob(job.id);
    });

    jobsListEl.appendChild(row);
  }
}

async function fetchJobs() {
  try {
    const res = await fetch(API_ROUTES.listJobs(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        // Backend might not have /api/jobs yet — degrade gracefully
        jobsListEl.innerHTML =
          '<div class="fm-job-row"><div class="fm-job-row-main">Jobs list endpoint not found.</div><div class="fm-job-row-sub">You can still view a job by ID using the status endpoint.</div></div>';
        jobsCountPill.textContent = "0 jobs";
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    // Expect either { jobs: [...] } or [...]
    const jobs = Array.isArray(data) ? data : data.jobs || [];
    state.jobs = jobs;
    renderJobsList();
  } catch (err) {
    console.error("Failed to fetch jobs:", err);
    jobsListEl.innerHTML =
      '<div class="fm-job-row"><div class="fm-job-row-main">Unable to load jobs.</div><div class="fm-job-row-sub">Check that the AI Builder backend is running on localhost:9000.</div></div>';
    jobsCountPill.textContent = "0 jobs";
  }
}

// -------------------------
// Job details
// -------------------------

async function selectJob(jobId) {
  if (!jobId) return;

  state.selectedJobId = jobId;
  selectedJobIdLabel.textContent = `Job: ${jobId}`;

  // Update selection highlight
  document
    .querySelectorAll(".fm-job-row")
    .forEach((el) => el.classList.remove("fm-job-selected"));
  const selectedRow = document.querySelector(
    `.fm-job-row[data-job-id="${jobId}"]`
  );
  if (selectedRow) selectedRow.classList.add("fm-job-selected");

  btnApproveJob.disabled = false;
  btnRejectJob.disabled = false;
  btnReloadSelected.disabled = false;

  await Promise.all([fetchJobStatus(jobId), fetchJobLogs(jobId), fetchJobDiff(jobId)]);
}

async function fetchJobStatus(jobId) {
  try {
    const res = await fetch(API_ROUTES.jobStatus(jobId), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const job = await res.json();
    renderJobMeta(job);
    renderJobTimeline(job);
  } catch (err) {
    console.error("Failed to fetch job status:", err);
    jobMetaGrid.innerHTML = "";
    jobMetaGrid.appendChild(
      createMetaCard("Status Error", `Could not load job: ${err}`)
    );
  }
}

function renderJobMeta(job) {
  jobMetaGrid.innerHTML = "";

  const id = job.id || state.selectedJobId || "—";
  const status = job.status || "unknown";
  const repo = job.repo || job.repository || "—";
  const path = job.path || job.file || job.target || "—";
  const mode = job.mode || job.type || "—";
  const createdAt = job.created_at || job.createdAt || job.created || job.queued_at;
  const updatedAt = job.updated_at || job.updatedAt || job.finished_at;

  jobMetaGrid.appendChild(createMetaCard("Job ID", id));
  jobMetaGrid.appendChild(createMetaCard("Status", status));
  jobMetaGrid.appendChild(createMetaCard("Mode", mode));
  jobMetaGrid.appendChild(createMetaCard("Repository", repo));
  jobMetaGrid.appendChild(createMetaCard("Target", path));
  jobMetaGrid.appendChild(
    createMetaCard("Created", formatTimestamp(createdAt))
  );
  jobMetaGrid.appendChild(
    createMetaCard("Updated", formatTimestamp(updatedAt))
  );
}

function renderJobTimeline(job) {
  jobTimeline.innerHTML = "";

  const events =
    job.timeline ||
    job.events ||
    job.history || [
      {
        label: job.status || "Status",
        message: "No explicit timeline. Status only.",
        time: job.updated_at || job.created_at || null,
      },
    ];

  for (const ev of events) {
    const item = document.createElement("div");
    item.className = "fm-timeline-item";

    const dot = document.createElement("div");
    dot.className = "fm-timeline-dot";

    const content = document.createElement("div");
    content.className = "fm-timeline-content";

    const msg = document.createElement("div");
    msg.textContent = ev.message || ev.label || JSON.stringify(ev);

    const time = document.createElement("div");
    time.className = "fm-timeline-time";
    time.textContent = formatTimestamp(ev.time || ev.ts || ev.when);

    content.appendChild(msg);
    content.appendChild(time);

    item.appendChild(dot);
    item.appendChild(content);
    jobTimeline.appendChild(item);
  }
}

// -------------------------
// Logs & diff
// -------------------------

async function fetchJobLogs(jobId) {
  try {
    const res = await fetch(API_ROUTES.logs(jobId), {
      method: "GET",
      headers: { Accept: "text/plain,application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        logsOutput.textContent = "No logs endpoint available for this job.";
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    logsOutput.textContent = text || "Logs are empty.";
  } catch (err) {
    console.error("Failed to fetch logs:", err);
    logsOutput.textContent = `Failed to load logs: ${err}`;
  }
}

async function fetchJobDiff(jobId) {
  try {
    const res = await fetch(API_ROUTES.diff(jobId), {
      method: "GET",
      headers: { Accept: "text/plain,application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        diffOutput.textContent =
          "No diff endpoint available yet. You can add /api/jobs/diff/{id} on the backend.";
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    renderDiffText(text);
  } catch (err) {
    console.error("Failed to fetch diff:", err);
    diffOutput.textContent = `Failed to load diff: ${err}`;
  }
}

// -------------------------
// Approve / Reject
// -------------------------

async function postJobAction(kind) {
  const jobId = state.selectedJobId;
  if (!jobId) return;

  const isApprove = kind === "approve";
  const url = isApprove ? API_ROUTES.approve(jobId) : API_ROUTES.reject(jobId);

  const btn = isApprove ? btnApproveJob : btnRejectJob;
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = isApprove ? "Approving…" : "Rejecting…";

  try {
    const res = await fetch(url, { method: "POST" });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const resultText = await res.text();
    logsOutput.textContent =
      (isApprove ? "✅ Job approved.\n\n" : "❌ Job rejected.\n\n") +
      resultText;

    // Refresh the job status
    await fetchJobStatus(jobId);
    await fetchJobs();
  } catch (err) {
    console.error("Job action failed:", err);
    logsOutput.textContent = `Action failed: ${err}`;
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
}

// -------------------------
// Tabs
// -------------------------

function activateTab(which) {
  if (which === "logs") {
    tabLogsBtn.classList.add("fm-tab-active");
    tabDiffBtn.classList.remove("fm-tab-active");
    tabLogs.classList.add("fm-tab-active");
    tabDiff.classList.remove("fm-tab-active");
  } else {
    tabLogsBtn.classList.remove("fm-tab-active");
    tabDiffBtn.classList.add("fm-tab-active");
    tabLogs.classList.remove("fm-tab-active");
    tabDiff.classList.add("fm-tab-active");
  }
}

// -------------------------
// Auto-refresh
// -------------------------

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshIndicator.textContent = `Auto-refresh: ON (${Math.round(
    state.autoRefreshMs / 1000
  )}s)`;

  state.autoRefreshTimer = setInterval(async () => {
    await fetchJobs();
    if (state.selectedJobId) {
      await fetchJobStatus(state.selectedJobId);
    }
  }, state.autoRefreshMs);
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

// -------------------------
// Event wiring
// -------------------------

function wireEvents() {
  jobSearchInput.addEventListener("input", () => {
    renderJobsList();
  });

  btnRefreshJobs.addEventListener("click", async () => {
    await fetchJobs();
  });

  btnRefreshAll.addEventListener("click", async () => {
    await checkBackend();
    await fetchJobs();
    if (state.selectedJobId) {
      await fetchJobStatus(state.selectedJobId);
      await fetchJobLogs(state.selectedJobId);
      await fetchJobDiff(state.selectedJobId);
    }
  });

  btnApproveJob.addEventListener("click", () => postJobAction("approve"));
  btnRejectJob.addEventListener("click", () => postJobAction("reject"));
  btnReloadSelected.addEventListener("click", async () => {
    if (!state.selectedJobId) return;
    await fetchJobStatus(state.selectedJobId);
    await fetchJobLogs(state.selectedJobId);
    await fetchJobDiff(state.selectedJobId);
  });

  tabLogsBtn.addEventListener("click", () => activateTab("logs"));
  tabDiffBtn.addEventListener("click", () => activateTab("diff"));
}

// -------------------------
// Boot
// -------------------------

async function boot() {
  clearSelectionUI();
  wireEvents();
  await checkBackend();
  await fetchJobs();
  startAutoRefresh();
}

document.addEventListener("DOMContentLoaded", boot);
