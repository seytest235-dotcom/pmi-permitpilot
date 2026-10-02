/* PermitPilot dashboard - plain JS, no dependencies.
 * Always renders the saved analysis.json (or the offline bundle). Review state
 * (verify / dismiss / notes / action done) lives in sessionStorage only. */
(() => {
  'use strict';

  // ---------- Constants ----------
  const STATUS = {
    pass: { icon: '✔', label: 'Pass', cls: 'pass' },
    flag: { icon: '⚠', label: 'Flagged', cls: 'flag' },
    missing: { icon: '✖', label: 'Missing', cls: 'fail' },
    needs_review: { icon: '?', label: 'Needs review', cls: 'review' },
  };
  const PSTATUS = {
    valid: { icon: '✔', label: 'Valid', cls: 'pass' },
    expiring: { icon: '⚠', label: 'Expiring', cls: 'flag' },
    expired: { icon: '✖', label: 'Expired', cls: 'fail' },
    missing: { icon: '✖', label: 'Missing', cls: 'fail' },
    mismatch: { icon: '⚠', label: 'Mismatch', cls: 'flag' },
  };
  const XC_TYPE = {
    date_conflict: 'Date conflict', name_mismatch: 'Name / address mismatch', address_mismatch: 'Address mismatch',
    responsibility_gap: 'Responsibility gap', condition_vs_schedule: 'Condition vs. schedule',
    security_expiry: 'Bond / insurance expiry', missing_permit: 'Missing permit', renewal_gap: 'Renewal gap',
  };
  const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
  const TABS = [
    { id: 'checklist', label: 'Review checklist' },
    { id: 'permits', label: 'Permit tracker' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'cross', label: 'Cross-document' },
    { id: 'actions', label: 'Action list' },
  ];
  const ANALYSIS_STEPS = [
    'Reading {docs} documents ({pages} pages)',
    'Extracting parties, dates, milestones and permits',
    'Applying {rules} playbook rules',
    'Cross-checking contract against permits',
    'Verifying every quote against its source',
  ];

  // ---------- State ----------
  const app = document.getElementById('app');
  const S = { data: null, tab: 'checklist', filter: 'all', open: new Set(), notesOpen: new Set(), review: {}, done: {}, conflict: null, docCache: {} };

  // ---------- Helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toDate = (d) => new Date(`${d}T00:00:00Z`);
  const fmtDate = (d) => (d ? toDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
  const docById = (id) => (S.data.meta.documents || []).find((d) => d.id === id);
  const shortDoc = (id) => { const d = docById(id); return d ? d.title.replace(/\s+[A-Z]{2,}-[A-Z]{2}-\d{4}-\d+$/, '') : id; };
  const storeKey = () => `permitpilot:${S.data.project.contract_ref || S.data.project.name}`;
  const statusOf = (c) => STATUS[c.status] || STATUS.needs_review;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  function loadReview() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(storeKey()) || '{}');
      S.review = raw.review || {}; S.done = raw.done || {};
    } catch { S.review = {}; S.done = {}; }
  }
  function saveReview() {
    try { sessionStorage.setItem(storeKey(), JSON.stringify({ review: S.review, done: S.done })); } catch { /* private mode: keep in memory */ }
  }

  // ---------- Data loading ----------
  async function fetchAnalysis() {
    try {
      const r = await fetch('../analysis.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (window.PERMITPILOT_BUNDLE && window.PERMITPILOT_BUNDLE.analysis) return window.PERMITPILOT_BUNDLE.analysis;
      throw new Error('Could not load analysis.json. Start the app with "npm start" and open http://localhost:5173');
    }
  }
  async function fetchDoc(id) {
    if (S.docCache[id]) return S.docCache[id];
    const d = docById(id);
    let text = null;
    try {
      const r = await fetch(`../${d.file}`, { cache: 'no-store' });
      if (r.ok) text = await r.text();
    } catch { /* fall through to bundle */ }
    if (text == null && window.PERMITPILOT_BUNDLE && window.PERMITPILOT_BUNDLE.docs) text = window.PERMITPILOT_BUNDLE.docs[id];
    if (text == null) throw new Error('Source document not available');
    S.docCache[id] = text;
    return text;
  }

  // ---------- Landing ----------
  function renderLanding() {
    document.getElementById('topActions').hidden = true;
    app.innerHTML = `
      <section class="landing container">
        <div class="hero">
          <div>
            <h1>Review a contract and its permits in <em>minutes</em>, not hours.</h1>
            <p class="lead">PermitPilot checks your contract and permits against your organisation's playbook,
              flags what is risky or missing, and links every finding to the exact source text. You verify each item.</p>
            <div class="cta">
              <button class="btn btn-primary btn-lg" data-action="load-sample">▶ Load sample project</button>
              <label class="btn btn-lg" for="upload">⬆ Upload contract &amp; permits</label>
              <input id="upload" type="file" multiple accept=".md,.txt,.pdf,.docx" class="sr-only">
            </div>
            <div id="uploadList"></div>
            <p class="demo-note">Demo mode: the dashboard shows the saved Claude analysis of the fictional sample project
              (<code>analysis.json</code>). To analyse new documents, run <code>node analyze.js</code> with an Anthropic API key.</p>
          </div>
          <ol class="steps">
            <li><span class="n">1</span><div><b>Extract</b>Parties, site, dates, milestones, permits, bonds.</div></li>
            <li><span class="n">2</span><div><b>Check against the playbook</b>30 PMBOK-aligned rules your PMO can edit.</div></li>
            <li><span class="n">3</span><div><b>Cross-check documents</b>Milestone vs. permit dates, names, addresses, responsibilities.</div></li>
            <li><span class="n">4</span><div><b>Cite the evidence</b>Exact quote, clause and confidence for every finding.</div></li>
            <li><span class="n">5</span><div><b>You decide</b>Verify, dismiss or note each item, then export the action list to CSV.</div></li>
          </ol>
        </div>
      </section>`;
    document.getElementById('upload').addEventListener('change', (e) => {
      const files = [...e.target.files];
      if (!files.length) return;
      document.getElementById('uploadList').innerHTML =
        `<ul class="upload-list">${files.map((f) => `<li>📄 ${esc(f.name)}</li>`).join('')}</ul>`;
      startAnalysis(files.length);
    });
  }

  // ---------- Analysis progress (presentational; data comes from analysis.json) ----------
  async function startAnalysis(uploadedCount) {
    let data;
    try { data = await fetchAnalysis(); } catch (e) { return renderError(e.message); }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepMs = reduced ? 150 : 650;
    const fill = (s) => s.replace('{docs}', data.meta.documents.length)
      .replace('{pages}', (data.impact && data.impact.pages_reviewed) || '?')
      .replace('{rules}', data.checklist_items.length);
    document.getElementById('topActions').hidden = true;
    app.innerHTML = `
      <section class="analysing" aria-busy="true">
        <h2>Analysing documents…</h2>
        <p class="muted">${uploadedCount ? `${uploadedCount} file(s) selected. Demo mode shows the saved analysis of the sample project.` : 'Sample project: Office fit-out contract + permit set.'}</p>
        <ol>${ANALYSIS_STEPS.map((s, i) => `<li id="st${i}"><span class="i"></span>${esc(fill(s))}</li>`).join('')}</ol>
        <button class="btn" data-action="skip-analysis">Skip ▸</button>
      </section>`;
    let skipped = false;
    S.skip = () => { skipped = true; };
    for (let i = 0; i < ANALYSIS_STEPS.length && !skipped; i++) {
      const li = document.getElementById(`st${i}`);
      if (!li) return; // navigated away
      li.className = 'active';
      await new Promise((r) => setTimeout(r, stepMs));
      li.className = 'done';
      li.querySelector('.i').textContent = '✔';
    }
    if (!skipped) await new Promise((r) => setTimeout(r, reduced ? 0 : 300));
    openProject(data);
  }

  function renderError(msg) {
    app.innerHTML = `<div class="error-box"><h2>Could not load the analysis</h2><p>${esc(msg)}</p>
      <button class="btn btn-primary" data-action="load-sample">Try again</button></div>`;
  }

  // ---------- Project ----------
  function normalise(d) {
    d.meta = d.meta || {}; d.meta.documents = d.meta.documents || [];
    d.project = d.project || { name: 'Untitled project' }; d.project.dates = d.project.dates || {}; d.project.parties = d.project.parties || [];
    ['checklist_items', 'permits', 'cross_checks', 'actions'].forEach((k) => { d[k] = Array.isArray(d[k]) ? d[k] : []; });
    d.timeline = d.timeline || {}; ['milestones', 'permit_windows', 'conflicts', 'securities'].forEach((k) => { d.timeline[k] = d.timeline[k] || []; });
    if (!d.timeline.range) d.timeline.range = { start: d.project.dates.contract_date || '2026-01-01', end: d.project.dates.completion || '2027-12-31' };
    d.checklist_items.forEach((c) => { c.source = c.source || { document: '', section: '' }; });
    return d;
  }

  function openProject(data) {
    S.data = normalise(data);
    S.tab = 'checklist'; S.filter = 'all'; S.open.clear(); S.notesOpen.clear(); S.conflict = null;
    loadReview();
    document.getElementById('topActions').hidden = false;
    const p = data.project;
    app.innerHTML = `
      <section class="project container">
        <div class="project-head">
          <div>
            <h1>${esc(p.name)}</h1>
            <div class="meta">
              <b>${esc(p.contract_ref || '')}</b> ·
              ${(p.parties || []).filter((x) => x.role !== 'Project Manager').map((x) => `${esc(x.role)}: <b>${esc(x.name)}</b>`).join(' · ')}<br>
              Start <b>${fmtDate(p.dates.start)}</b> · Completion <b>${fmtDate(p.dates.completion)}</b> ·
              Review date <b>${fmtDate(data.meta.review_date)}</b>
              <span class="mode-pill" title="${esc(data.meta.generator || '')}">Saved analysis</span>
            </div>
          </div>
        </div>
        <div class="kpis" id="kpis"></div>
        <div class="progress-wrap" id="progress"></div>
      </section>
      <nav class="tabs" aria-label="Sections"><div class="container" role="tablist" id="tablist"></div></nav>
      <section class="panel container" id="panel" role="tabpanel"></section>`;
    renderHeader();
    renderTabs();
    renderPanel();
    window.scrollTo(0, 0);
  }

  function counts() {
    const c = { pass: 0, flag: 0, missing: 0, needs_review: 0 };
    S.data.checklist_items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }

  function renderHeader() {
    const d = S.data; const c = counts(); const im = d.impact || {};
    const issues = c.flag + c.missing;
    const high = d.checklist_items.filter((i) => i.status !== 'pass' && i.severity === 'High').length;
    const xIssues = d.cross_checks.filter((x) => x.status !== 'ok').length;
    const hrs = (m) => (m >= 60 ? `~${+(m / 60).toFixed(1)} h` : `~${m} min`);
    document.getElementById('kpis').innerHTML = `
      <button class="kpi pass" data-action="filter" data-filter="pass"><div class="num">${c.pass}</div><div class="lbl">✔ Passed</div></button>
      <button class="kpi flag" data-action="filter" data-filter="flag"><div class="num">${c.flag}</div><div class="lbl">⚠ Flagged</div></button>
      <button class="kpi fail" data-action="filter" data-filter="missing"><div class="num">${c.missing}</div><div class="lbl">✖ Missing</div></button>
      <button class="kpi review" data-action="filter" data-filter="needs_review"><div class="num">${c.needs_review}</div><div class="lbl">? Needs review</div></button>
      <div class="impact">
        <h2>Demo impact</h2>
        <div class="row">
          <div><div class="big">${d.checklist_items.length}</div><div class="sub">rules checked in ${im.documents_reviewed || d.meta.documents.length} documents</div></div>
          <div><div class="big">${issues}</div><div class="sub">issues caught (${high} High, ${xIssues} cross-document)</div></div>
          <div><div class="big"><s>${hrs(im.manual_review_minutes_estimate || 0)}</s> <span class="arrow">→</span> ${hrs(im.permitpilot_minutes_estimate || 0)}</div><div class="sub">review time (estimate)</div></div>
        </div>
        ${im.basis ? `<details><summary>How is this estimated?</summary>${esc(im.basis)}</details>` : ''}
      </div>`;
    renderProgress();
  }

  function renderProgress() {
    const items = S.data.checklist_items;
    const v = items.filter((i) => (S.review[i.id] || {}).s === 'verified').length;
    const dm = items.filter((i) => (S.review[i.id] || {}).s === 'dismissed').length;
    const pct = items.length ? Math.round(((v + dm) / items.length) * 100) : 0;
    document.getElementById('progress').innerHTML = `
      <div class="label">PM review: ${v + dm} / ${items.length} items</div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${v + dm}" aria-label="Items reviewed"><div style="width:${pct}%"></div></div>
      <div class="muted">${v} verified · ${dm} dismissed · ${pct}%</div>`;
  }

  function renderTabs() {
    const d = S.data; const c = counts();
    const n = {
      checklist: { v: c.flag + c.missing + c.needs_review, alert: true },
      permits: { v: d.permits.filter((p) => p.status !== 'valid' || p.date_conflict).length, alert: true },
      timeline: { v: d.timeline.conflicts.length, alert: true },
      cross: { v: d.cross_checks.filter((x) => x.status !== 'ok').length, alert: true },
      actions: { v: d.actions.length, alert: false },
    };
    document.getElementById('tablist').innerHTML = TABS.map((t) => `
      <button class="tab" role="tab" id="tab-${t.id}" aria-selected="${S.tab === t.id}" data-action="tab" data-tab="${t.id}">
        ${esc(t.label)}<span class="count ${n[t.id].alert && n[t.id].v ? 'alert' : ''}">${n[t.id].v}</span>
      </button>`).join('');
  }

  function renderPanel() {
    const panel = document.getElementById('panel');
    panel.setAttribute('aria-labelledby', `tab-${S.tab}`);
    panel.innerHTML = ({ checklist: checklistHTML, permits: permitsHTML, timeline: timelineHTML, cross: crossHTML, actions: actionsHTML })[S.tab]();
  }

  function setTab(tab) {
    S.tab = tab; renderTabs(); renderPanel();
    const tabs = document.querySelector('.tabs');
    if (tabs && window.scrollY > tabs.offsetTop) window.scrollTo({ top: tabs.offsetTop });
  }

  // ---------- Checklist ----------
  function checklistHTML() {
    const items = S.data.checklist_items;
    const c = counts();
    const filters = [['all', 'All', items.length], ['flag', '⚠ Flagged', c.flag], ['missing', '✖ Missing', c.missing],
      ['needs_review', '? Needs review', c.needs_review], ['pass', '✔ Passed', c.pass], ['open', 'Not yet reviewed', items.filter((i) => !(S.review[i.id] || {}).s).length]];
    const shown = items.filter((i) => S.filter === 'all' || (S.filter === 'open' ? !(S.review[i.id] || {}).s : i.status === S.filter));
    const groups = [];
    shown.forEach((i) => { let g = groups.find((x) => x.name === i.category); if (!g) groups.push(g = { name: i.category, items: [] }); g.items.push(i); });
    return `
      <h2>Review checklist</h2>
      <p class="intro">One item per playbook rule. Open <b>Evidence</b> to see the exact quote and source, then <b>Verify</b> or <b>Dismiss</b>. You have the final say.</p>
      <div class="toolbar" role="group" aria-label="Filter checklist">
        ${filters.map(([f, l, n]) => `<button class="filter" aria-pressed="${S.filter === f}" data-action="filter" data-filter="${f}">${l} (${n})</button>`).join('')}
        <span class="spacer"></span>
        <button class="btn btn-sm" data-action="expand-all">${shown.every((i) => S.open.has(i.id)) && shown.length ? 'Hide all evidence' : 'Show all evidence'}</button>
        <button class="btn btn-sm" data-action="verify-passes" title="Mark every passed item as verified">✔ Verify all passes</button>
        <button class="btn btn-sm" data-action="export-checklist">⬇ Checklist CSV</button>
      </div>
      ${groups.length ? groups.map((g) => `
        <div class="group">
          <h3>${esc(g.name)} <span class="muted">${g.items.length} item${g.items.length > 1 ? 's' : ''}</span></h3>
          ${g.items.map(itemHTML).join('')}
        </div>`).join('') : '<div class="empty">No checklist items match this filter.</div>'}`;
  }

  function confHTML(c) {
    const pct = Math.round((c || 0) * 100);
    return `<span class="conf ${c < 0.7 ? 'low' : ''}" title="Model confidence">Confidence <span class="bar"><i style="width:${pct}%"></i></span> <b>${pct}%</b></span>`;
  }

  function itemHTML(i) {
    const st = statusOf(i);
    const r = S.review[i.id] || {};
    const open = S.open.has(i.id);
    const noteOpen = S.notesOpen.has(i.id);
    return `
      <article class="item s-${esc(i.status)} ${r.s === 'dismissed' ? 'is-dismissed' : ''}" id="item-${esc(i.id)}" data-id="${esc(i.id)}">
        <div>
          <div class="item-head">
            <span class="badge ${st.cls}">${st.icon} ${st.label}</span>
            <span class="sev ${esc(i.severity)}">${esc(i.severity)}</span>
            <h4>${esc(i.title || i.rule_id)}</h4>
            <span class="rule">${esc(i.rule_id)} · ${esc(i.id)}</span>
          </div>
          <p class="finding">${esc(i.finding)}</p>
          <p class="suggest"><b>Suggested action:</b> ${esc(i.suggested_action)}</p>
        </div>
        <div class="controls" role="group" aria-label="Review ${esc(i.title || i.id)}">
          <button class="btn btn-sm v" aria-pressed="${r.s === 'verified'}" data-action="verify" data-id="${esc(i.id)}">✔ Verify</button>
          <button class="btn btn-sm d" aria-pressed="${r.s === 'dismissed'}" data-action="dismiss" data-id="${esc(i.id)}">Dismiss</button>
          <button class="btn btn-sm" aria-expanded="${noteOpen}" data-action="note" data-id="${esc(i.id)}">✎ ${r.note ? 'Edit note' : 'Add note'}</button>
        </div>
        <div class="item-foot">
          <button class="linkish" aria-expanded="${open}" aria-controls="ev-${esc(i.id)}" data-action="toggle-evidence" data-id="${esc(i.id)}">${open ? '▾ Hide evidence' : '▸ Evidence'}</button>
          ${r.s === 'verified' ? '<span class="review-state v">✔ Verified by PM</span>' : ''}
          ${r.s === 'dismissed' ? '<span class="review-state d">Dismissed by PM</span>' : ''}
          ${r.note && !noteOpen ? `<span class="note-view">✎ ${esc(r.note)}</span>` : ''}
        </div>
        ${open ? `
        <div class="evidence" id="ev-${esc(i.id)}">
          <blockquote class="quote">“${esc(i.evidence_quote)}”</blockquote>
          <div class="evi-meta">
            <span><span class="xdoc">${esc(i.source.document)}</span> ${esc(shortDoc(i.source.document))} · <b>${esc(i.source.section)}</b></span>
            ${confHTML(i.confidence)}
            <button class="btn btn-sm" data-action="open-doc" data-doc="${esc(i.source.document)}" data-quote="${esc(i.evidence_quote)}">Open in document ↗</button>
          </div>
        </div>` : ''}
        ${noteOpen ? `
        <div class="note-editor">
          <label class="sr-only" for="note-${esc(i.id)}">Note for ${esc(i.id)}</label>
          <textarea id="note-${esc(i.id)}" placeholder="Add your note (kept in this browser session)">${esc(r.note || '')}</textarea>
          <button class="btn btn-primary btn-sm" data-action="save-note" data-id="${esc(i.id)}">Save note</button>
          <button class="btn btn-sm" data-action="note" data-id="${esc(i.id)}">Cancel</button>
        </div>` : ''}
      </article>`;
  }

  function rerenderItem(id) {
    const el = document.getElementById(`item-${id}`);
    const it = S.data.checklist_items.find((x) => x.id === id);
    if (el && it) el.outerHTML = itemHTML(it);
    renderProgress();
  }

  function setReview(id, s) {
    const r = S.review[id] || (S.review[id] = {});
    r.s = r.s === s ? null : s;
    saveReview();
    if (S.filter === 'open') { renderPanel(); } else { rerenderItem(id); }
    renderProgress();
  }

  function focusFinding(id) {
    if (!id) return;
    if (id.startsWith('CHK')) {
      S.filter = 'all'; S.open.add(id); setTab('checklist');
    } else if (id.startsWith('XC')) {
      setTab('cross');
    } else if (id.startsWith('TL')) {
      S.conflict = id; setTab('timeline');
    } else if (id.startsWith('PRM')) {
      setTab('permits');
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-${id}`) || document.getElementById(`xc-${id}`) || document.getElementById(`cc-${id}`) || document.getElementById(`pm-${id}`);
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    });
  }

  // ---------- Permits ----------
  function permitsHTML() {
    const d = S.data;
    const ms = Object.fromEntries(d.timeline.milestones.map((m) => [m.id, m]));
    const order = { expired: 0, missing: 1, mismatch: 2, expiring: 3, valid: 4 };
    const list = [...d.permits].sort((a, b) => (order[a.status] - order[b.status]) || (b.date_conflict ? 1 : 0) - (a.date_conflict ? 1 : 0));
    const today = d.meta.review_date || d.timeline.today;
    const holder = (d.project.parties || []).find((p) => p.role === 'Employer');
    return `
      <h2>Permit tracker</h2>
      <p class="intro">Permits the contract requires (Annex C, milestones and clauses) vs. what is on file. Holder names and site addresses are checked against the contract.</p>
      <div class="legend">${Object.values(PSTATUS).map((s) => `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`).join('')}</div>
      ${list.length ? '' : '<div class="empty">No permits found in the analysis.</div>'}
      <div class="permit-grid">
        ${list.map((p) => {
          const st = PSTATUS[p.status] || PSTATUS.missing;
          const nameBad = p.holder && holder && p.holder !== holder.name;
          const notYet = p.valid_from && p.valid_from > today;
          return `
          <article class="permit ${st.cls} ${p.status === 'missing' ? 'missing-card' : ''}" id="pm-${esc(p.id)}">
            <div class="top">
              <h3>${esc(p.required_permit)}</h3>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="badge ${st.cls}">${st.icon} ${st.label}</span>
                ${p.date_conflict ? '<span class="badge fail">✖ Date conflict</span>' : ''}
              </div>
            </div>
            <dl>
              <dt>Permit no.</dt><dd>${p.permit_no ? esc(p.permit_no) : '<span class="bad">Not on file</span>'}</dd>
              <dt>Holder</dt><dd class="${nameBad ? 'bad' : ''}">${p.holder ? esc(p.holder) + (nameBad ? ' ✖' : '') : '—'}</dd>
              <dt>Valid from</dt><dd class="${notYet ? 'bad' : ''}">${fmtDate(p.valid_from || p.issue_date)}${notYet ? ' (not yet in force)' : ''}</dd>
              <dt>Expires</dt><dd class="${p.status === 'expired' ? 'bad' : ''}">${fmtDate(p.expiry_date)}</dd>
              <dt>Responsible</dt><dd class="${p.responsible === 'Unassigned' ? 'bad' : ''}">${esc(p.responsible || '—')}${p.responsible === 'Unassigned' ? ' ✖' : ''}</dd>
              <dt>Needed for</dt><dd>${(p.required_for || []).map((id) => `${esc(id)} ${esc(ms[id] ? ms[id].name : '')} <span class="muted">(from ${fmtDate(ms[id] && ms[id].start)})</span>`).join('<br>') || '—'}</dd>
            </dl>
            <div class="notes">${esc(p.notes || '')}</div>
            ${p.source && docById(p.source.document) ? `<div><button class="btn btn-sm" data-action="open-doc" data-doc="${esc(p.source.document)}" data-quote="">View source: ${esc(p.source.document)} ↗</button></div>` : ''}
          </article>`;
        }).join('')}
      </div>`;
  }

  // ---------- Timeline ----------
  function timelineHTML() {
    const t = S.data.timeline;
    const rs = toDate(t.range.start).getTime(); const re = toDate(t.range.end).getTime();
    const pct = (d) => Math.max(0, Math.min(100, ((toDate(d).getTime() - rs) / (re - rs)) * 100));
    const dayAfter = (d) => new Date(toDate(d).getTime() + 86400000).toISOString().slice(0, 10);
    const span = (s, e, cls, txt, title) => {
      const l = pct(s); const r = pct(dayAfter(e));
      if (r <= 0 || l >= 100 || toDate(e) < toDate(t.range.start)) return '';
      const clipL = toDate(s) < toDate(t.range.start); const clipR = toDate(e) > toDate(t.range.end);
      return `<div class="bar ${cls} ${clipL ? 'clip-l' : ''} ${clipR ? 'clip-r' : ''}" style="left:${l}%;width:${Math.max(r - l, 0.6)}%" title="${esc(title)}">${txt && r - l > 9 ? `<span class="txt">${esc(txt)}</span>` : ''}</div>`;
    };
    // month axis
    const months = [];
    for (let d = toDate(t.range.start); d <= toDate(t.range.end); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const iso = d.toISOString().slice(0, 10);
      months.push(`<div class="tl-gridline" style="left:${pct(iso)}%"></div><div class="tl-month" style="left:${pct(iso)}%">${d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</div>`);
    }
    const secIds = new Set((t.securities || []).map((s) => s.id));
    const conflictsFor = (rowId) => t.conflicts.filter((c) => c.milestone_id === rowId && !secIds.has(c.permit_id));
    const rowCls = (ids) => {
      if (!S.conflict) return '';
      const c = t.conflicts.find((x) => x.id === S.conflict);
      if (!c) return '';
      return ids.some((id) => id === c.milestone_id || id === c.permit_id) ? 'hl' : 'dim';
    };
    const permitsById = Object.fromEntries(S.data.permits.map((p) => [p.id, p]));
    const msRows = t.milestones.map((m) => {
      const needs = (m.requires_permits || []).map((id) => permitsById[id]).filter(Boolean);
      const bad = conflictsFor(m.id).length;
      return `
      <div class="tl-row ${rowCls([m.id])}" data-row="${esc(m.id)}" title="${needs.length ? esc('Needs: ' + needs.map((p) => p.required_permit).join(', ')) : ''}">
        <div class="tl-label">${bad ? '<b style="color:var(--fail)">✖</b> ' : ''}<b>${esc(m.id)}</b> ${esc(m.name)}
          <small>${fmtDate(m.start)}${m.end !== m.start ? ` – ${fmtDate(m.end)}` : ''}</small></div>
        <div class="tl-track">
          ${m.start === m.end ? `<div class="diamond" style="left:${pct(m.start)}%" title="${esc(m.name)} ${fmtDate(m.start)}"></div>` : span(m.start, m.end, 'ms', '', `${m.name}: ${fmtDate(m.start)} – ${fmtDate(m.end)}`)}
          ${conflictsFor(m.id).map((c) => `<div class="conflict ${S.conflict === c.id ? 'on' : ''}" data-action="conflict" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="Conflict: ${esc(c.description)}" title="${esc(c.description)}" style="left:${pct(c.start)}%;width:${Math.max(pct(dayAfter(c.end)) - pct(c.start), 1.4)}%">✖</div>`).join('')}
        </div>
      </div>`;
    }).join('');
    const pwRows = t.permit_windows.map((w) => {
      const p = permitsById[w.permit_id] || {};
      const st = PSTATUS[w.status] || PSTATUS.missing;
      let bar;
      if (!w.start) {
        const req = t.milestones.filter((m) => (p.required_for || []).includes(m.id));
        bar = req.length ? span(req[0].start, req[req.length - 1].end, 'missing', 'NOT ON FILE', `${w.name}: required from ${fmtDate(req[0].start)} but not on file`) : '';
      } else {
        const outside = toDate(w.end) < toDate(t.range.start);
        bar = outside ? '' : span(w.start, w.end, st.cls, `${fmtDate(w.start)} – ${fmtDate(w.end)}`, `${w.name}: ${fmtDate(w.start)} – ${fmtDate(w.end)}`);
        if (w.status === 'expired') bar = `<div class="bar fail clip-l" style="left:0;width:${Math.max(pct(dayAfter(w.end)), 1.2)}%" title="Expired ${fmtDate(w.end)}"></div><span style="position:absolute;left:calc(${pct(dayAfter(w.end))}% + 8px);top:11px;font-weight:800;color:var(--fail);font-size:15px;white-space:nowrap">✖ Expired ${fmtDate(w.end)}</span>`;
      }
      return `
      <div class="tl-row ${rowCls([w.permit_id])}" data-row="${esc(w.permit_id)}">
        <div class="tl-label"><span class="badge ${st.cls}" style="font-size:14px;padding:1px 7px">${st.icon} ${st.label}</span> ${esc(w.name)}</div>
        <div class="tl-track">${bar}</div>
      </div>`;
    }).join('');
    const secRows = (t.securities || []).map((s) => `
      <div class="tl-row ${rowCls([s.id])}" data-row="${esc(s.id)}">
        <div class="tl-label">${s.status === 'flag' ? '<b style="color:var(--fail)">✖</b> ' : ''}${esc(s.name)}<small>${fmtDate(s.start)} – ${fmtDate(s.end)}</small></div>
        <div class="tl-track">${span(s.start, s.end, s.status === 'flag' ? 'flag' : 'pass', `ends ${fmtDate(s.end)}`, s.note || '')}
          ${t.conflicts.filter((c) => c.permit_id === s.id).map((c) => `<div class="conflict ${S.conflict === c.id ? 'on' : ''}" data-action="conflict" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="Conflict: ${esc(c.description)}" title="${esc(c.description)}" style="left:${pct(c.start)}%;width:${Math.max(pct(dayAfter(c.end)) - pct(c.start), 1.4)}%">✖</div>`).join('')}
        </div>
      </div>`).join('');
    const today = t.today || S.data.meta.review_date;
    const pc = S.data.project.dates.completion;
    return `
      <h2>Timeline: milestones vs. permit validity</h2>
      <p class="intro">Contract milestones (Annex B) overlaid with permit validity windows. <b style="color:var(--fail)">Red striped blocks</b> are date conflicts — click one to see what it involves.</p>
      <div class="timeline-card">
        <div class="tl">
          <div class="tl-axis"><div></div><div class="tl-track">${months.join('')}</div></div>
          <div class="tl-section">Contract milestones</div>${msRows}
          <div class="tl-section">Permits</div>${pwRows}
          <div class="tl-section">Bond &amp; insurance</div>${secRows}
          <div class="tl-overlay">
            <div class="tl-line today" style="left:${pct(today)}%"><span>Today ${fmtDate(today)}</span></div>
            <div class="tl-line pc" style="left:${pct(pc)}%"><span>Completion ${fmtDate(pc)}</span></div>
          </div>
        </div>
      </div>
      ${t.conflicts.length ? '' : '<div class="empty" style="margin-top:18px">✔ No date conflicts detected between milestones and permits.</div>'}
      <div class="conflict-list">
        ${t.conflicts.map((c) => `
          <button class="ccard" id="cc-${esc(c.id)}" aria-pressed="${S.conflict === c.id}" data-action="conflict" data-id="${esc(c.id)}">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;width:100%">
              <h3>✖ ${esc(c.description)}</h3>
              ${c.days ? `<div class="days" title="days">${c.days}<small style="font-size:14px"> days</small></div>` : ''}
            </div>
            <div class="chips" style="display:flex;gap:6px;flex-wrap:wrap">${(c.linked_finding_ids || []).map((id) => `<span class="chip">${esc(id)}</span>`).join('')}
              <span class="muted" style="font-size:15px">${S.conflict === c.id ? 'Highlighted on the timeline · click again to clear' : 'Click to highlight'}</span></div>
          </button>`).join('')}
      </div>`;
  }

  // ---------- Cross-document ----------
  function crossHTML() {
    const list = [...S.data.cross_checks].sort((a, b) => (a.status === 'ok') - (b.status === 'ok') || PRIORITY_ORDER[a.severity] - PRIORITY_ORDER[b.severity]);
    return `
      <h2>Cross-document findings</h2>
      <p class="intro">Issues that only appear when the contract and the permits are read <b>together</b>. Each one quotes both sides.</p>
      ${list.length ? '' : '<div class="empty">No cross-document findings.</div>'}
      ${list.map((x) => `
        <article class="xc ${esc(x.severity)} ${x.status === 'ok' ? 'ok' : ''}" id="xc-${esc(x.id)}">
          <div class="head">
            ${x.status === 'ok' ? '<span class="badge pass">✔ Consistent</span>' : `<span class="badge ${x.severity === 'High' ? 'fail' : 'flag'}">${x.severity === 'High' ? '✖' : '⚠'} ${esc(XC_TYPE[x.type] || x.type)}</span><span class="sev ${esc(x.severity)}">${esc(x.severity)}</span>`}
            <h3>${esc(x.title)}</h3>
            <span class="rule muted" style="font-size:15px">${esc(x.id)}</span>
          </div>
          <p class="finding">${esc(x.finding)}</p>
          <div class="evi-grid">
            ${(x.evidence || []).map((e) => `
              <div class="evi-card">
                <div class="doc"><span class="xdoc">${esc(e.source.document)}</span>${esc(shortDoc(e.source.document))} · ${esc(e.source.section)}</div>
                <blockquote class="quote">“${esc(e.quote)}”</blockquote>
                <div><button class="btn btn-sm" data-action="open-doc" data-doc="${esc(e.source.document)}" data-quote="${esc(e.quote)}">Open in document ↗</button></div>
              </div>`).join('')}
          </div>
          <div class="evi-meta" style="margin-top:12px">
            ${confHTML(x.confidence)}
            <span><b>Action:</b> ${esc(x.suggested_action)}</span>
            ${(x.linked_finding_ids || []).map((id) => `<button class="chip" data-action="goto" data-id="${esc(id)}">${esc(id)} ↗</button>`).join('')}
          </div>
        </article>`).join('')}`;
  }

  // ---------- Actions ----------
  function sortedActions() {
    return [...S.data.actions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.due.localeCompare(b.due));
  }
  function actionsHTML() {
    const acts = sortedActions();
    const doneN = acts.filter((a) => S.done[a.id]).length;
    return `
      <h2>Action list</h2>
      <p class="intro">Tasks generated from the findings, with owner role, due date and priority. Export to CSV for your tracker or meeting minutes.</p>
      <div class="toolbar">
        <span class="muted">${acts.length} actions · ${acts.filter((a) => a.priority === 'High').length} High · ${doneN} marked done</span>
        <span class="spacer"></span>
        <button class="btn btn-primary" data-action="export-actions">⬇ Export to CSV</button>
      </div>
      ${acts.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Done</th><th scope="col">Priority</th><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">From findings</th></tr></thead>
          <tbody>
            ${acts.map((a) => `
              <tr class="${S.done[a.id] ? 'done' : ''}">
                <td><input type="checkbox" aria-label="Mark ${esc(a.id)} done" data-action="done" data-id="${esc(a.id)}" ${S.done[a.id] ? 'checked' : ''}></td>
                <td><span class="prio ${esc(a.priority)}">${a.priority === 'High' ? '▲' : a.priority === 'Medium' ? '■' : '▽'} ${esc(a.priority)}</span></td>
                <td class="task">${esc(a.task)}</td>
                <td>${esc(a.owner_role)}</td>
                <td style="white-space:nowrap">${fmtDate(a.due)}</td>
                <td><div class="chips">${(a.linked_finding_ids || []).map((id) => `<button class="chip" data-action="goto" data-id="${esc(id)}">${esc(id)}</button>`).join('')}</div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="empty">No actions generated.</div>'}`;
  }

  // ---------- CSV ----------
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s;
  }
  function downloadCSV(name, header, rows) {
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${rows.length} rows to ${name}`);
  }
  const ref = () => (S.data.project.contract_ref || 'project').replace(/[^\w-]+/g, '_');
  function exportActions() {
    const titles = Object.fromEntries([...S.data.checklist_items.map((c) => [c.id, c.title]), ...S.data.cross_checks.map((x) => [x.id, x.title])]);
    downloadCSV(`PermitPilot_actions_${ref()}.csv`,
      ['Action ID', 'Priority', 'Task', 'Owner role', 'Due date', 'Linked findings', 'Finding titles', 'Done', 'Project', 'Disclaimer'],
      sortedActions().map((a) => [a.id, a.priority, a.task, a.owner_role, a.due, (a.linked_finding_ids || []).join('; '),
        (a.linked_finding_ids || []).map((id) => titles[id] || id).join('; '), S.done[a.id] ? 'Yes' : 'No', S.data.project.name, S.data.meta.disclaimer]));
  }
  function exportChecklist() {
    downloadCSV(`PermitPilot_checklist_${ref()}.csv`,
      ['Item ID', 'Rule ID', 'Category', 'Title', 'Status', 'Severity', 'Finding', 'Evidence quote', 'Source document', 'Source section', 'Confidence', 'Suggested action', 'PM review', 'PM note'],
      S.data.checklist_items.map((c) => {
        const r = S.review[c.id] || {};
        return [c.id, c.rule_id, c.category, c.title, statusOf(c).label, c.severity, c.finding, c.evidence_quote, c.source.document, c.source.section,
          c.confidence, c.suggested_action, r.s ? r.s[0].toUpperCase() + r.s.slice(1) : 'Not reviewed', r.note || ''];
      }));
  }

  // ---------- Document viewer ----------
  async function openDoc(id, quote) {
    const dlg = document.getElementById('viewer');
    const d = docById(id);
    document.getElementById('viewerTitle').textContent = d ? d.title : id;
    document.getElementById('viewerSub').textContent = d ? d.file : '';
    const body = document.getElementById('viewerBody');
    const status = document.getElementById('viewerStatus');
    body.textContent = 'Loading…'; status.textContent = ''; status.className = 'viewer-status';
    if (!dlg.open) dlg.showModal();
    let text;
    try { text = (await fetchDoc(id)).replace(/\*\*/g, ''); } catch (e) { body.textContent = e.message; return; }
    if (!quote) { body.textContent = text; body.scrollTop = 0; return; }
    const tokens = quote.replace(/\*\*/g, '').trim().split(/\s+/).map((tk) => tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const m = new RegExp(tokens.join('\\s+')).exec(text);
    if (!m) {
      body.textContent = text;
      status.textContent = '✖ Quote not found verbatim in this document - treat this finding as Needs review.';
      status.classList.add('bad');
      return;
    }
    body.innerHTML = `${esc(text.slice(0, m.index))}<mark id="hit">${esc(m[0])}</mark>${esc(text.slice(m.index + m[0].length))}`;
    status.textContent = '✔ Exact quote found in source (highlighted below)';
    status.classList.add('ok');
    requestAnimationFrame(() => document.getElementById('hit').scrollIntoView({ block: 'center' }));
  }

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action; const id = el.dataset.id;
    switch (a) {
      case 'load-sample': startAnalysis(0); break;
      case 'skip-analysis': if (S.skip) S.skip(); break;
      case 'reset-review':
        if (S.data && confirm('Clear all verify / dismiss / notes for this project in this browser session?')) {
          S.review = {}; S.done = {}; saveReview(); renderProgress(); renderPanel(); toast('Review state cleared');
        }
        break;
      case 'tab': setTab(el.dataset.tab); break;
      case 'filter': S.filter = el.dataset.filter; if (S.tab !== 'checklist') setTab('checklist'); else renderPanel(); break;
      case 'toggle-evidence': S.open.has(id) ? S.open.delete(id) : S.open.add(id); rerenderItem(id); break;
      case 'expand-all': {
        const shown = [...document.querySelectorAll('.item')].map((x) => x.dataset.id);
        const all = shown.every((x) => S.open.has(x));
        shown.forEach((x) => (all ? S.open.delete(x) : S.open.add(x)));
        renderPanel(); break;
      }
      case 'verify': setReview(id, 'verified'); break;
      case 'dismiss': setReview(id, 'dismissed'); break;
      case 'verify-passes': {
        let n = 0;
        S.data.checklist_items.filter((c) => c.status === 'pass').forEach((c) => {
          const r = S.review[c.id] || (S.review[c.id] = {});
          if (!r.s) { r.s = 'verified'; n++; }
        });
        saveReview(); renderPanel(); renderProgress(); toast(`${n} passed item(s) marked verified`); break;
      }
      case 'note': S.notesOpen.has(id) ? S.notesOpen.delete(id) : S.notesOpen.add(id); rerenderItem(id);
        if (S.notesOpen.has(id)) { const t = document.getElementById(`note-${id}`); if (t) t.focus(); }
        break;
      case 'save-note': {
        const t = document.getElementById(`note-${id}`);
        const r = S.review[id] || (S.review[id] = {});
        r.note = t ? t.value.trim() : '';
        saveReview(); S.notesOpen.delete(id); rerenderItem(id); break;
      }
      case 'open-doc': openDoc(el.dataset.doc, el.dataset.quote); break;
      case 'close-viewer': document.getElementById('viewer').close(); break;
      case 'conflict': S.conflict = S.conflict === id ? null : id; renderPanel(); break;
      case 'goto': focusFinding(id); break;
      case 'export-actions': exportActions(); break;
      case 'export-checklist': exportChecklist(); break;
      case 'done': break; // handled on change
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="done"]');
    if (!el) return;
    S.done[el.dataset.id] = el.checked; saveReview(); renderPanel();
  });
  document.addEventListener('keydown', (e) => {
    const el = e.target.closest && e.target.closest('[role="button"][data-action]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
  });
  document.getElementById('viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') e.target.close(); });

  renderLanding();
})();
