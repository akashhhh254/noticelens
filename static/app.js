/**
 * NoticeLens Frontend Application
 * Plain JavaScript (ES6+), Mobile-first, Rule-based.
 */

// Notice A example text (exact character matching for P1/P7)
const NOTICE_A_TEXT = `All III-year CSE students: Internal Test 2 will be held on 13 Nov 2026 from 10:00 AM to 11:30 AM in Room 204. Lab records must be submitted to the department office by 12:00 noon on 13 Nov. A guest lecture on “AI in Healthcare” is scheduled on 13 Nov, 11:00 AM to 12:30 PM, Seminar Hall.`;

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
  clashDebounceTimer: null,
};

// DOM Elements
const elements = {
  errorBanner: document.getElementById('errorBanner'),
  errorMessage: document.getElementById('errorMessage'),
  closeBanner: document.getElementById('closeBanner'),
  noticeText: document.getElementById('noticeText'),
  btnAnalyze: document.getElementById('btnAnalyze'),
  btnLoadExample: document.getElementById('btnLoadExample'),
  btnClear: document.getElementById('btnClear'),
  btnUploadPdf: document.getElementById('btnUploadPdf'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  loadingState: document.getElementById('loadingState'),
  resultsArea: document.getElementById('resultsArea'),
  eventCount: document.getElementById('eventCount'),
  highlightedSection: document.getElementById('highlightedSection'),
  highlightedText: document.getElementById('highlightedText'),
  eventCardsContainer: document.getElementById('eventCardsContainer'),
  clashBadgeBox: document.getElementById('clashBadgeBox'),
  clashSummaryText: document.getElementById('clashSummaryText'),
  clashTableBody: document.getElementById('clashTableBody'),
  timelineContainer: document.getElementById('timelineContainer'),
  btnExportIcs: document.getElementById('btnExportIcs'),
  exportDisabledHint: document.getElementById('exportDisabledHint'),
  publishSection: document.getElementById('publishSection'),
  publishTitle: document.getElementById('publishTitle'),
  btnPublish: document.getElementById('btnPublish'),
  publishedShareBox: document.getElementById('publishedShareBox'),
  shareUrlInput: document.getElementById('shareUrlInput'),
  btnCopyLink: document.getElementById('btnCopyLink'),
  copyFeedback: document.getElementById('copyFeedback'),
  timetableForm: document.getElementById('timetableForm'),
  slotDay: document.getElementById('slotDay'),
  slotStart: document.getElementById('slotStart'),
  slotEnd: document.getElementById('slotEnd'),
  slotSubject: document.getElementById('slotSubject'),
  timetableFormError: document.getElementById('timetableFormError'),
  timetableSlotsList: document.getElementById('timetableSlotsList'),
  btnClearTimetable: document.getElementById('btnClearTimetable'),
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
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
// Event Listeners
// ==========================================
function setupEventListeners() {
  if (elements.closeBanner) {
    elements.closeBanner.addEventListener('click', hideError);
  }

  if (elements.btnAnalyze) {
    elements.btnAnalyze.addEventListener('click', handleAnalyze);
  }

  if (elements.btnLoadExample) {
    elements.btnLoadExample.addEventListener('click', () => {
      if (elements.noticeText) {
        elements.noticeText.value = NOTICE_A_TEXT;
        hideError();
      }
    });
  }

  if (elements.btnClear) {
    elements.btnClear.addEventListener('click', handleClear);
  }

  if (elements.btnUploadPdf && elements.pdfFileInput) {
    elements.btnUploadPdf.addEventListener('click', () => {
      elements.pdfFileInput.click();
    });
    elements.pdfFileInput.addEventListener('change', handlePdfUpload);
  }

  if (elements.btnExportIcs) {
    elements.btnExportIcs.addEventListener('click', handleExportIcs);
  }

  if (elements.timetableForm) {
    elements.timetableForm.addEventListener('submit', handleAddTimetableSlot);
  }

  if (elements.btnClearTimetable) {
    elements.btnClearTimetable.addEventListener('click', handleClearTimetable);
  }

  if (elements.btnPublish) {
    elements.btnPublish.addEventListener('click', handlePublish);
  }

  if (elements.btnCopyLink) {
    elements.btnCopyLink.addEventListener('click', handleCopyLink);
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
    showError('Network error while processing notice.');
  }
}

async function handlePdfUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  hideError();
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
    elements.pdfFileInput.value = '';

    if (!res.ok) {
      showError(data.error || 'Failed to upload PDF.');
      return;
    }

    if (elements.noticeText && data.text) {
      elements.noticeText.value = data.text;
    }
    state.originalText = data.text || '';
    state.events = data.events || [];

    if (data.warnings && data.warnings.length > 0) {
      showError(data.warnings.join(' '));
    }

    renderResults();
    triggerClashCheck();

    if (state.mode === 'coordinator' && elements.publishSection) {
      elements.publishSection.classList.remove('hidden');
    }
  } catch (err) {
    setLoading(false);
    elements.pdfFileInput.value = '';
    showError('Error uploading PDF file.');
  }
}

