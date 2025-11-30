// =============================================================
// FloMatrix — AI Builder Control Panel
// New UI engine, safe for /ui/ + /api/ai-builder
// =============================================================

// ---------------- Backend routes (relative; same origin) ------
const API_BASE = "/api/ai-builder";

const API_ROUTES = {
  listJobs: () => `${API_BASE}/jobs`,
  jobStatus: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}`,
  approve: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}/approve`,
  run: (id) => `${API_BASE}/jobs/${encodeURIComponent(id)}/run`,
  // Logs/diff endpoints do not exist yet; we keep placeholders.
  logs: (id) => null,
  diff: (id) => null,
  // Health check uses /jobs instead of /docs to avoid CORS + file:// issues.
  health: () => `${API_BASE}/jobs`,
};

// ---------------- Helpers -------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function safeText(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  return String(value);
}

// ---------------- State ---------------------------------------
const state = {
  jobs: [],
  selectedJobId: null,
  backendOnline: false,
  autoRefresh: true,
  autoIntervalMs: 15000,
  autoTimer: null,
  lastError: null,
};

// ---------------- Elements ------------------------------------

const elBackendStatus = $("#backend-status-pill");
const elAutoToggle = $("#auto-toggle");
const elAutoLabel = $("#auto-label");
const elAutoSelect = $("#auto-interval-select");
const elRefreshAll = $("#btn-refresh-all");
const elLayoutEditToggle = $("#layout-edit-toggle");

const elJobsList = $("#jobs-list");
const elJobsFilter = $("#job-filter-input");
const elJobsReload = $("#btn-reload-jobs");
const elJobsEmptyMsg = $("#jobs-empty-msg");
const elJobsCountBadge = $("#jobs-count-badge");

const elJobTitle = $("#job-title");
const elJobMeta = $("#job-meta");
const elJobStatusBadge = $("#job-status-badge");
const elJobTimeline = $("#job-timeline");

const elApproveBtn = $("#btn-approve-patch");
const elRunBtn = $("#btn-run-job");
const elReloadSelectedBtn = $("#btn-reload-selected");
const elLoadIdInput = $("#job-load-id-input");
const elLoadIdBtn = $("#btn-load-job-id");

const elLogsTabBtn = $("#tab-logs");
const elDiffTabBtn = $("#tab-diff");
const elAITabBtn = $("#tab-ai");
const elLogsPanel = $("#logs-panel");
const elDiffPanel = $("#diff-panel");
const elAIPanel = $("#ai-panel");
const elLogsText = $("#logs-text");
const elDiffText = $("#diff-text");

const elExportCSV = $("#btn-export-csv");
const elExportXLSX = $("#btn-export-xlsx");
const elExportPDF = $("#btn-export-pdf");
const elExportDOCX = $("#btn-export-docx");

const elFooterStatus = $("#footer-status");
const elFooterAutoStatus = $("#footer-auto-status");

// ---------------- Backend Communication -----------------------

async function checkBackend() {
  try {
    const res = await fetch(API_ROUTES.health(), { method: "GET" });
    if (!res.ok) {
      state.backendOnline = false;
    } else {
      state.backendOnline = true;
    }
  } catch (err) {
    state.backendOnline = false;
    state.lastError = err;
  }
  updateBackendStatusUI();
}

async function fetchJobs() {
  if (!state.backendOnline) {
    await checkBackend();
    if (!state.backendOnline) {
      renderJobs(true);
      return;
    }
  }

  try {
    const res = await fetch(API_ROUTES.listJobs());
    if (!res.ok) throw new Error(`Jobs HTTP ${res.status}`);

    const data = await res.json();
    let jobs = Array.isArray(data) ? data : data.jobs || [];
    if (!Array.isArray(jobs)) jobs = [];

    state.jobs = jobs;
    renderJobs();
  } catch (err) {
    console.error("[FM][UI] Failed to fetch jobs:", err);
    state.lastError = err;
    renderJobs(true);
  }
}

