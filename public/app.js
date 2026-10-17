/**
 * NoticeLens Frontend Application
 * Plain JavaScript (ES6+), Mobile-first, Rule-based.
 */

// Preset Notice Samples (Real-world college notices)
const NOTICE_SAMPLES = {
  sample_exams: `All III-year CSE students: Internal Test 2 will be held on 13 Nov 2026 from 10:00 AM to 11:30 AM in Room 204. Lab records must be submitted to the department office by 12:00 noon on 13 Nov. A guest lecture on “AI in Healthcare” is scheduled on 13 Nov, 11:00 AM to 12:30 PM, Seminar Hall.`,
  
  sample_techfest: `SETU Department of Computer Science & Engineering: Annual TechFest 2026 schedule announced! National Hackathon round 1 submission deadline is 18 Nov 2026 by 5:00 PM. The 24-hr Coding Challenge finals begin on 19 Nov from 10:00 AM to 1:00 PM in Computer Lab 3. Distinguished Alumni Keynote on 'Quantum Computing' will be hosted on 19 Nov from 2:00 PM to 4:00 PM in the Main Auditorium.`,
  
  sample_holiday: `University Academic Circular: Friday, 14 Nov 2026 is declared an Official University Holiday on account of the Diwali festival. All theory lectures and laboratory sessions stand suspended. The rescheduled Database Management Systems (DBMS) tutorial class will be held on Saturday 15 Nov 2026 from 10:00 AM to 11:30 AM in Room 102.`,
  
  sample_whatsapp: `CR Notice for III Sem CSE: Mid-term theory assessment scheduled on 20 Nov 2026 from 9:30 AM to 12:00 PM in Seminar Hall. Operating Systems term paper submission due by 6:00 PM on 21 Nov at department desk. Mini-project milestone review will take place on 22 Nov from 11:00 AM to 1:30 PM in Project Lab.`
};

// Plain-language flag explanations (SPEC.md)
const FLAG_LABELS = {
  missing_time: 'No time found. Please add one before exporting.',
  no_ampm: 'AM or PM was not stated, we guessed.',
  no_year: 'No year given, we assumed the next one.',
  ambiguous_date: 'Read as day/month. Please check.',
  unknown_type: 'We could not tell the event type.',
  no_venue: 'No venue found.',
  assumed_end: 'No end time, we assumed 1 hour.',
  date_range: 'Date range detected. Only the first day was added; please add the others.',
  past_date: 'This date is in the past.',
};

// Application State
const state = {
  mode: document.body.dataset.mode || 'student', // 'student', 'coordinator', 'published'
  events: [],
  originalText: '',
  timetable: [],
  clashes: [],
  checks: [],
  skipped: [],
  acknowledgedClashes: new Set(),
  activeFilter: 'all',
  searchQuery: '',
  theme: localStorage.getItem('noticelens_theme') || 'light',
  clashDebounceTimer: null,
};