function handleClear() {
  if (elements.noticeText) elements.noticeText.value = '';
  state.events = [];
  state.originalText = '';
  state.clashes = [];
  state.checks = [];
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

  renderHighlightedNotice();
  renderEventCards();
  validateExportButton();
}

// ------------------------------------------
// Non-breaking Source Highlights (P8)
// ------------------------------------------
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

  // Sort by start offset
  spanList.sort((a, b) => a.start - b.start || b.end - a.end);

  // Filter overlapping spans: keep the first, skip the rest
  const nonOverlapping = [];
  let currentEnd = 0;
  for (const span of spanList) {
    if (span.start >= currentEnd) {
      nonOverlapping.push(span);
      currentEnd = span.end;
    }
  }

  // Build highlighted HTML
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
// Editable Event Cards (P8)
// ------------------------------------------
function renderEventCards() {
  if (!elements.eventCardsContainer) return;
  elements.eventCardsContainer.innerHTML = '';

  const isReadOnly = state.mode === 'published';

  state.events.forEach((evt, idx) => {
    const card = document.createElement('div');
    card.className = `event-card card-type-${evt.type}`;
    card.dataset.eventId = evt.id;

    // Check if missing required start time
    const isMissingTime = !evt.all_day && evt.type !== 'holiday' && !evt.start;

    // Build flags badges
    const flagsHtml = (evt.flags || [])
      .map((f) => {
        const tooltip = FLAG_LABELS[f] || f;
        return `<span class="badge badge-flag" title="${tooltip}">${f}</span>`;
      })
      .join(' ');

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
    `;

    // Interactivity: card hover highlights matching phrases in original text
    card.addEventListener('mouseenter', () => highlightMatchingMarks(evt.id, true));
    card.addEventListener('mouseleave', () => highlightMatchingMarks(evt.id, false));

    if (!isReadOnly) {
      bindCardInputs(card, evt, idx);
    }

    elements.eventCardsContainer.appendChild(card);
  });
}

function highlightMatchingMarks(eventId, isActive) {
  const marks = document.querySelectorAll(`mark[data-event-id="${eventId}"]`);
  marks.forEach((m) => {
    m.classList.toggle('highlight-active', isActive);
  });
}

function bindCardInputs(card, evt, idx) {
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
    // Remove unknown_type flag if manually set
    evt.flags = (evt.flags || []).filter((f) => f !== 'unknown_type');
    renderEventCards();
    triggerClashCheck();
  });

  dateInput.addEventListener('change', () => {
    evt.date = dateInput.value;
    // Remove ambiguous_date flag on manual edit
    evt.flags = (evt.flags || []).filter((f) => f !== 'ambiguous_date' && f !== 'no_year');
    triggerClashCheck();
  });

  startInput.addEventListener('change', () => {
    evt.start = startInput.value || null;
    if (evt.start) {
      evt.flags = (evt.flags || []).filter((f) => f !== 'missing_time' && f !== 'no_ampm');
      if (evt.type === 'test' || evt.type === 'lecture') {
        if (!evt.end) {
          // Assume 60 min if end empty
          const [h, m] = evt.start.split(':').map(Number);
          const endH = (h + 1) % 24;
          evt.end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          evt.flags = [...new Set([...(evt.flags || []), 'assumed_end'])];
        }
      }
    }
    renderEventCards();
    validateExportButton();
    triggerClashCheck();
  });

  endInput.addEventListener('change', () => {
    evt.end = endInput.value || null;
    if (evt.end) {
      evt.flags = (evt.flags || []).filter((f) => f !== 'assumed_end');
    }
    triggerClashCheck();
  });

  venueInput.addEventListener('input', () => {
    evt.venue = venueInput.value;
    if (evt.venue.trim()) {
      evt.flags = (evt.flags || []).filter((f) => f !== 'no_venue');
    }
  });

  allDayCheck.addEventListener('change', () => {
    evt.all_day = allDayCheck.checked;
    if (evt.all_day) {
      evt.start = null;
      evt.end = null;
    }
    renderEventCards();
    validateExportButton();
    triggerClashCheck();
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
// Clash Detection & Timeline (P9)
// ==========================================
function triggerClashCheck() {
  if (state.clashDebounceTimer) {
    clearTimeout(state.clashDebounceTimer);
  }
  state.clashDebounceTimer = setTimeout(fetchClashes, 300);
}

async function fetchClashes() {
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
    console.error('Failed to calculate schedule clashes:', err);
  }
}

function renderClashes() {
  const clashCount = state.clashes.length;

  if (elements.clashBadgeBox && elements.clashSummaryText) {
    if (clashCount > 0) {
      elements.clashBadgeBox.className = 'clash-summary-box clash-found';
      elements.clashSummaryText.textContent = `${clashCount} clash${clashCount === 1 ? '' : 'es'} found`;
    } else {
      elements.clashBadgeBox.className = 'clash-summary-box no-clashes';
      elements.clashSummaryText.textContent = 'No clashes';
    }
  }

  if (!elements.clashTableBody) return;
  elements.clashTableBody.innerHTML = '';

  state.checks.forEach((chk) => {
    const row = document.createElement('tr');
    row.className = chk.clash ? 'clash-row-clash' : 'clash-row-clear';

    const statusBadge = chk.clash
      ? `<span class="badge badge-clash">Clash</span>`
      : `<span class="badge badge-clear">No clash</span>`;

    const actionText = chk.action
      ? `<span class="clash-action">Action: ${escapeHtml(chk.action)}</span>`
      : '';

    row.innerHTML = `
      <td><strong>${escapeHtml(chk.a_title || 'Event')}</strong> vs <strong>${escapeHtml(chk.b_title || 'Event')}</strong></td>
      <td>${statusBadge}</td>
      <td>
        <div>${escapeHtml(chk.message || '')}</div>
        ${actionText}
      </td>
    `;
    elements.clashTableBody.appendChild(row);
  });
}

function renderTimeline() {
  if (!elements.timelineContainer) return;
  elements.timelineContainer.innerHTML = '';

  // Group events by date
  const dateGroups = {};
  state.events.forEach((evt) => {
    const d = evt.date || 'Unknown';
    if (!dateGroups[d]) dateGroups[d] = [];
    dateGroups[d].push(evt);
  });

  // Render timeline card per date
  for (const [dateStr, evts] of Object.entries(dateGroups)) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'timeline-day-group';

    // Format header
    let dayOfWeek = '';
    try {
      const dt = new Date(dateStr + 'T00:00:00');
      dayOfWeek = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      dayOfWeek = dateStr;
    }

    groupDiv.innerHTML = `<div class="timeline-date-title">${dayOfWeek}</div>`;

    // Check if any holiday on this date
    const holiday = evts.find((e) => e.all_day || e.type === 'holiday');
    if (holiday) {
      groupDiv.innerHTML += `
        <div class="timeline-holiday-banner">
          🏖️ College Closed / Holiday: ${escapeHtml(holiday.title || 'Holiday')} (All Day)
        </div>
      `;
      elements.timelineContainer.appendChild(groupDiv);
      continue;
    }

    // Filter relevant timetable slots for this weekday
    const day3 = dayOfWeek.slice(0, 3);
    const daySlots = state.timetable.filter((s) => (s.day || '').slice(0, 3) === day3);

    // SVG Timeline parameters
    const svgWidth = 600;
    const startHour = 8; // 08:00
    const endHour = 20;  // 20:00
    const totalMinutes = (endHour - startHour) * 60;

    const timeToX = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      const minutesFromStart = (h - startHour) * 60 + m;
      const clamped = Math.max(0, Math.min(totalMinutes, minutesFromStart));
      return (clamped / totalMinutes) * (svgWidth - 60) + 40;
    };

    // Calculate height based on number of items
    const timedEvts = evts.filter((e) => e.start);
    const rowHeight = 36;
    const totalRows = timedEvts.length + daySlots.length;
    const svgHeight = Math.max(100, 50 + totalRows * rowHeight);

    let svgInner = '';

    // Draw background time axis ticks
    for (let h = startHour; h <= endHour; h += 2) {
      const x = timeToX(`${String(h).padStart(2, '0')}:00`);
      svgInner += `
        <line x1="${x}" y1="25" x2="${x}" y2="${svgHeight - 10}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2"/>
        <text x="${x}" y="18" font-size="10" fill="#64748b" text-anchor="middle" font-family="monospace">${h}:00</text>
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
        // Deadline point: vertical dashed line + diamond marker
        const x = timeToX(evt.start);
        svgInner += `
          <line x1="${x}" y1="20" x2="${x}" y2="${svgHeight - 10}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,3"/>
          <polygon points="${x},${y} ${x + 7},${y + 11} ${x},${y + 22} ${x - 7},${y + 11}" fill="#dc2626"/>
          <text x="${x + 12}" y="${y + 15}" font-size="11" fill="#dc2626" font-weight="700" font-family="sans-serif">DEADLINE: ${escapeHtml(evt.title)} (${evt.start})</text>
        `;
      } else {
        // Event interval bar
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

    // Draw Red Overlap Shading for overlapping pairs on this date
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
// ICS Export (P6/P9)
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
  } catch (err) {
    showError('Error downloading calendar file.');
  }
}

// ==========================================
// Weekly Timetable Panel (P11)
// ==========================================
function loadTimetable() {
  try {
    const stored = localStorage.getItem('noticelens_timetable');
    if (stored) {
      state.timetable = JSON.parse(stored);
    } else {
      // Default sample slot
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

function handleAddTimetableSlot(e) {
  e.preventDefault();
  if (elements.timetableFormError) elements.timetableFormError.classList.add('hidden');

  const day = elements.slotDay.value;
  const start = elements.slotStart.value;
  const end = elements.slotEnd.value;
  const subject = elements.slotSubject.value.trim();

  // Validation: end after start, subject required
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

  // Reset subject
  elements.slotSubject.value = '';
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
    elements.timetableSlotsList.innerHTML = '<span class="hint-text">No recurring classes added yet.</span>';
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
}

// ==========================================
// Coordinator Publish Flow (P12)
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
    });
  }
}