async function fetchJobDetails(jobId) {
  if (!jobId) return;
  try {
    const res = await fetch(API_ROUTES.jobStatus(jobId));
    if (!res.ok) throw new Error(`Job ${jobId} HTTP ${res.status}`);
    const job = await res.json();
    state.selectedJobId = jobId;
    renderJobDetails(job);
    highlightSelectedJob(jobId);
    // Logs & diff are not wired yet; show friendly placeholder.
    renderLogsPlaceholder(jobId);
    renderDiffPlaceholder(jobId);
  } catch (err) {
    console.error("[FM][UI] Failed to load job:", err);
    state.lastError = err;
    renderJobDetails(null, true);
  }
}

async function approveJob(jobId) {
  if (!jobId) return;
  try {
    setFooterStatus(`Approving job ${jobId}…`);
    const res = await fetch(API_ROUTES.approve(jobId), { method: "POST" });
    if (!res.ok) throw new Error(`Approve HTTP ${res.status}`);
    setFooterStatus(`Job ${jobId} approved.`);
    await fetchJobs();
    await fetchJobDetails(jobId);
  } catch (err) {
    console.error("[FM][UI] Approve failed:", err);
    state.lastError = err;
    setFooterStatus(`Failed to approve job ${jobId}.`);
  }
}

async function runJob(jobId) {
  if (!jobId) return;
  try {
    setFooterStatus(`Running job ${jobId}…`);
    const res = await fetch(API_ROUTES.run(jobId), { method: "POST" });
    if (!res.ok) throw new Error(`Run HTTP ${res.status}`);
    setFooterStatus(`Job ${jobId} run triggered.`);
    await fetchJobs();
    await fetchJobDetails(jobId);
  } catch (err) {
    console.error("[FM][UI] Run failed:", err);
    state.lastError = err;
    setFooterStatus(`Failed to run job ${jobId}.`);
  }
}

// ---------------- UI Rendering --------------------------------

function updateBackendStatusUI() {
  if (!elBackendStatus) return;
  elBackendStatus.classList.remove("status-online", "status-offline");
  if (state.backendOnline) {
    elBackendStatus.textContent = "Backend: ONLINE";
    elBackendStatus.classList.add("status-online");
  } else {
    elBackendStatus.textContent = "Backend: OFFLINE";
    elBackendStatus.classList.add("status-offline");
  }
}