// DOM Elements
const elements = {
  errorBanner: document.getElementById('errorBanner'),
  errorMessage: document.getElementById('errorMessage'),
  closeBanner: document.getElementById('closeBanner'),
  noticeText: document.getElementById('noticeText'),
  charCount: document.getElementById('charCount'),
  btnAnalyze: document.getElementById('btnAnalyze'),
  btnClear: document.getElementById('btnClear'),
  btnUploadPdf: document.getElementById('btnUploadPdf'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  dropZone: document.getElementById('dropZone'),
  dropOverlay: document.getElementById('dropOverlay'),
  loadingState: document.getElementById('loadingState'),
  resultsArea: document.getElementById('resultsArea'),
  eventCount: document.getElementById('eventCount'),
  eventSearchInput: document.getElementById('eventSearchInput'),
  highlightedSection: document.getElementById('highlightedSection'),
  highlightedText: document.getElementById('highlightedText'),
  eventCardsContainer: document.getElementById('eventCardsContainer'),
  clashBadgeBox: document.getElementById('clashBadgeBox'),
  clashSummaryText: document.getElementById('clashSummaryText'),
  clashTableBody: document.getElementById('clashTableBody'),
  timelineContainer: document.getElementById('timelineContainer'),
  btnExportIcs: document.getElementById('btnExportIcs'),
  exportDisabledHint: document.getElementById('exportDisabledHint'),
  btnCopyWhatsApp: document.getElementById('btnCopyWhatsApp'),
  btnOpenAddModal: document.getElementById('btnOpenAddModal'),
  addEventDialog: document.getElementById('addEventDialog'),
  addEventForm: document.getElementById('addEventForm'),
  btnCloseAddModal: document.getElementById('btnCloseAddModal'),
  btnCancelAddModal: document.getElementById('btnCancelAddModal'),
  publishSection: document.getElementById('publishSection'),
  publishTitle: document.getElementById('publishTitle'),
  btnPublish: document.getElementById('btnPublish'),
  publishedShareBox: document.getElementById('publishedShareBox'),
  shareUrlInput: document.getElementById('shareUrlInput'),
  btnCopyLink: document.getElementById('btnCopyLink'),
  btnToggleQr: document.getElementById('btnToggleQr'),
  qrCodeContainer: document.getElementById('qrCodeContainer'),
  qrSvgHolder: document.getElementById('qrSvgHolder'),
  btnViewQrPublished: document.getElementById('btnViewQrPublished'),
  qrCodePublishedBox: document.getElementById('qrCodePublishedBox'),
  qrPublishedSvg: document.getElementById('qrPublishedSvg'),
  btnClosePublishedQr: document.getElementById('btnClosePublishedQr'),
  btnCopyPublishedLink: document.getElementById('btnCopyPublishedLink'),
  timetableForm: document.getElementById('timetableForm'),
  slotDay: document.getElementById('slotDay'),
  slotStart: document.getElementById('slotStart'),
  slotEnd: document.getElementById('slotEnd'),
  slotSubject: document.getElementById('slotSubject'),
  timetableFormError: document.getElementById('timetableFormError'),
  timetableSlotsList: document.getElementById('timetableSlotsList'),
  btnClearTimetable: document.getElementById('btnClearTimetable'),
  btnPresetCSE: document.getElementById('btnPresetCSE'),
  btnPresetFirstYear: document.getElementById('btnPresetFirstYear'),
  btnExportTimetable: document.getElementById('btnExportTimetable'),
  btnImportTimetable: document.getElementById('btnImportTimetable'),
  importTimetableInput: document.getElementById('importTimetableInput'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  toastNotification: document.getElementById('toastNotification'),
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTimetable();
  renderTimetableSlots();
  setupEventListeners();

  // If in published mode, load data from window object
  if (state.mode === 'published' && window.INITIAL_PUBLISHED_NOTICE) {
    const pub = window.INITIAL_PUBLISHED_NOTICE;
    state.events = pub.events || [];
    state.originalText = pub.text || '';
    renderResults();
    triggerClashCheck();
  }
});

// ==========================================
// Theme Management
// ==========================================
function initTheme() {
  applyTheme(state.theme);
  if (elements.btnThemeToggle) {
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('noticelens_theme', theme);
  if (elements.themeIcon) {
    elements.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

// ==========================================
// Toast Notification
// ==========================================
let toastTimer = null;
function showToast(message, duration = 3000) {
  if (!elements.toastNotification) return;
  elements.toastNotification.textContent = message;
  elements.toastNotification.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toastNotification.classList.add('hidden');
  }, duration);
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  if (elements.closeBanner) {
    elements.closeBanner.addEventListener('click', hideError);
  }

  if (elements.btnAnalyze) {
    elements.btnAnalyze.addEventListener('click', handleAnalyze);
  }

  // Sample Notice Buttons
  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sampleKey = btn.dataset.sample;
      if (NOTICE_SAMPLES[sampleKey] && elements.noticeText) {
        elements.noticeText.value = NOTICE_SAMPLES[sampleKey];
        updateCharCount();
        hideError();
        handleAnalyze();
        showToast('Sample loaded and analyzed!');
      }
    });
  });

  if (elements.noticeText) {
    elements.noticeText.addEventListener('input', updateCharCount);
  }

  if (elements.btnClear) {
    elements.btnClear.addEventListener('click', handleClear);
  }

  // PDF File Upload & Drag-and-Drop
  if (elements.btnUploadPdf && elements.pdfFileInput) {
    elements.btnUploadPdf.addEventListener('click', () => {
      elements.pdfFileInput.click();
    });
    elements.pdfFileInput.addEventListener('change', handlePdfUpload);
  }

  setupDragAndDrop();

  if (elements.btnExportIcs) {
    elements.btnExportIcs.addEventListener('click', handleExportIcs);
  }

  if (elements.btnCopyWhatsApp) {
    elements.btnCopyWhatsApp.addEventListener('click', handleCopyWhatsApp);
  }

  // Filter Tabs
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilter = tab.dataset.filter || 'all';
      renderEventCards();
    });
  });

  // Search Input
  if (elements.eventSearchInput) {
    elements.eventSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderEventCards();
    });
  }

  // Add Event Modal
  if (elements.btnOpenAddModal && elements.addEventDialog) {
    elements.btnOpenAddModal.addEventListener('click', () => {
      // Set default date to today
      const todayISO = new Date().toISOString().slice(0, 10);
      const dateInput = document.getElementById('modalEventDate');
      if (dateInput) dateInput.value = todayISO;
      elements.addEventDialog.showModal();
    });
  }

  if (elements.btnCloseAddModal && elements.addEventDialog) {
    elements.btnCloseAddModal.addEventListener('click', () => elements.addEventDialog.close());
  }
  if (elements.btnCancelAddModal && elements.addEventDialog) {
    elements.btnCancelAddModal.addEventListener('click', () => elements.addEventDialog.close());
  }

  if (elements.addEventForm) {
    elements.addEventForm.addEventListener('submit', handleAddCustomEvent);
  }

  // Timetable Handlers
  if (elements.timetableForm) {
    elements.timetableForm.addEventListener('submit', handleAddTimetableSlot);
  }

  if (elements.btnClearTimetable) {
    elements.btnClearTimetable.addEventListener('click', handleClearTimetable);
  }

  if (elements.btnPresetCSE) {
    elements.btnPresetCSE.addEventListener('click', () => loadTimetablePreset('cse'));
  }
  if (elements.btnPresetFirstYear) {
    elements.btnPresetFirstYear.addEventListener('click', () => loadTimetablePreset('first_year'));
  }

  if (elements.btnExportTimetable) {
    elements.btnExportTimetable.addEventListener('click', exportTimetableJson);
  }

  if (elements.btnImportTimetable && elements.importTimetableInput) {
    elements.btnImportTimetable.addEventListener('click', () => elements.importTimetableInput.click());
    elements.importTimetableInput.addEventListener('change', importTimetableJson);
  }

  // Coordinator Publish Handlers
  if (elements.btnPublish) {
    elements.btnPublish.addEventListener('click', handlePublish);
  }

  if (elements.btnCopyLink) {
    elements.btnCopyLink.addEventListener('click', handleCopyLink);
  }

  if (elements.btnToggleQr) {
    elements.btnToggleQr.addEventListener('click', handleToggleQr);
  }

  if (elements.btnViewQrPublished) {
    elements.btnViewQrPublished.addEventListener('click', handleViewPublishedQr);
  }
  if (elements.btnClosePublishedQr) {
    elements.btnClosePublishedQr.addEventListener('click', () => {
      if (elements.qrCodePublishedBox) elements.qrCodePublishedBox.classList.add('hidden');
    });
  }
  if (elements.btnCopyPublishedLink) {
    elements.btnCopyPublishedLink.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Notice link copied to clipboard!');
      });
    });
  }
}

// ------------------------------------------
// Drag and Drop
// ------------------------------------------
function setupDragAndDrop() {
  const dropZone = elements.dropZone;
  const overlay = elements.dropOverlay;
  if (!dropZone || !overlay) return;

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.remove('hidden');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.add('hidden');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        uploadPdfFile(file);
      } else {
        showError('Please drop a PDF notice file.');
      }
    }
  });
}

function updateCharCount() {
  if (elements.charCount && elements.noticeText) {
    const len = elements.noticeText.value.length;
    elements.charCount.textContent = `${len.toLocaleString()} characters`;
  }
}

