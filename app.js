(function () {
  "use strict";

  const VERSION = "pronunciation_rating_v0.3.7";
  const DEFAULT_REMOTE_MANIFEST_URL = "remote_manifest.csv";
  const AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|ogg|webm)$/i;
  const REQUIRED_MANIFEST_FILE_COLUMNS = ["recording_file", "audio_file", "file", "filename", "path"];
  const REMOTE_AUDIO_URL_COLUMNS = ["audio_url", "url", "source_url", "raw_url"];
  const DEFAULT_BREAK_INTERVAL = 40;

  const els = {
    versionLabel: document.getElementById("version-label"),
    setupPanel: document.getElementById("setup-panel"),
    taskPanel: document.getElementById("task-panel"),
    breakPanel: document.getElementById("break-panel"),
    completePanel: document.getElementById("complete-panel"),
    browserWarning: document.getElementById("browser-warning"),
    setupStatus: document.getElementById("setup-status"),
    statusAudio: document.getElementById("status-audio"),
    statusTargets: document.getElementById("status-targets"),
    statusManifest: document.getElementById("status-manifest"),
    statusMode: document.getElementById("status-mode"),
    raterId: document.getElementById("rater-id"),
    sessionId: document.getElementById("session-id"),
    seed: document.getElementById("seed"),
    taskMode: document.getElementById("task-mode"),
    breakInterval: document.getElementById("break-interval"),
    audioFiles: document.getElementById("audio-files"),
    audioFolder: document.getElementById("audio-folder"),
    manifestFile: document.getElementById("manifest-file"),
    customManifestToggle: document.getElementById("custom-manifest-toggle"),
    customManifestField: document.getElementById("custom-manifest-field"),
    sourceSummary: document.getElementById("source-summary"),
    remoteManifestUrl: document.getElementById("remote-manifest-url"),
    remoteParticipantGrid: document.getElementById("remote-participant-grid"),
    remoteSelectAllBtn: document.getElementById("remote-select-all-btn"),
    remoteClearBtn: document.getElementById("remote-clear-btn"),
    loadParticipantsBtn: document.getElementById("load-participants-btn"),
    prepareRemoteBtn: document.getElementById("prepare-remote-btn"),
    startPracticeBtn: document.getElementById("start-practice-btn"),
    practiceStatus: document.getElementById("practice-status"),
    prepareBtn: document.getElementById("prepare-btn"),
    startBtn: document.getElementById("start-btn"),
    downloadBtn: document.getElementById("download-btn"),
    finalDownloadBtn: document.getElementById("final-download-btn"),
    newSessionBtn: document.getElementById("new-session-btn"),
    setupLog: document.getElementById("setup-log"),
    taskPhase: document.getElementById("task-phase"),
    trialTitle: document.getElementById("trial-title"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    railMode: document.getElementById("rail-mode"),
    railCompleted: document.getElementById("rail-completed"),
    railRemaining: document.getElementById("rail-remaining"),
    railAudio: document.getElementById("rail-audio"),
    playBtn: document.getElementById("play-btn"),
    audioState: document.getElementById("audio-state"),
    dictationBlock: document.getElementById("dictation-block"),
    dictationInput: document.getElementById("dictation-input"),
    comprehensibilityBlock: document.getElementById("comprehensibility-block"),
    comprehensibilityScale: document.getElementById("comprehensibility-scale"),
    accentednessBlock: document.getElementById("accentedness-block"),
    accentednessScale: document.getElementById("accentedness-scale"),
    nextBtn: document.getElementById("next-btn"),
    pauseBtn: document.getElementById("pause-btn"),
    resumeBtn: document.getElementById("resume-btn"),
    breakMessage: document.getElementById("break-message"),
    completeMessage: document.getElementById("complete-message"),
  };

  const state = {
    manifestRows: [],
    remoteRows: [],
    remoteManifestUrl: "",
    items: [],
    trials: [],
    rows: [],
    currentIndex: -1,
    currentUrl: null,
    currentAudio: null,
    audioStartMs: null,
    audioEnded: false,
    playedAtIso: "",
    firstKeyRtMs: null,
    replayCount: 0,
    downloadBlobUrl: null,
    downloadName: "",
    running: false,
    practiceMode: false,
    practiceCompleted: false,
    visibilityWarningShown: false,
  };

  function setLog(message) {
    els.setupLog.textContent = message;
  }

  function formatTaskMode(value) {
    if (value === "ratings") return "Ratings";
    if (value === "dictation") return "Dictation";
    return "Combined";
  }

  function isChromeBrowser() {
    const userAgent = navigator.userAgent || "";
    const vendor = navigator.vendor || "";
    return /Chrome\//.test(userAgent) &&
      /Google Inc/.test(vendor) &&
      !/Edg\//.test(userAgent) &&
      !/OPR\//.test(userAgent);
  }

  function setSetupStatus(text, ready = false) {
    els.setupStatus.textContent = text;
    els.setupStatus.dataset.ready = ready ? "true" : "false";
  }

  function updatePracticeStatus() {
    const chromeOk = isChromeBrowser();
    const hasRater = Boolean(els.raterId.value.trim());
    els.browserWarning.classList.toggle("hidden", chromeOk);
    els.startPracticeBtn.disabled = !chromeOk || !hasRater || state.practiceMode;
    els.startPracticeBtn.textContent = state.practiceCompleted ? "Practice again" : "Start practice";
    els.practiceStatus.textContent = state.practiceCompleted
      ? "Practice complete. You can prepare and start the main rating session."
      : "Complete the practice before starting the main rating session.";
  }

  function updateStartButtonState() {
    els.startBtn.disabled = !isChromeBrowser() || !state.practiceCompleted || !state.trials.length || state.practiceMode;
  }

  function participantCountFromRows(rows) {
    return new Set(rows.map(participantIdFromRow).filter(Boolean)).size;
  }

  function participantCountFromItems(items) {
    return new Set(items.map((item) => item.participant_id).filter(Boolean)).size;
  }

  function sessionIdValue() {
    return els.sessionId.value.trim() || "auto";
  }

  function updateSetupSummary(audioCount = state.items.length, targetCount = 0, manifestCount = state.manifestRows.length) {
    const participantCount = state.remoteRows.length
      ? participantCountFromRows(state.remoteRows)
      : participantCountFromItems(state.items);
    const selectedCount = selectedRemoteParticipants().length;
    const queueCount = state.trials.length || state.items.length || 0;

    els.statusAudio.textContent = String(audioCount || 0);
    els.statusTargets.textContent = String(participantCount || targetCount || 0);
    els.statusManifest.textContent = String(selectedCount || 0);
    els.statusMode.textContent = String(queueCount || 0);
  }

  function updateSelectedMaterialSummary() {
    const audioCount = collectAudioFiles().length || state.items.length || state.remoteRows.length;
    const targetCount = state.items.filter((item) => item.target_word).length ||
      state.remoteRows.filter((row) => valueFrom(row, ["target_word", "word", "item", "expected_word"])).length;
    const manifestCount = state.manifestRows.length || state.remoteRows.length || (els.manifestFile.files[0] ? "selected" : 0);
    const remoteSelectionNeeded = state.remoteRows.length > 0 && selectedRemoteParticipants().length === 0;
    updateSetupSummary(audioCount, targetCount, manifestCount);
    updatePracticeStatus();
    if (!isChromeBrowser()) {
      setSetupStatus("Chrome required");
    } else if (audioCount && !els.raterId.value.trim()) {
      setSetupStatus("Rater needed");
    } else if (els.raterId.value.trim() && !state.practiceCompleted) {
      setSetupStatus("Practice needed");
    } else if (remoteSelectionNeeded) {
      setSetupStatus("Participant needed");
    } else if (audioCount && els.raterId.value.trim()) {
      setSetupStatus("Ready to prepare");
    } else {
      setSetupStatus("Waiting for uploaded set");
    }
    updateStartButtonState();
  }

  function showOnly(panel) {
    [els.setupPanel, els.taskPanel, els.breakPanel, els.completePanel].forEach((el) => {
      el.classList.toggle("hidden", el !== panel);
    });
  }

  function csvCell(value) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function rowsToCsv(rows) {
    if (!rows.length) return "";
    const keys = Array.from(rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()));
    return [
      keys.map(csvCell).join(","),
      ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")),
    ].join("\n");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    if (!rows.length) return [];
    const headers = rows[0].map((header) => normalizeHeader(header));
    return rows.slice(1)
      .filter((values) => values.some((value) => String(value).trim() !== ""))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function normalizeResponse(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function fileKey(value) {
    return String(value || "")
      .trim()
      .replaceAll("\\", "/")
      .split("/")
      .pop()
      .toLowerCase();
  }

  function pathKey(value) {
    return String(value || "")
      .trim()
      .replaceAll("\\", "/")
      .replace(/^\.\//, "")
      .toLowerCase();
  }

  function hashString(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function rng() {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, seedText) {
    const out = items.slice();
    const rng = mulberry32(hashString(seedText));
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function parseRecordingName(fileName) {
    const base = fileName.replace(/\.[^.]+$/, "");
    const testsRecording = base.match(/^(.+?)_(picture_naming|l2_to_l1_translation|l2_to_l1)_(\d+)_([a-z][a-z0-9_-]*)$/i);
    if (testsRecording) {
      const task = testsRecording[2] === "l2_to_l1_translation" ? "l2_to_l1" : testsRecording[2];
      return {
        participant_id: testsRecording[1],
        task,
        trial_number: testsRecording[3],
        target_word: testsRecording[4],
        source_format: "accentedness_tests_recording",
      };
    }

    const production = base.match(/^(.+?)_production_(\d+)_([a-z][a-z-]*)$/i);
    if (production) {
      return {
        participant_id: production[1],
        task: "production",
        trial_number: production[2],
        target_word: production[3],
        source_format: "vocabulary_platform_production",
      };
    }

    const pilot = base.match(/^(.+?)_(english|japanese|chinese)_pass(\d+)_(.+?)_word(\d+)_([a-z][a-z-]*)_take(\d+)_trial(\d+)_talker_(.+)$/i);
    if (pilot) {
      return {
        participant_id: pilot[1],
        native_language: pilot[2],
        pass_number: pilot[3],
        condition: pilot[4],
        word_number: pilot[5],
        target_word: pilot[6],
        take_number: pilot[7],
        trial_number: pilot[8],
        talker: pilot[9],
        task: "learning_phase",
        source_format: "pilot_learning_phase",
      };
    }

    return { source_format: "unknown_filename" };
  }

  function valueFrom(row, names) {
    for (const name of names) {
      const normalized = normalizeHeader(name);
      if (row && row[normalized] !== undefined && String(row[normalized]).trim() !== "") {
        return String(row[normalized]).trim();
      }
    }
    return "";
  }

  function participantIdFromRow(row) {
    return valueFrom(row, ["participant_id", "participant", "speaker_id", "speaker"]);
  }

  function resolveUrl(value, baseUrl = window.location.href) {
    try {
      return new URL(value, baseUrl).toString();
    } catch (error) {
      return String(value || "");
    }
  }

  function remoteAudioUrlFromRow(row, manifestUrl) {
    const directUrl = valueFrom(row, REMOTE_AUDIO_URL_COLUMNS);
    const filePath = valueFrom(row, REQUIRED_MANIFEST_FILE_COLUMNS);
    const candidate = directUrl || filePath;
    return candidate ? resolveUrl(candidate, manifestUrl) : "";
  }

  function displayFileNameFromSource(sourcePath, fallback = "audio.mp3") {
    const key = fileKey(sourcePath);
    return key || fallback;
  }

  function buildManifestIndex(rows) {
    const index = new Map();
    rows.forEach((row) => {
      const fileValue = valueFrom(row, REQUIRED_MANIFEST_FILE_COLUMNS);
      if (!fileValue) return;
      index.set(pathKey(fileValue), row);
      const base = fileKey(fileValue);
      if (!index.has(base)) index.set(base, row);
    });
    return index;
  }

  function collectAudioFiles() {
    return [...els.audioFiles.files, ...els.audioFolder.files]
      .filter((file) => AUDIO_EXTENSIONS.test(file.name))
      .sort((a, b) => {
        const aPath = a.webkitRelativePath || a.name;
        const bPath = b.webkitRelativePath || b.name;
        return aPath.localeCompare(bPath);
      })
      .map((file) => ({
        file,
        sourcePath: file.webkitRelativePath || file.name,
      }));
  }

  async function readManifest() {
    const file = els.manifestFile.files[0];
    if (!file) return [];
    const text = await file.text();
    return parseCsv(text);
  }

  async function fetchCsv(url) {
    const resolvedUrl = resolveUrl(url || DEFAULT_REMOTE_MANIFEST_URL);
    const response = await fetch(resolvedUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${resolvedUrl} (${response.status})`);
    }
    return {
      rows: parseCsv(await response.text()),
      url: resolvedUrl,
    };
  }

  function remoteManifestInput() {
    if (!els.customManifestToggle.checked) return DEFAULT_REMOTE_MANIFEST_URL;
    return els.remoteManifestUrl.value.trim() || DEFAULT_REMOTE_MANIFEST_URL;
  }

  function syncCustomManifestVisibility() {
    els.customManifestField.classList.toggle("hidden", !els.customManifestToggle.checked);
    els.sourceSummary.textContent = els.customManifestToggle.checked
      ? "Custom manifest enabled"
      : `Default: ${DEFAULT_REMOTE_MANIFEST_URL}`;
  }

  async function prepareTrials() {
    const raterId = els.raterId.value.trim();
    if (!isChromeBrowser()) {
      setSetupStatus("Chrome required");
      return;
    }
    if (!raterId) {
      setLog("Enter a rater ID before preparing local files.");
      setSetupStatus("Rater needed");
      return;
    }
    if (!state.practiceCompleted) {
      setLog("Complete the practice before preparing local files.");
      setSetupStatus("Practice needed");
      return;
    }
    if (!els.sessionId.value.trim() || els.sessionId.value.trim() === "auto") {
      els.sessionId.value = `local_${new Date().toISOString().slice(0, 10)}`;
    }

    const fileRecords = collectAudioFiles();
    if (!fileRecords.length) {
      setLog("Open Local import / troubleshooting and select at least one audio file or audio folder.");
      setSetupStatus("Audio needed");
      return;
    }

    state.manifestRows = await readManifest();
    prepareFileRecords(fileRecords, state.manifestRows);
  }

  function prepareFileRecords(fileRecords, manifestRows) {
    state.items = fileRecordsToItems(fileRecords, manifestRows);
    finishPreparedItems(manifestRows);
  }

  function prepareRemoteRows(rows, manifestUrl, participantId) {
    state.items = rows.map((row, index) => {
      const audioUrl = remoteAudioUrlFromRow(row, manifestUrl);
      const sourcePath = valueFrom(row, REQUIRED_MANIFEST_FILE_COLUMNS) || audioUrl;
      const fileName = displayFileNameFromSource(sourcePath || audioUrl, `remote_${String(index + 1).padStart(3, "0")}.mp3`);
      const parsed = parseRecordingName(fileName);
      const targetWord = valueFrom(row, ["target_word", "word", "item", "expected_word"]) || parsed.target_word || "";
      return {
        id: index + 1,
        file: null,
        audio_url: audioUrl,
        source_path: sourcePath,
        file_name: fileName,
        target_word: targetWord,
        task: valueFrom(row, ["task", "task_name", "phase"]) || parsed.task || "",
        participant_id: participantIdFromRow(row) || parsed.participant_id || participantId,
        native_language: valueFrom(row, ["native_language", "native", "l1"]) || parsed.native_language || "",
        condition: valueFrom(row, ["condition", "pass_condition", "variability_condition"]) || parsed.condition || "",
        accent_condition: valueFrom(row, ["accent_condition", "accent"]) || "",
        talker: valueFrom(row, ["talker", "talker_id", "voice", "voice_alias"]) || parsed.talker || "",
        pass_number: valueFrom(row, ["pass_number", "pass"]) || parsed.pass_number || "",
        trial_number: valueFrom(row, ["trial_number", "trial"]) || parsed.trial_number || "",
        word_number: valueFrom(row, ["word_number", "word_id", "item_id"]) || parsed.word_number || "",
        take_number: valueFrom(row, ["take_number", "take"]) || parsed.take_number || "",
        spoken_form: valueFrom(row, ["spoken_form", "spoken_text", "prompt"]),
        practice_note: valueFrom(row, ["practice_note", "note", "notes"]),
        source_format: parsed.source_format === "unknown_filename" ? "github_remote" : parsed.source_format,
        manifest: row,
      };
    });

    finishPreparedItems(rows, `participant_id: ${participantId}`);
  }

  function resetRemoteParticipantSelect(label = "Load participant list first") {
    els.remoteParticipantGrid.innerHTML = label;
    els.remoteParticipantGrid.classList.add("empty");
    els.remoteSelectAllBtn.disabled = true;
    els.remoteClearBtn.disabled = true;
    els.prepareRemoteBtn.disabled = true;
  }

  function selectedRemoteParticipants() {
    return [...els.remoteParticipantGrid.querySelectorAll("input:checked")].map((input) => input.value);
  }

  function clearPreparedQueue() {
    state.items = [];
    state.trials = [];
    state.rows = [];
    state.currentIndex = -1;
    resetDownload();
    els.downloadBtn.disabled = true;
    updateStartButtonState();
  }

  function updateRemoteParticipantActions() {
    const inputs = els.remoteParticipantGrid.querySelectorAll("input");
    const selected = selectedRemoteParticipants();
    els.remoteSelectAllBtn.disabled = inputs.length === 0;
    els.remoteClearBtn.disabled = inputs.length === 0;
    els.prepareRemoteBtn.disabled = selected.length === 0 || !isChromeBrowser() || !state.practiceCompleted;
    updateSelectedMaterialSummary();
  }

  function populateParticipantSelect(rows, manifestUrl) {
    const counts = new Map();
    rows.forEach((row) => {
      const participantId = participantIdFromRow(row);
      const audioUrl = remoteAudioUrlFromRow(row, manifestUrl);
      if (!participantId || !audioUrl) return;
      counts.set(participantId, (counts.get(participantId) || 0) + 1);
    });

    const participants = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    els.remoteParticipantGrid.innerHTML = "";
    els.remoteParticipantGrid.classList.toggle("empty", participants.length === 0);
    if (!participants.length) {
      els.remoteParticipantGrid.textContent = "No participants found.";
    }
    participants.forEach(([participantId, count]) => {
      const label = document.createElement("label");
      label.className = "participant-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = participantId;
      input.checked = participants.length === 1;
      input.addEventListener("change", () => {
        clearPreparedQueue();
        updateRemoteParticipantActions();
      });
      const text = document.createTextNode(participantId);
      const meta = document.createElement("span");
      meta.textContent = `${count} files`;
      label.append(input, text, meta);
      els.remoteParticipantGrid.append(label);
    });

    updateRemoteParticipantActions();
    return participants;
  }

  async function loadRemoteParticipants() {
    const manifestInput = remoteManifestInput();
    els.loadParticipantsBtn.disabled = true;
    els.prepareRemoteBtn.disabled = true;
    resetRemoteParticipantSelect("Loading participants...");
    setSetupStatus("Loading manifest");
    setLog(`Loading uploaded recordings:\n${manifestInput}`);

    const { rows, url } = await fetchCsv(manifestInput);
    const usableRows = rows.filter((row) => participantIdFromRow(row) && remoteAudioUrlFromRow(row, url));
    if (!usableRows.length) {
      state.remoteRows = [];
      state.remoteManifestUrl = "";
      state.manifestRows = [];
      resetRemoteParticipantSelect("No usable participants");
      updateSelectedMaterialSummary();
      throw new Error("The manifest needs rows with participant_id plus audio_file or audio_url.");
    }

    state.remoteRows = usableRows;
    state.remoteManifestUrl = url;
    state.manifestRows = usableRows;
    state.items = [];
    state.trials = [];
    resetDownload();
    els.startBtn.disabled = true;
    const participants = populateParticipantSelect(usableRows, url);
    els.sourceSummary.textContent = els.customManifestToggle.checked ? `Loaded: ${url}` : `Default loaded: ${DEFAULT_REMOTE_MANIFEST_URL}`;
    updateSelectedMaterialSummary();
    if (!isChromeBrowser()) {
      setSetupStatus("Chrome required");
    } else if (!els.raterId.value.trim()) {
      setSetupStatus("Rater needed");
    } else if (!state.practiceCompleted) {
      setSetupStatus("Practice needed");
    } else if (selectedRemoteParticipants().length) {
      setSetupStatus("Ready to prepare");
    } else {
      setSetupStatus("Participant needed");
    }
    setLog([
      `remote_manifest: ${url}`,
      `usable_rows: ${usableRows.length}`,
      `participants: ${participants.length}`,
      "",
      "participant_ids:",
      participants.map(([participantId, count]) => `${participantId}: ${count} files`).join("\n"),
    ].join("\n"));
    els.loadParticipantsBtn.disabled = false;
  }

  function prepareSelectedRemoteParticipant() {
    const raterId = els.raterId.value.trim();
    const participantIds = selectedRemoteParticipants();
    if (!isChromeBrowser()) {
      setSetupStatus("Chrome required");
      return;
    }
    if (!raterId) {
      setSetupStatus("Rater needed");
      setLog("Enter a rater ID before preparing selected participant recordings.");
      els.raterId.focus();
      return;
    }
    if (!state.practiceCompleted) {
      setSetupStatus("Practice needed");
      setLog("Complete the practice before preparing the main rating queue.");
      return;
    }
    if (!participantIds.length) {
      setSetupStatus("Participant needed");
      setLog("Select at least one participant ID from the uploaded GitHub set.");
      els.remoteParticipantGrid.focus();
      return;
    }
    if (!els.sessionId.value.trim() || els.sessionId.value.trim() === "auto") {
      els.sessionId.value = participantIds.length === 1
        ? `participant_${sanitizeName(participantIds[0])}`
        : `participants_${participantIds.length}_${new Date().toISOString().slice(0, 10)}`;
    }

    const manifestUrl = state.remoteManifestUrl || resolveUrl(remoteManifestInput());
    const participantSet = new Set(participantIds);
    const selectedRows = state.remoteRows.filter((row) => participantSet.has(participantIdFromRow(row)));
    const playableRows = selectedRows.filter((row) => remoteAudioUrlFromRow(row, manifestUrl));
    if (!playableRows.length) {
      setSetupStatus("Audio needed");
      setLog(`No playable audio rows were found for participant_id: ${participantIds.join(", ")}`);
      return;
    }

    state.manifestRows = playableRows;
    prepareRemoteRows(playableRows, manifestUrl, participantIds.join(", "));
  }

  function finishPreparedItems(manifestRows, extraLogLine = "") {
    const raterId = els.raterId.value.trim();
    const sessionId = sessionIdValue();
    const sourceSignature = state.items.map((item) => item.source_path || item.audio_url || item.file_name).join("|");

    const seed = els.seed.value.trim() || `${raterId}_${sessionId}_${sourceSignature}_${VERSION}`;
    const taskMode = els.taskMode.value;
    state.trials = shuffle(state.items, seed);
    state.rows = [];
    state.currentIndex = -1;
    resetDownload();

    const targetCount = state.items.filter((item) => item.target_word).length;
    updateSetupSummary(state.items.length, targetCount, state.manifestRows.length);
    setSetupStatus(state.practiceCompleted ? "Ready" : "Practice needed", state.practiceCompleted);
    const manifestMessage = state.manifestRows.length
      ? `manifest_rows: ${state.manifestRows.length}`
      : "manifest_rows: 0";
    const preview = state.trials.slice(0, 5).map((item, index) => {
      const target = item.target_word ? "target=available" : "target=missing";
      return `${index + 1}. ${item.file_name} (${target})`;
    }).join("\n");

    setLog([
      `version: ${VERSION}`,
      `audio_files: ${state.items.length}`,
      `target_words_available: ${targetCount}`,
      manifestMessage,
      `task_mode: ${formatTaskMode(taskMode)}`,
      `shuffle_seed: rater_id`,
      extraLogLine,
      "",
      "first_trials:",
      preview,
    ].filter((line) => line !== "").join("\n"));

    updateStartButtonState();
    els.downloadBtn.disabled = true;
  }

  function resetDownload() {
    if (state.downloadBlobUrl) URL.revokeObjectURL(state.downloadBlobUrl);
    state.downloadBlobUrl = null;
    state.downloadName = "";
  }

  function renderScales() {
    renderScale(els.comprehensibilityScale, "comprehensibility");
    renderScale(els.accentednessScale, "accentedness");
  }

  function renderScale(container, name) {
    container.innerHTML = "";
    for (let value = 1; value <= 10; value += 1) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = String(value);
      input.addEventListener("change", updateNextState);
      label.append(input, document.createTextNode(String(value)));
      container.append(label);
    }
  }

  function selectedScale(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function clearSelectedScale(name) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = false;
    });
  }

  function setScaleDisabled(name, disabled) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.disabled = disabled;
    });
  }

  function startSession() {
    if (!isChromeBrowser()) {
      setSetupStatus("Chrome required");
      return;
    }
    if (!state.practiceCompleted) {
      setSetupStatus("Practice needed");
      setLog("Complete the practice before starting the main rating session.");
      return;
    }
    if (!state.trials.length) {
      setSetupStatus("Queue needed");
      return;
    }
    state.practiceMode = false;
    state.running = true;
    updateStartButtonState();
    showOnly(els.taskPanel);
    showTrial(0);
  }

  function showTrial(index) {
    cleanupAudio();
    state.currentIndex = index;
    state.audioStartMs = null;
    state.audioEnded = false;
    state.playedAtIso = "";
    state.firstKeyRtMs = null;
    state.replayCount = 0;

    clearSelectedScale("comprehensibility");
    clearSelectedScale("accentedness");
    els.dictationInput.value = "";
    els.dictationInput.disabled = true;
    els.nextBtn.disabled = true;
    els.playBtn.disabled = false;
    els.playBtn.textContent = "Play audio";
    els.audioState.textContent = "Audio has not been played.";
    updateTaskModeVisibility();

    const trialNumber = index + 1;
    const total = state.trials.length;
    els.taskPhase.textContent = state.practiceMode ? `Practice ${trialNumber} of ${total}` : `Sample ${trialNumber} of ${total}`;
    els.trialTitle.textContent = state.practiceMode ? "Practice: listen, transcribe, and rate" : "Listen, transcribe, and rate";
    els.progressFill.style.width = `${Math.max(0, (index / total) * 100)}%`;
    els.progressText.textContent = `${index} of ${total} completed`;
    els.railMode.textContent = `${trialNumber} / ${total}`;
    els.railCompleted.textContent = String(index);
    els.railRemaining.textContent = String(total - index);
    els.railAudio.textContent = "Pending";
  }

  function cleanupAudio() {
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.src = "";
      state.currentAudio = null;
    }
    if (state.currentUrl) {
      URL.revokeObjectURL(state.currentUrl);
      state.currentUrl = null;
    }
  }

  async function playCurrentAudio() {
    const item = state.trials[state.currentIndex];
    if (!item) return;

    cleanupAudio();
    let audio;
    if (item.audio_url) {
      audio = new Audio(item.audio_url);
    } else if (item.file) {
      state.currentUrl = URL.createObjectURL(item.file);
      audio = new Audio(state.currentUrl);
    } else {
      throw new Error("No audio source is attached to this trial.");
    }
    state.currentAudio = audio;
    state.replayCount += state.audioStartMs ? 1 : 0;

    state.audioEnded = false;
    els.dictationInput.disabled = true;
    setScaleDisabled("comprehensibility", true);
    setScaleDisabled("accentedness", true);
    updateNextState();
    els.playBtn.disabled = true;
    els.audioState.textContent = "Playing...";
    els.railAudio.textContent = "Playing";
    state.audioStartMs = performance.now();
    state.playedAtIso = new Date().toISOString();

    audio.addEventListener("ended", () => {
      state.audioEnded = true;
      if (requiresDictation()) {
        els.dictationInput.disabled = false;
        els.dictationInput.focus();
      }
      if (requiresRatings()) {
        setScaleDisabled("comprehensibility", false);
        setScaleDisabled("accentedness", false);
      }
      els.playBtn.disabled = false;
      els.playBtn.textContent = "Replay audio";
      els.audioState.textContent = state.replayCount
        ? `Audio replayed ${state.replayCount} time${state.replayCount === 1 ? "" : "s"}. Complete the response fields.`
        : "Audio played once. Complete the response fields.";
      els.railAudio.textContent = "Played";
      updateNextState();
    }, { once: true });

    audio.addEventListener("error", () => {
      state.audioEnded = false;
      els.audioState.textContent = "This audio file could not be played.";
      els.railAudio.textContent = "Error";
      els.playBtn.disabled = false;
      updateNextState();
    }, { once: true });

    await audio.play();
  }

  function handleFirstKey() {
    if (!state.audioStartMs || state.firstKeyRtMs !== null) return;
    state.firstKeyRtMs = performance.now() - state.audioStartMs;
  }

  function updateNextState() {
    const played = state.audioEnded;
    const dictationReady = !requiresDictation() || Boolean(els.dictationInput.value.trim());
    const ratingReady = !requiresRatings() || Boolean(
      selectedScale("comprehensibility") &&
      selectedScale("accentedness")
    );
    const ready = played && dictationReady && ratingReady;
    els.nextBtn.disabled = !ready;
  }

  function requiresDictation() {
    return els.taskMode.value === "combined" || els.taskMode.value === "dictation";
  }

  function requiresRatings() {
    return els.taskMode.value === "combined" || els.taskMode.value === "ratings";
  }

  function updateTaskModeVisibility() {
    const dictation = requiresDictation();
    const ratings = requiresRatings();
    els.dictationBlock.classList.toggle("hidden", !dictation);
    els.comprehensibilityBlock.classList.toggle("hidden", !ratings);
    els.accentednessBlock.classList.toggle("hidden", !ratings);
    if (!dictation) {
      els.dictationInput.value = "";
      els.dictationInput.disabled = true;
    }
    setScaleDisabled("comprehensibility", !ratings || !state.audioEnded);
    setScaleDisabled("accentedness", !ratings || !state.audioEnded);
  }

  function saveTrialAndAdvance() {
    const item = state.trials[state.currentIndex];
    const typed = requiresDictation() ? els.dictationInput.value.trim() : "";
    const target = item.target_word || "";
    const normalizedTyped = normalizeResponse(typed);
    const normalizedTarget = normalizeResponse(target);
    const submitRt = state.audioStartMs ? performance.now() - state.audioStartMs : null;
    const currentAudio = state.currentAudio;

    state.rows.push({
      platform_version: VERSION,
      rater_id: els.raterId.value.trim(),
      session_id: sessionIdValue(),
      task_mode: els.taskMode.value,
      trial_index: state.currentIndex + 1,
      trial_total: state.trials.length,
      completed_at: new Date().toISOString(),
      played_at: state.playedAtIso,
      source_path: item.source_path,
      audio_url: item.audio_url || "",
      file_name: item.file_name,
      task: item.task,
      participant_id: item.participant_id,
      native_language: item.native_language,
      accent_condition: item.accent_condition,
      condition: item.condition,
      talker: item.talker,
      pass_number: item.pass_number,
      word_number: item.word_number,
      trial_number: item.trial_number,
      take_number: item.take_number,
      spoken_form: item.spoken_form,
      practice_note: item.practice_note,
      source_format: item.source_format,
      target_word: target,
      typed_response: typed,
      normalized_response: normalizedTyped,
      normalized_target: normalizedTarget,
      intelligibility_exact: requiresDictation() && normalizedTarget ? Number(normalizedTyped === normalizedTarget) : "",
      intelligibility_needs_manual_review: requiresDictation() && normalizedTarget ? Number(normalizedTyped !== normalizedTarget) : "",
      first_key_rt_ms: state.firstKeyRtMs === null ? "" : state.firstKeyRtMs.toFixed(1),
      submit_rt_ms: submitRt === null ? "" : submitRt.toFixed(1),
      audio_duration_s: currentAudio && Number.isFinite(currentAudio.duration) ? currentAudio.duration.toFixed(3) : "",
      replay_count: state.replayCount,
      comprehensibility_1_10: requiresRatings() ? selectedScale("comprehensibility") : "",
      accentedness_1_10: requiresRatings() ? selectedScale("accentedness") : "",
    });

    const nextIndex = state.currentIndex + 1;
    const breakInterval = Number.parseInt(els.breakInterval.value, 10) || 0;
    if (nextIndex >= state.trials.length) {
      if (state.practiceMode) {
        completePracticeSession();
        return;
      }
      completeSession();
      return;
    }
    if (!state.practiceMode && breakInterval > 0 && nextIndex % breakInterval === 0) {
      showBreak(nextIndex);
      return;
    }
    showTrial(nextIndex);
  }

  function completePracticeSession() {
    cleanupAudio();
    state.practiceMode = false;
    state.practiceCompleted = true;
    state.running = false;
    state.rows = [];
    state.trials = [];
    state.items = [];
    state.currentIndex = -1;
    els.sessionId.value = "auto";
    updatePracticeStatus();
    updateRemoteParticipantActions();
    setSetupStatus(selectedRemoteParticipants().length ? "Ready to prepare" : "Participant needed", Boolean(selectedRemoteParticipants().length));
    setLog("Practice complete. Select participant IDs and prepare the main rating queue.");
    showOnly(els.setupPanel);
  }

  function showBreak(nextIndex) {
    cleanupAudio();
    const total = state.trials.length;
    els.breakMessage.textContent = `${nextIndex} of ${total} samples completed.`;
    showOnly(els.breakPanel);
  }

  function resumeFromBreak() {
    showOnly(els.taskPanel);
    showTrial(state.rows.length);
  }

  async function completeSession() {
    cleanupAudio();
    state.running = false;
    els.progressFill.style.width = "100%";
    els.progressText.textContent = `${state.trials.length} of ${state.trials.length} completed`;
    els.railCompleted.textContent = String(state.trials.length);
    els.railRemaining.textContent = "0";
    els.railAudio.textContent = "Complete";
    await buildDownload();
    els.completeMessage.textContent = `${state.rows.length} samples completed.`;
    showOnly(els.completePanel);
  }

  async function buildDownload() {
    const csv = rowsToCsv(state.rows);
    const assignment = {
      platform_version: VERSION,
      rater_id: els.raterId.value.trim(),
      session_id: sessionIdValue(),
      task_mode: els.taskMode.value,
      created_at: new Date().toISOString(),
      trial_count: state.trials.length,
      trial_order: state.trials.map((item, index) => ({
        trial_index: index + 1,
        source_path: item.source_path,
        audio_url: item.audio_url || "",
        file_name: item.file_name,
        task: item.task,
        target_word: item.target_word,
        participant_id: item.participant_id,
        condition: item.condition,
        talker: item.talker,
        spoken_form: item.spoken_form,
        practice_note: item.practice_note,
      })),
    };

    const baseName = `${sanitizeName(els.raterId.value || "rater")}_${sanitizeName(sessionIdValue())}_pronunciation_ratings`;
    if (window.JSZip) {
      const zip = new JSZip();
      zip.file(`${baseName}.csv`, csv);
      zip.file(`${baseName}_assignment.json`, JSON.stringify(assignment, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      setDownload(blob, `${baseName}.zip`);
    } else {
      setDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
    }
    els.downloadBtn.disabled = false;
  }

  function fileRecordsToItems(fileRecords, manifestRows) {
    const manifestIndex = buildManifestIndex(manifestRows);
    return fileRecords.map(({ file, sourcePath }, index) => {
      const parsed = parseRecordingName(file.name);
      const manifest = manifestIndex.get(pathKey(sourcePath)) || manifestIndex.get(fileKey(sourcePath)) || manifestIndex.get(fileKey(file.name)) || {};
      const targetWord = valueFrom(manifest, ["target_word", "word", "item", "expected_word"]) || parsed.target_word || "";
      return {
        id: index + 1,
        file,
        source_path: sourcePath,
        file_name: file.name,
        target_word: targetWord,
        task: valueFrom(manifest, ["task", "task_name", "phase"]) || parsed.task || "",
        participant_id: valueFrom(manifest, ["participant_id", "participant", "speaker_id", "speaker"]) || parsed.participant_id || "",
        native_language: valueFrom(manifest, ["native_language", "native", "l1"]) || parsed.native_language || "",
        condition: valueFrom(manifest, ["condition", "pass_condition", "variability_condition"]) || parsed.condition || "",
        accent_condition: valueFrom(manifest, ["accent_condition", "accent"]) || "",
        talker: valueFrom(manifest, ["talker", "talker_id", "voice", "voice_alias"]) || parsed.talker || "",
        pass_number: valueFrom(manifest, ["pass_number", "pass"]) || parsed.pass_number || "",
        trial_number: valueFrom(manifest, ["trial_number", "trial"]) || parsed.trial_number || "",
        word_number: valueFrom(manifest, ["word_number", "word_id", "item_id"]) || parsed.word_number || "",
        take_number: valueFrom(manifest, ["take_number", "take"]) || parsed.take_number || "",
        spoken_form: valueFrom(manifest, ["spoken_form", "spoken_text", "prompt"]),
        practice_note: valueFrom(manifest, ["practice_note", "note", "notes"]),
        source_format: parsed.source_format,
        manifest,
      };
    });
  }

  function setDownload(blob, fileName) {
    resetDownload();
    state.downloadBlobUrl = URL.createObjectURL(blob);
    state.downloadName = fileName;
  }

  function downloadResults() {
    if (!state.downloadBlobUrl) {
      buildDownload().then(downloadResults);
      return;
    }
    const a = document.createElement("a");
    a.href = state.downloadBlobUrl;
    a.download = state.downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function loadPracticeFileRecords(limit = 3) {
    const manifestResponse = await fetch("practice_manifest.csv", { cache: "no-store" });
    if (!manifestResponse.ok) {
      throw new Error(`Could not load practice_manifest.csv (${manifestResponse.status})`);
    }

    const manifestRows = parseCsv(await manifestResponse.text()).slice(0, limit);
    const fileRecords = [];
    for (const row of manifestRows) {
      const audioPath = valueFrom(row, REQUIRED_MANIFEST_FILE_COLUMNS);
      if (!audioPath) continue;
      const response = await fetch(audioPath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Could not load ${audioPath} (${response.status})`);
      }
      const blob = await response.blob();
      const audioName = fileKey(audioPath);
      const fallbackType = audioName.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
      const file = new File([blob], audioName, { type: blob.type || fallbackType });
      fileRecords.push({ file, sourcePath: audioPath });
    }
    return { manifestRows, fileRecords };
  }

  async function startPractice() {
    if (!isChromeBrowser()) {
      setSetupStatus("Chrome required");
      return;
    }
    if (!els.raterId.value.trim()) {
      setSetupStatus("Rater needed");
      els.raterId.focus();
      return;
    }
    if (!els.sessionId.value.trim() || els.sessionId.value.trim() === "auto") els.sessionId.value = "practice_check";
    els.startPracticeBtn.disabled = true;
    setSetupStatus("Loading");
    setLog("Loading bundled practice samples...");

    const { manifestRows, fileRecords } = await loadPracticeFileRecords();
    state.practiceMode = true;
    state.running = true;
    state.rows = [];
    state.items = fileRecordsToItems(fileRecords, manifestRows);
    state.trials = shuffle(state.items, `practice_${els.raterId.value.trim()}_${VERSION}`);
    state.currentIndex = -1;
    resetDownload();
    setSetupStatus("Practice running");
    setLog("Practice started. Complete all practice samples before the main rating session.");
    showOnly(els.taskPanel);
    showTrial(0);
  }

  function pauseSession() {
    if (state.practiceMode) {
      state.practiceMode = false;
      state.running = false;
      cleanupAudio();
      clearPreparedQueue();
      updatePracticeStatus();
      updateSelectedMaterialSummary();
      setLog("Practice stopped. Complete the practice before starting the main rating session.");
      showOnly(els.setupPanel);
      return;
    }
    state.running = false;
    cleanupAudio();
    showOnly(els.setupPanel);
    updateStartButtonState();
    els.downloadBtn.disabled = state.rows.length === 0;
    setLog(`Paused after ${state.rows.length} of ${state.trials.length} samples.\nDownload partial results before closing the browser.`);
    if (state.rows.length) buildDownload();
  }

  function newSession() {
    state.running = false;
    cleanupAudio();
    resetDownload();
    state.rows = [];
    state.trials = [];
    state.items = [];
    state.manifestRows = [];
    state.remoteRows = [];
    state.remoteManifestUrl = "";
    state.currentIndex = -1;
    state.practiceMode = false;
    state.practiceCompleted = false;
    state.visibilityWarningShown = false;
    els.startBtn.disabled = true;
    els.downloadBtn.disabled = true;
    els.audioFiles.value = "";
    els.audioFolder.value = "";
    els.manifestFile.value = "";
    els.sessionId.value = "auto";
    els.seed.value = "";
    els.taskMode.value = "combined";
    els.breakInterval.value = String(DEFAULT_BREAK_INTERVAL);
    resetRemoteParticipantSelect();
    syncCustomManifestVisibility();
    setLog("");
    updatePracticeStatus();
    updateSetupSummary(0, 0, 0);
    setSetupStatus("Loading participants");
    showOnly(els.setupPanel);
    loadRemoteParticipants().catch((error) => {
      els.loadParticipantsBtn.disabled = false;
      setSetupStatus("Remote load failed");
      setLog(`Remote participant load failed: ${error.message}`);
    });
  }

  function sanitizeName(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      || "session";
  }

  window.addEventListener("beforeunload", (event) => {
    if (!state.running && state.rows.length === 0) return;
    event.preventDefault();
    event.returnValue = "";
  });

  document.addEventListener("visibilitychange", () => {
    if (!state.running) return;
    if (document.hidden) {
      state.visibilityWarningShown = true;
      return;
    }
    if (state.visibilityWarningShown) {
      state.visibilityWarningShown = false;
      els.audioState.textContent = "Please keep this page open until the session is complete.";
      window.alert("Please keep this page open until the rating session is complete.");
    }
  });

  els.versionLabel.textContent = VERSION;
  els.loadParticipantsBtn.addEventListener("click", () => {
    loadRemoteParticipants().catch((error) => {
      els.loadParticipantsBtn.disabled = false;
      setSetupStatus("Remote load failed");
      setLog(`Remote participant load failed: ${error.message}`);
    });
  });
  els.customManifestToggle.addEventListener("change", syncCustomManifestVisibility);
  els.remoteManifestUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadRemoteParticipants().catch((error) => {
        els.loadParticipantsBtn.disabled = false;
        setSetupStatus("Remote load failed");
        setLog(`Remote participant load failed: ${error.message}`);
      });
    }
  });
  els.remoteSelectAllBtn.addEventListener("click", () => {
    clearPreparedQueue();
    els.remoteParticipantGrid.querySelectorAll("input").forEach((input) => {
      input.checked = true;
    });
    updateRemoteParticipantActions();
  });
  els.remoteClearBtn.addEventListener("click", () => {
    clearPreparedQueue();
    els.remoteParticipantGrid.querySelectorAll("input").forEach((input) => {
      input.checked = false;
    });
    updateRemoteParticipantActions();
  });
  els.prepareRemoteBtn.addEventListener("click", prepareSelectedRemoteParticipant);
  els.raterId.addEventListener("input", () => {
    clearPreparedQueue();
    updateSelectedMaterialSummary();
  });
  els.sessionId.addEventListener("input", updateSelectedMaterialSummary);
  els.startPracticeBtn.addEventListener("click", () => {
    startPractice().catch((error) => {
      updatePracticeStatus();
      setSetupStatus("Practice load failed");
      setLog(`Practice sample load failed: ${error.message}`);
    });
  });
  els.prepareBtn.addEventListener("click", prepareTrials);
  els.startBtn.addEventListener("click", startSession);
  els.downloadBtn.addEventListener("click", downloadResults);
  els.finalDownloadBtn.addEventListener("click", downloadResults);
  els.newSessionBtn.addEventListener("click", newSession);
  els.pauseBtn.addEventListener("click", pauseSession);
  els.resumeBtn.addEventListener("click", resumeFromBreak);
  els.playBtn.addEventListener("click", () => {
    playCurrentAudio().catch((error) => {
      els.audioState.textContent = `Playback failed: ${error.message}`;
      els.playBtn.disabled = false;
    });
  });
  els.dictationInput.addEventListener("keydown", handleFirstKey);
  els.dictationInput.addEventListener("input", updateNextState);
  els.nextBtn.addEventListener("click", saveTrialAndAdvance);
  els.taskMode.addEventListener("change", updateSelectedMaterialSummary);
  els.audioFiles.addEventListener("change", updateSelectedMaterialSummary);
  els.audioFolder.addEventListener("change", updateSelectedMaterialSummary);
  els.manifestFile.addEventListener("change", updateSelectedMaterialSummary);
  els.breakInterval.value = String(DEFAULT_BREAK_INTERVAL);
  syncCustomManifestVisibility();
  updateSelectedMaterialSummary();
  loadRemoteParticipants().catch((error) => {
    els.loadParticipantsBtn.disabled = false;
    setSetupStatus("Remote load failed");
    setLog(`Remote participant load failed: ${error.message}`);
  });
  renderScales();
})();