function renderJobs(error = false) {
  if (!elJobsList) return;
  elJobsList.innerHTML = "";

  if (error) {
    if (elJobsEmptyMsg) {
      elJobsEmptyMsg.textContent =
        "Unable to load jobs. Check that the AI Builder backend is running and /api/ai-builder/jobs is reachable.";
      elJobsEmptyMsg.style.display = "block";
    }
    if (elJobsCountBadge) elJobsCountBadge.textContent = "0 jobs";
    return;
  }

  const filter = (elJobsFilter?.value || "").trim().toLowerCase();
  let jobs = state.jobs || [];

  if (filter) {
    jobs = jobs.filter((job) => {
      const id = safeText(job.id || job.job_id || "", "").toLowerCase();
      const status = safeText(job.status || job.state || "", "").toLowerCase();
      const repo = safeText(job.repo || job.repository || "", "").toLowerCase();
      const path = safeText(job.path || job.target_path || "", "").toLowerCase();
      return (
        id.includes(filter) ||
        status.includes(filter) ||
        repo.includes(filter) ||
        path.includes(filter)
      );
    });
  }

  if (elJobsCountBadge) {
    elJobsCountBadge.textContent = `${jobs.length} job${jobs.length === 1 ? "" : "s"}`;
  }

  if (jobs.length === 0) {
    if (elJobsEmptyMsg) {
      elJobsEmptyMsg.textContent = state.backendOnline
        ? "No jobs yet. When the AI Builder creates jobs, they will appear here."
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
        <div class="job-row-status">${safeText(status)}</div>
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
  $$(".job-row").forEach((row) => {
    const selected = jobId && row.dataset.jobId === String(jobId);
    row.classList.toggle("job-row-selected", selected);
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
  }

  if (elJobTimeline) {
    elJobTimeline.innerHTML = "";
    const steps = job.timeline || job.events || [];
    if (Array.isArray(steps) && steps.length > 0) {
      steps.forEach((step) => {
        const label = step.label || step.event || "Event";
        const ts = step.timestamp || step.time || "";
        const msg = step.message || step.detail || "";
        const div = document.createElement("div");
        div.className = "timeline-item";
        div.innerHTML = `
          <div class="timeline-header">
            <span class="timeline-label">${safeText(label)}</span>
            <span class="timeline-time">${safeText(ts)}</span>
          </div>
          <div class="timeline-body">${safeText(msg)}</div>
        `;
        elJobTimeline.appendChild(div);
      });
    }
  }
}

function renderLogsPlaceholder(jobId) {
  if (!elLogsText) return;
  if (!jobId) {
    elLogsText.textContent = "No job selected yet.";
    return;
  }
  elLogsText.textContent =
    `Logs for job ${jobId} are not wired yet.\n\n` +
    "Don't worry, Josh — we are not there yet!\n" +
    "Once the v2 log endpoint is live, this panel will show full AI Builder logs.";
}

function renderDiffPlaceholder(jobId) {
  if (!elDiffText) return;
  elDiffText.textContent =
    "Don't worry, Josh — we are not there yet!\n\n" +
    "Patch diff rendering will plug in here once the backend exposes\n" +
    "/jobs/{id}/diff. For now this stays intentionally non-destructive.";
}

// ---------------- Auto Refresh --------------------------------

function setupAutoRefresh() {
  clearAutoTimer();
  if (!state.autoRefresh) return;
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
  if (elAutoToggle && elAutoLabel && elFooterAutoStatus) {
    elAutoToggle.classList.toggle("auto-on", state.autoRefresh);
    elAutoToggle.classList.toggle("auto-off", !state.autoRefresh);
    elAutoLabel.textContent = state.autoRefresh
      ? `Auto: ON (${Math.round(state.autoIntervalMs / 1000)}s)`
      : "Auto: OFF";
    elFooterAutoStatus.textContent = state.autoRefresh ? "ON" : "OFF";
  }
}

// ---------------- Export Helpers ------------------------------

function getExportRows() {
  // basic flatten of jobs + selected job details
  return state.jobs.map((job) => ({
    id: job.id || job.job_id || job.uuid || "",
    status: job.status || job.state || "",
    repo: job.repo || job.repository || "",
    path: job.path || job.target_path || "",
    created_at:
      job.created_at || job.created || job.timestamp || job.createdAt || "",
  }));
}

function exportCSV() {
  const rows = getExportRows();
  if (rows.length === 0) {
    alert("No jobs to export yet.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "flomatrix_jobs.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportXLSX() {
  try {
    if (typeof XLSX === "undefined") {
      alert("XLSX library not loaded.");
      return;
    }
    const rows = getExportRows();
    if (rows.length === 0) {
      alert("No jobs to export yet.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    XLSX.writeFile(wb, "flomatrix_jobs.xlsx");
  } catch (err) {
    console.error("XLSX export failed:", err);
    alert("Excel export failed. Check console for details.");
  }
}

function exportPDF() {
  try {
    if (typeof window.jspdf === "undefined" && typeof window.jspdf === "undefined" && typeof window.jspdf === "undefined") {
      // jspdf.umd exposes window.jspdf.jsPDF
    }
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) {
      alert("jsPDF library not loaded.");
      return;
    }
    const rows = getExportRows();
    if (rows.length === 0) {
      alert("No jobs to export yet.");
      return;
    }
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(12);
    doc.text("FloMatrix — AI Builder Jobs Snapshot", 40, 40);
    let y = 70;
    rows.forEach((r) => {
      doc.text(`ID: ${r.id}`, 40, y);
      doc.text(`Status: ${r.status}`, 40, y + 14);
      doc.text(`Repo: ${r.repo}`, 40, y + 28);
      doc.text(`Path: ${r.path}`, 40, y + 42);
      doc.text(`Created: ${r.created_at}`, 40, y + 56);
      y += 80;
      if (y > 740) {
        doc.addPage();
        y = 40;
      }
    });
    doc.save("flomatrix_jobs.pdf");
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("PDF export failed. Check console for details.");
  }
}

function exportDOCX() {
  try {
    const docxLib = window.docx || window.docxLib || window.docxjs || window.docxjsLib;
    if (!docxLib || !docxLib.Document || !docxLib.Packer || !docxLib.Paragraph) {
      alert("DOCX library not loaded.");
      return;
    }
    const { Document, Packer, Paragraph, TextRun } = docxLib;
    const rows = getExportRows();
    if (rows.length === 0) {
      alert("No jobs to export yet.");
      return;
    }

    const paragraphs = [];
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "FloMatrix — AI Builder Jobs Snapshot", bold: true, size: 28 })],
      })
    );

    rows.forEach((r) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `ID: ${r.id}`, break: 1 }),
            new TextRun({ text: `Status: ${r.status}`, break: 1 }),
            new TextRun({ text: `Repo: ${r.repo}`, break: 1 }),
            new TextRun({ text: `Path: ${r.path}`, break: 1 }),
            new TextRun({ text: `Created: ${r.created_at}`, break: 1 }),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    Packer.toBlob(doc).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flomatrix_jobs.docx";
      a.click();
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    console.error("DOCX export failed:", err);
    alert("DOCX export failed. Check console for details.");
  }
}