// ==========================================
// Error & UI Feedback
// ==========================================
function showError(message) {
  if (elements.errorMessage && elements.errorBanner) {
    elements.errorMessage.textContent = message;
    elements.errorBanner.classList.remove('hidden');
    elements.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function hideError() {
  if (elements.errorBanner) {
    elements.errorBanner.classList.add('hidden');
  }
}

function setLoading(isLoading) {
  if (elements.loadingState) {
    elements.loadingState.classList.toggle('hidden', !isLoading);
  }
  if (elements.btnAnalyze) {
    elements.btnAnalyze.disabled = isLoading;
  }
}

// ==========================================
// Analyze & Extract API
// ==========================================
async function handleAnalyze() {
  hideError();
  const text = elements.noticeText ? elements.noticeText.value.trim() : '';
  if (!text) {
    showError('Please paste a notice first.');
    return;
  }

  state.originalText = elements.noticeText.value;
  setLoading(true);

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      showError(data.error || 'Failed to extract notice.');
      return;
    }

    if (data.warnings && data.warnings.length > 0) {
      showError(data.warnings.join(' '));
    }

    state.events = data.events || [];
    renderResults();
    triggerClashCheck();

    if (state.mode === 'coordinator' && elements.publishSection) {
      elements.publishSection.classList.remove('hidden');
    }
  } catch (err) {
    setLoading(false);
    showError('Network error while analyzing notice.');
  }
}

// ==========================================
// PDF Upload
// ==========================================
function handlePdfUpload(e) {
  const file = e.target.files ? e.target.files[0] : null;
  if (!file) return;
  uploadPdfFile(file);
}

async function uploadPdfFile(file) {
  hideError();
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showError('Please upload a PDF file.');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showError('File is too large. Maximum size is 5 MB.');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  setLoading(true);
  try {
    const res = await fetch('/api/extract-file', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setLoading(false);
    if (elements.pdfFileInput) elements.pdfFileInput.value = '';

    if (!res.ok) {
      showError(data.error || 'Failed to read PDF.');
      return;
    }

    if (elements.noticeText && data.text) {
      elements.noticeText.value = data.text;
      updateCharCount();
    }
    state.originalText = data.text || '';
    state.events = data.events || [];

    if (data.warnings && data.warnings.length > 0) {
      showError(data.warnings.join(' '));
    }

    renderResults();
    triggerClashCheck();
    showToast('PDF text extracted successfully!');

    if (state.mode === 'coordinator' && elements.publishSection) {
      elements.publishSection.classList.remove('hidden');
    }
  } catch (err) {
    setLoading(false);
    if (elements.pdfFileInput) elements.pdfFileInput.value = '';
    showError('Error uploading PDF file.');
  }
}

function handleClear() {
  if (elements.noticeText) elements.noticeText.value = '';
  updateCharCount();
  state.events = [];
  state.originalText = '';
  state.clashes = [];
  state.checks = [];
  state.acknowledgedClashes.clear();
  hideError();
  if (elements.resultsArea) elements.resultsArea.classList.add('hidden');
  if (elements.publishSection) elements.publishSection.classList.add('hidden');
}

// ==========================================
// Rendering Results
// ==========================================
function renderResults() {
  if (!elements.resultsArea) return;

  if (state.events.length === 0) {
    elements.resultsArea.classList.add('hidden');
    return;
  }

  elements.resultsArea.classList.remove('hidden');
  if (elements.eventCount) {
    elements.eventCount.textContent = state.events.length;
  }

  updateFilterTabCounts();
  renderHighlightedNotice();
  renderEventCards();
  validateExportButton();
}

function updateFilterTabCounts() {
  const counts = {
    all: state.events.length,
    test: state.events.filter((e) => e.type === 'test').length,
    deadline: state.events.filter((e) => e.type === 'deadline').length,
    lecture: state.events.filter((e) => e.type === 'lecture').length,
    holiday: state.events.filter((e) => e.type === 'holiday').length,
  };

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    const type = tab.dataset.filter;
    const count = counts[type] ?? 0;
    const label = type === 'all' ? 'All Events' : type.charAt(0).toUpperCase() + type.slice(1) + 's';
    tab.textContent = `${label} (${count})`;
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHighlightedNotice() {
  if (!elements.highlightedText) return;
  const text = state.originalText;
  if (!text) {
    if (elements.highlightedSection) elements.highlightedSection.classList.add('hidden');
    return;
  }
  if (elements.highlightedSection) elements.highlightedSection.classList.remove('hidden');

  // Collect all spans
  const spanList = [];
  state.events.forEach((evt) => {
    if (!evt.spans) return;
    for (const [field, range] of Object.entries(evt.spans)) {
      if (Array.isArray(range) && range.length === 2) {
        const [s, e] = range;
        if (s >= 0 && e <= text.length && e > s) {
          spanList.push({
            start: s,
            end: e,
            field,
            eventId: evt.id,
          });
        }
      }
    }
  });

  spanList.sort((a, b) => a.start - b.start || b.end - a.end);

  const nonOverlapping = [];
  let currentEnd = 0;
  for (const span of spanList) {
    if (span.start >= currentEnd) {
      nonOverlapping.push(span);
      currentEnd = span.end;
    }
  }

  let html = '';
  let cursor = 0;
  for (const span of nonOverlapping) {
    if (span.start > cursor) {
      html += escapeHtml(text.slice(cursor, span.start));
    }
    const spanText = escapeHtml(text.slice(span.start, span.end));
    html += `<mark class="highlight highlight-${span.field}" data-event-id="${span.eventId}">${spanText}</mark>`;
    cursor = span.end;
  }
  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }

  elements.highlightedText.innerHTML = html;
}

// ------------------------------------------
// Editable Event Cards
// ------------------------------------------
function renderEventCards() {
  if (!elements.eventCardsContainer) return;
  elements.eventCardsContainer.innerHTML = '';

  const isReadOnly = state.mode === 'published';

  // Filter events by activeFilter & searchQuery
  const filteredEvents = state.events.filter((evt) => {
    if (state.activeFilter !== 'all' && evt.type !== state.activeFilter) {
      return false;
    }
    if (state.searchQuery) {
      const q = state.searchQuery;
      const titleMatch = (evt.title || '').toLowerCase().includes(q);
      const venueMatch = (evt.venue || '').toLowerCase().includes(q);
      const typeMatch = (evt.type || '').toLowerCase().includes(q);
      if (!titleMatch && !venueMatch && !typeMatch) return false;
    }
    return true;
  });

  if (filteredEvents.length === 0) {
    elements.eventCardsContainer.innerHTML = `
      <div class="card" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <p>No events match your current filter or search criteria.</p>
      </div>
    `;
    return;
  }

  filteredEvents.forEach((evt) => {
    const card = document.createElement('div');
    card.className = `event-card card-type-${evt.type}`;
    card.dataset.eventId = evt.id;

    const isMissingTime = !evt.all_day && evt.type !== 'holiday' && !evt.start;

    const flagsHtml = (evt.flags || [])
      .map((f) => {
        const tooltip = FLAG_LABELS[f] || f;
        return `<span class="badge badge-flag" title="${tooltip}">${f}</span>`;
      })
      .join(' ');

    // Google Calendar Direct Link URL
    const gcalUrl = getGoogleCalendarUrl(evt);

    card.innerHTML = `
      <div class="event-card-header">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span class="badge badge-type-${evt.type}">${evt.type}</span>
          <span class="hint-text mono">#${evt.id}</span>
        </div>
        <div class="event-flags">${flagsHtml}</div>
      </div>
      <div class="event-form-grid">
        <div class="form-group">
          <label for="title_${evt.id}">Title</label>
          <input type="text" id="title_${evt.id}" class="form-control" value="${escapeHtml(evt.title || '')}" ${isReadOnly ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label for="type_${evt.id}">Type</label>
          <select id="type_${evt.id}" class="form-control" ${isReadOnly ? 'disabled' : ''}>
            <option value="test" ${evt.type === 'test' ? 'selected' : ''}>test</option>
            <option value="deadline" ${evt.type === 'deadline' ? 'selected' : ''}>deadline</option>
            <option value="lecture" ${evt.type === 'lecture' ? 'selected' : ''}>lecture</option>
            <option value="holiday" ${evt.type === 'holiday' ? 'selected' : ''}>holiday</option>
            <option value="other" ${evt.type === 'other' ? 'selected' : ''}>other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="date_${evt.id}">Date</label>
          <input type="date" id="date_${evt.id}" class="form-control" value="${evt.date || ''}" ${isReadOnly ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label for="start_${evt.id}">Start Time</label>
          <input type="time" id="start_${evt.id}" class="form-control ${isMissingTime ? 'input-error' : ''}" value="${evt.start || ''}" ${evt.all_day ? 'disabled' : ''} ${isReadOnly ? 'disabled' : ''}>
          ${isMissingTime ? '<span class="field-error-text">Required before export</span>' : ''}
        </div>
        <div class="form-group">
          <label for="end_${evt.id}">End Time</label>
          <input type="time" id="end_${evt.id}" class="form-control" value="${evt.end || ''}" ${(evt.all_day || evt.type === 'deadline') ? 'disabled' : ''} ${isReadOnly ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label for="venue_${evt.id}">Venue</label>
          <input type="text" id="venue_${evt.id}" class="form-control" value="${escapeHtml(evt.venue || '')}" placeholder="Room, hall, ground..." ${isReadOnly ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label class="all-day-checkbox">
            <input type="checkbox" id="allday_${evt.id}" ${evt.all_day ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
            All-Day
          </label>
        </div>
      </div>

      <!-- Action Buttons Row -->
      <div class="card-actions-bar">
        <div class="card-action-links">
          <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn-gcal" title="Add directly to your Google Calendar">
            <span>📅</span> Add to Google Calendar
          </a>
          <button type="button" class="btn btn-outline btn-card-action btn-single-ics" title="Download .ics for this event">
            <span>📥</span> .ics
          </button>
        </div>
        ${!isReadOnly ? `
          <button type="button" class="btn btn-card-action btn-delete-card" title="Remove event from list">
            <span>✕</span> Remove
          </button>
        ` : ''}
      </div>
    `;

    card.addEventListener('mouseenter', () => highlightMatchingMarks(evt.id, true));
    card.addEventListener('mouseleave', () => highlightMatchingMarks(evt.id, false));

    // Single ICS export handler
    const btnSingleIcs = card.querySelector('.btn-single-ics');
    if (btnSingleIcs) {
      btnSingleIcs.addEventListener('click', () => exportSingleEventIcs(evt));
    }

    // Delete Event handler
    const btnDelete = card.querySelector('.btn-delete-card');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        state.events = state.events.filter((e) => e.id !== evt.id);
        renderResults();
        triggerClashCheck();
        showToast('Event removed.');
      });
    }

    if (!isReadOnly) {
      bindCardInputs(card, evt);
    }

    elements.eventCardsContainer.appendChild(card);
  });
}