// ---------------- Layout / Design Mode ------------------------

function toggleDesignMode() {
  document.body.classList.toggle("fm-design-mode");
  const on = document.body.classList.contains("fm-design-mode");
  if (elLayoutEditToggle) {
    elLayoutEditToggle.textContent = on ? "Exit Design Mode" : "Design Mode";
  }
  setFooterStatus(on ? "Design Mode ON — rearrange panels visually." : "Design Mode OFF.");
}

// ---------------- Footer status -------------------------------

function setFooterStatus(text) {
  if (elFooterStatus) elFooterStatus.textContent = text || "";
}

// ---------------- Event Wiring -------------------------------

function wireEvents() {
  if (elRefreshAll) {
    elRefreshAll.addEventListener("click", async () => {
      setFooterStatus("Refreshing backend status + jobs…");
      await checkBackend();
      await fetchJobs();
      setFooterStatus("Ready.");
    });
  }

  if (elJobsReload) {
    elJobsReload.addEventListener("click", async () => {
      setFooterStatus("Reloading jobs…");
      await fetchJobs();
      setFooterStatus("Ready.");
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
      if (!Number.isNaN(ms) && ms >= 3000) {
        state.autoIntervalMs = ms;
        setupAutoRefresh();
      }
    });
  }

  if (elLayoutEditToggle) {
    elLayoutEditToggle.addEventListener("click", toggleDesignMode);
  }

  if (elLogsTabBtn && elDiffTabBtn && elAITabBtn) {
    elLogsTabBtn.addEventListener("click", () => {
      setActiveTab("logs");
    });
    elDiffTabBtn.addEventListener("click", () => {
      setActiveTab("diff");
    });
    elAITabBtn.addEventListener("click", () => {
      setActiveTab("ai");
    });
  }

  if (elExportCSV) elExportCSV.addEventListener("click", exportCSV);
  if (elExportXLSX) elExportXLSX.addEventListener("click", exportXLSX);
  if (elExportPDF) elExportPDF.addEventListener("click", exportPDF);
  if (elExportDOCX) elExportDOCX.addEventListener("click", exportDOCX);
}

function setActiveTab(tab) {
  if (!elLogsTabBtn || !elDiffTabBtn || !elAITabBtn) return;
  [elLogsTabBtn, elDiffTabBtn, elAITabBtn].forEach((btn) =>
    btn.classList.remove("tab-active")
  );
  if (tab === "logs") elLogsTabBtn.classList.add("tab-active");
  if (tab === "diff") elDiffTabBtn.classList.add("tab-active");
  if (tab === "ai") elAITabBtn.classList.add("tab-active");

  if (elLogsPanel && elDiffPanel && elAIPanel) {
    elLogsPanel.style.display = tab === "logs" ? "block" : "none";
    elDiffPanel.style.display = tab === "diff" ? "block" : "none";
    elAIPanel.style.display = tab === "ai" ? "block" : "none";
  }
}

// ---------------- Boot ----------------------------------------

async function boot() {
  updateBackendStatusUI();
  updateAutoUI();
  wireEvents();
  setActiveTab("logs");
  setFooterStatus("Checking backend & loading jobs…");
  await checkBackend();
  await fetchJobs();
  setupAutoRefresh();
  setFooterStatus("Ready.");
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("[FM][UI] Boot failed:", err);
    state.lastError = err;
    setFooterStatus("Failed to initialize AI Builder UI.");
  });
});