function getGoogleCalendarUrl(evt) {
  const title = encodeURIComponent(evt.title || 'College Event');
  const venue = encodeURIComponent(evt.venue || '');
  const details = encodeURIComponent(`Added via NoticeLens\nEvent Type: ${evt.type}\nVenue: ${evt.venue || 'Not specified'}`);

  if (evt.all_day || evt.type === 'holiday') {
    const dStr = (evt.date || '').replace(/-/g, '');
    // All day date range: YYYYMMDD/YYYYMMDD (next day)
    const nextDay = new Date(evt.date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextStr = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dStr}/${nextStr}&details=${details}&location=${venue}`;
  }

  const d = evt.date || new Date().toISOString().slice(0, 10);
  const st = evt.start || '09:00';
  let et = evt.end;
  if (!et) {
    // Default 1h later or 15m later for deadline
    if (evt.type === 'deadline') {
      const [h, m] = st.split(':').map(Number);
      const endM = m + 15;
      et = `${String(h + Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
    } else {
      const [h, m] = st.split(':').map(Number);
      et = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // Convert Indian Standard Time (UTC+5:30) to UTC ISO string
  const startLocal = new Date(`${d}T${st}:00+05:30`);
  const endLocal = new Date(`${d}T${et}:00+05:30`);

  const fmtUtc = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const startUtc = fmtUtc(startLocal);
  const endUtc = fmtUtc(endLocal);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startUtc}/${endUtc}&details=${details}&location=${venue}`;
}

async function exportSingleEventIcs(evt) {
  if (!evt.all_day && evt.type !== 'holiday' && !evt.start) {
    showError('Please add a start time to this event before exporting.');
    return;
  }

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [evt] }),
    });

    if (!res.ok) {
      showError('Failed to generate calendar file.');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(evt.title || 'event').replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Event .ics downloaded!');
  } catch (err) {
    showError('Error downloading event calendar.');
  }
}

function highlightMatchingMarks(eventId, isActive) {
  const marks = document.querySelectorAll(`mark[data-event-id="${eventId}"]`);
  marks.forEach((m) => {
    m.classList.toggle('highlight-active', isActive);
  });
}

function bindCardInputs(card, evt) {
  const titleInput = card.querySelector(`#title_${evt.id}`);
  const typeSelect = card.querySelector(`#type_${evt.id}`);
  const dateInput = card.querySelector(`#date_${evt.id}`);
  const startInput = card.querySelector(`#start_${evt.id}`);
  const endInput = card.querySelector(`#end_${evt.id}`);
  const venueInput = card.querySelector(`#venue_${evt.id}`);
  const allDayCheck = card.querySelector(`#allday_${evt.id}`);

  titleInput.addEventListener('input', () => {
    evt.title = titleInput.value;
  });

  typeSelect.addEventListener('change', () => {
    evt.type = typeSelect.value;
    if (evt.type === 'holiday') {
      evt.all_day = true;
      allDayCheck.checked = true;
      evt.start = null;
      evt.end = null;
    } else if (evt.type === 'deadline') {
      evt.end = null;
      evt.all_day = false;
      allDayCheck.checked = false;
    }
    card.className = `event-card card-type-${evt.type}`;
    validateExportButton();
    triggerClashCheck();
    renderTimeline();
  });

  dateInput.addEventListener('change', () => {
    evt.date = dateInput.value;
    triggerClashCheck();
    renderTimeline();
  });

  startInput.addEventListener('change', () => {
    evt.start = startInput.value;
    if (startInput.value) {
      evt.flags = (evt.flags || []).filter((f) => f !== 'missing_time');
      startInput.classList.remove('input-error');
    }
    validateExportButton();
    triggerClashCheck();
    renderTimeline();
  });

  endInput.addEventListener('change', () => {
    evt.end = endInput.value;
    triggerClashCheck();
    renderTimeline();
  });

  venueInput.addEventListener('input', () => {
    evt.venue = venueInput.value;
  });

  allDayCheck.addEventListener('change', () => {
    evt.all_day = allDayCheck.checked;
    if (evt.all_day) {
      startInput.disabled = true;
      endInput.disabled = true;
      startInput.value = '';
      endInput.value = '';
      evt.start = null;
      evt.end = null;
    } else {
      startInput.disabled = false;
      if (evt.type !== 'deadline') endInput.disabled = false;
    }
    validateExportButton();
    triggerClashCheck();
    renderTimeline();
  });
}

function validateExportButton() {
  if (!elements.btnExportIcs) return;

  const hasMissingTime = state.events.some(
    (e) => !e.all_day && e.type !== 'holiday' && !e.start
  );

  elements.btnExportIcs.disabled = hasMissingTime;
  if (elements.exportDisabledHint) {
    elements.exportDisabledHint.classList.toggle('hidden', !hasMissingTime);
  }
}

// ==========================================
// Add Custom Event Modal
// ==========================================
function handleAddCustomEvent(e) {
  e.preventDefault();
  const title = document.getElementById('modalEventTitle').value.trim();
  const type = document.getElementById('modalEventType').value;
  const date = document.getElementById('modalEventDate').value;
  const start = document.getElementById('modalEventStart').value || null;
  const end = document.getElementById('modalEventEnd').value || null;
  const venue = document.getElementById('modalEventVenue').value.trim();

  if (!title || !date) {
    showError('Title and Date are required.');
    return;
  }

  const newId = `evt_custom_${Date.now()}`;
  const newEvt = {
    id: newId,
    title,
    type,
    date,
    start: type === 'holiday' ? null : start,
    end: (type === 'holiday' || type === 'deadline') ? null : end,
    all_day: type === 'holiday',
    venue,
    flags: [],
  };

  state.events.push(newEvt);
  renderResults();
  triggerClashCheck();
  if (elements.addEventDialog) elements.addEventDialog.close();
  elements.addEventForm.reset();
  showToast(`Added "${title}" to notice events!`);
}

// ==========================================
// Copy for WhatsApp Format
// ==========================================
function handleCopyWhatsApp() {
  if (state.events.length === 0) {
    showError('No events to copy.');
    return;
  }

  let text = `📢 *COLLEGE NOTICE SUMMARY*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  state.events.forEach((evt, idx) => {
    const icon = evt.type === 'test' ? '📝' : evt.type === 'deadline' ? '⚠️' : evt.type === 'holiday' ? '🎉' : '🎙️';
    text += `${icon} *${evt.title}*\n`;
    text += `   🗓️ Date: ${evt.date}\n`;
    if (evt.all_day || evt.type === 'holiday') {
      text += `   ⏰ Time: All-Day\n`;
    } else if (evt.start && evt.end) {
      text += `   ⏰ Time: ${evt.start} - ${evt.end}\n`;
    } else if (evt.start) {
      text += `   ⏰ Time: ${evt.start} (${evt.type === 'deadline' ? 'Deadline' : 'Start'})\n`;
    }
    if (evt.venue) {
      text += `   📍 Venue: ${evt.venue}\n`;
    }
    text += `\n`;
  });

  const activeClashes = state.clashes.filter((c) => !state.acknowledgedClashes.has(c.a_id + '_' + c.b_id));
  if (activeClashes.length > 0) {
    text += `⚠️ *SCHEDULE CLASH ALERTS (${activeClashes.length}):*\n`;
    activeClashes.forEach((c) => {
      text += `   • ${c.message} (${c.action})\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Generated via NoticeLens · Verified Rule Engine\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Summary copied! Ready to paste into WhatsApp groups.');
  });
}

// ==========================================
// Clash Engine & Timeline
// ==========================================
function triggerClashCheck() {
  clearTimeout(state.clashDebounceTimer);
  state.clashDebounceTimer = setTimeout(runClashCheck, 150);
}

async function runClashCheck() {
  if (state.events.length === 0) return;

  try {
    const res = await fetch('/api/clashes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: state.events,
        timetable: state.timetable,
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    state.clashes = data.clashes || [];
    state.checks = data.checks || [];
    state.skipped = data.skipped || [];

    renderClashes();
    renderTimeline();
  } catch (err) {
    console.error('Error during clash check:', err);
  }
}

function renderClashes() {
  if (!elements.clashTableBody || !elements.clashSummaryText || !elements.clashBadgeBox) return;

  const totalChecks = state.checks.length;
  // Filter out acknowledged clashes
  const activeClashes = state.clashes.filter((c) => !state.acknowledgedClashes.has(c.a_id + '_' + c.b_id));
  const clashCount = activeClashes.length;

  if (clashCount === 0) {
    elements.clashBadgeBox.className = 'clash-summary-box clash-clean';
    elements.clashSummaryText.textContent = totalChecks > 0 ? `✓ All clear (${totalChecks} comparisons checked)` : 'No clashes detected';
  } else {
    elements.clashBadgeBox.className = 'clash-summary-box clash-warning';
    elements.clashSummaryText.textContent = `⚠️ ${clashCount} schedule clash${clashCount > 1 ? 'es' : ''} detected`;
  }

  elements.clashTableBody.innerHTML = '';

  if (totalChecks === 0) {
    elements.clashTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="hint-text" style="text-align: center; padding: 1.5rem;">
          No events to compare. Events with missing times are skipped.
        </td>
      </tr>
    `;
    return;
  }

  state.checks.forEach((chk) => {
    const isAcknowledged = state.acknowledgedClashes.has(chk.a_id + '_' + chk.b_id);
    const tr = document.createElement('tr');
    tr.className = chk.clash && !isAcknowledged ? 'clash-row-active' : 'clash-row-ok';

    let statusHtml = '<span class="status-clean">✓ No Clash</span>';
    if (chk.clash) {
      statusHtml = isAcknowledged
        ? '<span class="badge" style="background: var(--bg-main); color: var(--text-muted);">Acknowledged</span>'
        : `<span class="status-clash">⚠️ ${chk.kind.toUpperCase()}</span>`;
    }

    // Quick action buttons for clashes
    let actionButtons = '';
    if (chk.clash && !isAcknowledged) {
      actionButtons = `
        <div class="clash-actions-cell">
          <button type="button" class="btn-clash-action" data-action="shift30" data-aid="${chk.a_id}" data-bid="${chk.b_id}">+30m Shift</button>
          <button type="button" class="btn-clash-action" data-action="shift60" data-aid="${chk.a_id}" data-bid="${chk.b_id}">+1h Shift</button>
          <button type="button" class="btn-clash-action" data-action="ack" data-aid="${chk.a_id}" data-bid="${chk.b_id}">Acknowledge</button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(chk.a_title)}</strong>
        <span class="vs-text">vs</span>
        <strong>${escapeHtml(chk.b_title)}</strong>
      </td>
      <td>${statusHtml}</td>
      <td>
        <div class="clash-message">${escapeHtml(chk.message || '')}</div>
        ${chk.action ? `<div class="clash-suggested-action">👉 ${escapeHtml(chk.action)}</div>` : ''}
        ${actionButtons}
      </td>
    `;

    // Bind clash quick action buttons
    tr.querySelectorAll('.btn-clash-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const aid = e.target.dataset.aid;
        const bid = e.target.dataset.bid;
        handleClashAction(action, aid, bid);
      });
    });

    elements.clashTableBody.appendChild(tr);
  });
}

function handleClashAction(action, aid, bid) {
  if (action === 'ack') {
    state.acknowledgedClashes.add(aid + '_' + bid);
    renderClashes();
    showToast('Clash marked as acknowledged.');
    return;
  }

  // Shift event B (or A if B is a timetable class)
  const minutesToAdd = action === 'shift30' ? 30 : 60;
  let targetEvt = state.events.find((e) => e.id === bid);
  if (!targetEvt || !targetEvt.start) {
    targetEvt = state.events.find((e) => e.id === aid);
  }

  if (targetEvt && targetEvt.start) {
    const shiftTime = (t, mins) => {
      const [h, m] = t.split(':').map(Number);
      const total = h * 60 + m + mins;
      const newH = Math.floor(total / 60) % 24;
      const newM = total % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    };

    targetEvt.start = shiftTime(targetEvt.start, minutesToAdd);
    if (targetEvt.end) {
      targetEvt.end = shiftTime(targetEvt.end, minutesToAdd);
    }
    renderResults();
    triggerClashCheck();
    showToast(`Shifted "${targetEvt.title}" by +${minutesToAdd}m!`);
  }
}

// ------------------------------------------
// Visual Timeline (P10)
// ------------------------------------------
function renderTimeline() {
  if (!elements.timelineContainer) return;
  elements.timelineContainer.innerHTML = '';

  const dateMap = new Map();
  state.events.forEach((evt) => {
    if (!evt.date) return;
    if (!dateMap.has(evt.date)) dateMap.set(evt.date, []);
    dateMap.get(evt.date).push(evt);
  });

  if (dateMap.size === 0) {
    elements.timelineContainer.innerHTML = '<span class="hint-text">No dated events to display on timeline.</span>';
    return;
  }

  const sortedDates = Array.from(dateMap.keys()).sort();

  for (const dateStr of sortedDates) {
    const evts = dateMap.get(dateStr);
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    // Group header
    const groupDiv = document.createElement('div');
    groupDiv.className = 'timeline-date-group';
    groupDiv.innerHTML = `
      <div class="timeline-date-label">
        <span class="day-name">${dayOfWeek}</span>
        <span class="date-val">${dateStr}</span>
      </div>
    `;

    // Timetable slots for this day of week
    const daySlots = state.timetable.filter((s) => s.day.toLowerCase() === dayOfWeek.toLowerCase());

    const timedEvts = evts.filter((e) => !e.all_day && e.type !== 'holiday' && e.start);
    const holidayEvts = evts.filter((e) => e.all_day || e.type === 'holiday');

    if (holidayEvts.length > 0) {
      holidayEvts.forEach((h) => {
        const hBadge = document.createElement('div');
        hBadge.className = 'timeline-holiday-banner';
        hBadge.innerHTML = `🏖️ All-Day Holiday: <strong>${escapeHtml(h.title)}</strong>`;
        groupDiv.appendChild(hBadge);
      });
    }

    if (timedEvts.length === 0 && daySlots.length === 0) {
      groupDiv.innerHTML += '<p class="hint-text" style="font-size: 0.8rem; padding: 0.5rem 0;">No timed slots on this day.</p>';
      elements.timelineContainer.appendChild(groupDiv);
      continue;
    }

    const svgWidth = 840;
    const startHour = 8;
    const endHour = 20;
    const totalMinutes = (endHour - startHour) * 60;
    const rowHeight = 30;
    const totalRows = daySlots.length + timedEvts.length;
    const svgHeight = 45 + Math.max(1, totalRows) * rowHeight;

    const timeToX = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      const minutesFrom8 = (h - startHour) * 60 + m;
      const clamped = Math.max(0, Math.min(totalMinutes, minutesFrom8));
      return 60 + (clamped / totalMinutes) * (svgWidth - 80);
    };

    let svgInner = '';

    // Draw Hour Grid lines & numbers
    for (let h = startHour; h <= endHour; h++) {
      const x = 60 + ((h - startHour) * 60 / totalMinutes) * (svgWidth - 80);
      svgInner += `
        <line x1="${x}" y1="25" x2="${x}" y2="${svgHeight - 10}" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="2,2"/>
        <text x="${x}" y="18" font-size="10" fill="var(--text-muted)" text-anchor="middle" font-family="monospace">${h}:00</text>
      `;
    }

    let currentRow = 0;

    // Draw Timetable Slots (Grey bars)
    daySlots.forEach((slot) => {
      const x1 = timeToX(slot.start);
      const x2 = timeToX(slot.end);
      const width = Math.max(10, x2 - x1);
      const y = 35 + currentRow * rowHeight;

      svgInner += `
        <rect x="${x1}" y="${y}" width="${width}" height="22" rx="4" fill="#94a3b8" opacity="0.85"/>
        <text x="${x1 + 6}" y="${y + 15}" font-size="10.5" fill="#ffffff" font-weight="600" font-family="sans-serif">${escapeHtml(slot.subject)} (${slot.start}-${slot.end})</text>
      `;
      currentRow++;
    });

    // Draw Timed Events
    timedEvts.forEach((evt) => {
      const y = 35 + currentRow * rowHeight;

      if (evt.type === 'deadline') {
        const x = timeToX(evt.start);
        svgInner += `
          <line x1="${x}" y1="20" x2="${x}" y2="${svgHeight - 10}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,3"/>
          <polygon points="${x},${y} ${x + 7},${y + 11} ${x},${y + 22} ${x - 7},${y + 11}" fill="#dc2626"/>
          <text x="${x + 12}" y="${y + 15}" font-size="11" fill="#dc2626" font-weight="700" font-family="sans-serif">DEADLINE: ${escapeHtml(evt.title)} (${evt.start})</text>
        `;
      } else {
        const x1 = timeToX(evt.start);
        const x2 = timeToX(evt.end || evt.start);
        const width = Math.max(14, x2 - x1);

        let barColor = '#2563eb';
        if (evt.type === 'test') barColor = '#7c3aed';
        else if (evt.type === 'lecture') barColor = '#0284c7';

        svgInner += `
          <rect x="${x1}" y="${y}" width="${width}" height="22" rx="4" fill="${barColor}" opacity="0.9"/>
          <text x="${x1 + 6}" y="${y + 15}" font-size="10.5" fill="#ffffff" font-weight="600" font-family="sans-serif">${escapeHtml(evt.title)} (${evt.start}-${evt.end})</text>
        `;
      }
      currentRow++;
    });

    // Draw Red Overlap Shading
    state.clashes
      .filter((c) => c.kind === 'overlap' && c.minutes > 0)
      .forEach((c) => {
        const evtA = state.events.find((e) => e.id === c.a_id);
        const evtB = state.events.find((e) => e.id === c.b_id);
        if (evtA && evtB && evtA.date === dateStr && evtA.start && evtA.end && evtB.start && evtB.end) {
          const overlapStart = evtA.start > evtB.start ? evtA.start : evtB.start;
          const overlapEnd = evtA.end < evtB.end ? evtA.end : evtB.end;
          if (overlapStart < overlapEnd) {
            const ox1 = timeToX(overlapStart);
            const ox2 = timeToX(overlapEnd);
            svgInner += `
              <rect x="${ox1}" y="25" width="${ox2 - ox1}" height="${svgHeight - 35}" fill="#ef4444" opacity="0.18" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2"/>
            `;
          }
        }
      });

    const svg = `
      <svg class="timeline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMinYMin meet" aria-label="Schedule timeline">
        ${svgInner}
      </svg>
    `;

    groupDiv.innerHTML += svg;
    elements.timelineContainer.appendChild(groupDiv);
  }
}

// ==========================================
// ICS Export All
// ==========================================
async function handleExportIcs() {
  hideError();
  const hasMissingTime = state.events.some(
    (e) => !e.all_day && e.type !== 'holiday' && !e.start
  );

  if (hasMissingTime) {
    showError('Some events are missing a time. Please add start times before exporting.');
    return;
  }

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: state.events }),
    });

    if (!res.ok) {
      const data = await res.json();
      showError(data.error || 'Failed to export .ics calendar file.');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notices.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Exported notices.ics calendar!');
  } catch (err) {
    showError('Error downloading calendar file.');
  }
}

// ==========================================
// Weekly Timetable Panel
// ==========================================
function loadTimetable() {
  try {
    const stored = localStorage.getItem('noticelens_timetable');
    if (stored) {
      state.timetable = JSON.parse(stored);
    } else {
      state.timetable = [{ day: 'Fri', start: '10:30', end: '11:30', subject: 'DBMS' }];
      saveTimetable();
    }
  } catch {
    state.timetable = [];
  }
}

function saveTimetable() {
  localStorage.setItem('noticelens_timetable', JSON.stringify(state.timetable));
}

function loadTimetablePreset(type) {
  if (type === 'cse') {
    state.timetable = [
      { day: 'Mon', start: '09:00', end: '10:00', subject: 'Data Structures' },
      { day: 'Tue', start: '10:30', end: '12:00', subject: 'Operating Systems' },
      { day: 'Wed', start: '09:00', end: '11:00', subject: 'Compiler Design Lab' },
      { day: 'Thu', start: '11:00', end: '12:30', subject: 'Computer Networks' },
      { day: 'Fri', start: '10:30', end: '11:30', subject: 'DBMS' },
      { day: 'Fri', start: '14:00', end: '16:00', subject: 'DBMS Laboratory' },
    ];
    showToast('Loaded CSE 3rd Year schedule!');
  } else if (type === 'first_year') {
    state.timetable = [
      { day: 'Mon', start: '09:00', end: '10:30', subject: 'Engineering Math III' },
      { day: 'Tue', start: '11:00', end: '12:30', subject: 'Applied Physics' },
      { day: 'Wed', start: '10:00', end: '11:30', subject: 'Basic Electronics' },
      { day: 'Thu', start: '09:00', end: '12:00', subject: 'Physics Laboratory' },
      { day: 'Fri', start: '10:00', end: '11:30', subject: 'Engineering Graphics' },
    ];
    showToast('Loaded 1st Year Core schedule!');
  }
  saveTimetable();
  renderTimetableSlots();
  triggerClashCheck();
}

function exportTimetableJson() {
  const jsonStr = JSON.stringify(state.timetable, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my_college_timetable.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Timetable exported as JSON.');
}

function importTimetableJson(e) {
  const file = e.target.files ? e.target.files[0] : null;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (Array.isArray(parsed)) {
        state.timetable = parsed;
        saveTimetable();
        renderTimetableSlots();
        triggerClashCheck();
        showToast('Timetable imported successfully!');
      } else {
        showError('Invalid timetable JSON file.');
      }
    } catch {
      showError('Could not parse timetable JSON.');
    }
    if (elements.importTimetableInput) elements.importTimetableInput.value = '';
  };
  reader.readAsText(file);
}

function handleAddTimetableSlot(e) {
  e.preventDefault();
  if (elements.timetableFormError) elements.timetableFormError.classList.add('hidden');

  const day = elements.slotDay.value;
  const start = elements.slotStart.value;
  const end = elements.slotEnd.value;
  const subject = elements.slotSubject.value.trim();

  if (!subject) {
    showTimetableError('Subject name is required.');
    return;
  }
  if (!start || !end) {
    showTimetableError('Both start and end times are required.');
    return;
  }
  if (end <= start) {
    showTimetableError('End time must be after start time.');
    return;
  }

  state.timetable.push({ day, start, end, subject });
  saveTimetable();
  renderTimetableSlots();
  triggerClashCheck();

  elements.slotSubject.value = '';
  showToast(`Added ${subject} (${day} ${start}-${end})`);
}

function showTimetableError(msg) {
  if (elements.timetableFormError) {
    elements.timetableFormError.textContent = msg;
    elements.timetableFormError.classList.remove('hidden');
  }
}

function renderTimetableSlots() {
  if (!elements.timetableSlotsList) return;
  elements.timetableSlotsList.innerHTML = '';

  if (state.timetable.length === 0) {
    elements.timetableSlotsList.innerHTML = '<span class="hint-text">No recurring classes added yet. Use the presets above or add your classes below.</span>';
    return;
  }

  state.timetable.forEach((slot, idx) => {
    const chip = document.createElement('div');
    chip.className = 'timetable-slot-chip';
    chip.innerHTML = `
      <span class="slot-day">${escapeHtml(slot.day)}</span>
      <span class="slot-time">${slot.start} - ${slot.end}</span>
      <span class="slot-subject">${escapeHtml(slot.subject)}</span>
      <button type="button" class="slot-delete-btn" title="Delete slot" aria-label="Delete ${escapeHtml(slot.subject)}">&times;</button>
    `;

    chip.querySelector('.slot-delete-btn').addEventListener('click', () => {
      state.timetable.splice(idx, 1);
      saveTimetable();
      renderTimetableSlots();
      triggerClashCheck();
    });

    elements.timetableSlotsList.appendChild(chip);
  });
}

function handleClearTimetable() {
  state.timetable = [];
  saveTimetable();
  renderTimetableSlots();
  triggerClashCheck();
  showToast('Timetable cleared.');
}

// ==========================================
// Coordinator Publish & QR Code Flow
// ==========================================
async function handlePublish() {
  hideError();
  const title = elements.publishTitle ? elements.publishTitle.value.trim() : '';
  if (!title) {
    showError('Please provide a notice title before publishing.');
    return;
  }
  if (state.events.length === 0) {
    showError('Please analyze and review at least one event before publishing.');
    return;
  }

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        text: state.originalText,
        events: state.events,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Failed to publish notice.');
      return;
    }

    if (elements.publishedShareBox && elements.shareUrlInput) {
      const fullUrl = window.location.origin + data.url;
      elements.shareUrlInput.value = fullUrl;
      elements.publishedShareBox.classList.remove('hidden');
      loadQrCodeInto(fullUrl, elements.qrSvgHolder);
      showToast('Circular published! Link & QR code generated.');
    }
  } catch (err) {
    showError('Network error while publishing notice.');
  }
}

function handleCopyLink() {
  if (elements.shareUrlInput) {
    elements.shareUrlInput.select();
    navigator.clipboard.writeText(elements.shareUrlInput.value).then(() => {
      if (elements.copyFeedback) {
        elements.copyFeedback.classList.remove('hidden');
        setTimeout(() => elements.copyFeedback.classList.add('hidden'), 2500);
      }
      showToast('Link copied to clipboard!');
    });
  }
}

function handleToggleQr() {
  if (elements.qrCodeContainer) {
    elements.qrCodeContainer.classList.toggle('hidden');
  }
}

function handleViewPublishedQr() {
  if (!elements.qrCodePublishedBox) return;
  elements.qrCodePublishedBox.classList.remove('hidden');
  loadQrCodeInto(window.location.href, elements.qrPublishedSvg);
}

async function loadQrCodeInto(url, container) {
  if (!container) return;
  container.innerHTML = '<span class="hint-text">Generating QR code...</span>';
  try {
    const res = await fetch(`/api/qrcode?text=${encodeURIComponent(url)}`);
    if (res.ok) {
      const svgText = await res.text();
      container.innerHTML = svgText;
    } else {
      container.innerHTML = '<span class="hint-text text-danger">Failed to generate QR code.</span>';
    }
  } catch {
    container.innerHTML = '<span class="hint-text text-danger">Failed to connect to QR service.</span>';
  }
}
