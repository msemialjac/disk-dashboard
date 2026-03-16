/* Disk Usage Dashboard — live data from /api/disk */

var COLORS = ['#7aa2f7','#9ece6a','#e0af68','#f7768e','#bb9af7','#7dcfff','#ff9e64','#73daca','#b4f9f8','#c0caf5'];
var ICONS = { physical: '\u{1F4BE}', network: '\u2601', snap: '\u{1F4E6}' };

var filesystems = [];
var state = { view: 'bars', unit: 'human', selected: null, refreshTimer: null, lastUpdate: null, donutMode: 'capacity', promptOpen: false };

/* --- Data fetching --- */

function fetchData() {
  fetch('/api/disk')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      filesystems = data;
      filesystems.forEach(function(f, i) { f.color = COLORS[i % COLORS.length]; });
      state.lastUpdate = new Date();
      document.getElementById('hostInfo').textContent = 'learn2improve \u2014 Arch Linux';
      document.getElementById('refreshInfo').textContent = 'Updated: ' + state.lastUpdate.toLocaleTimeString();
      render();
    })
    .catch(function(err) {
      document.getElementById('hostInfo').textContent = 'Error loading data';
      console.error('Fetch error:', err);
    });
}

function setRefreshInterval() {
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  var sec = parseInt(document.getElementById('refreshInterval').value);
  if (sec > 0) {
    state.refreshTimer = setInterval(fetchData, sec * 1000);
  }
}

/* --- Helpers --- */

function fmtBytes(b) {
  if (state.unit === 'bytes') return b.toLocaleString() + ' B';
  if (state.unit === 'gb') return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1099511627776) return (b / 1099511627776).toFixed(1) + ' TB';
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1024).toFixed(0) + ' KB';
}

function getThreshold() { return parseInt(document.getElementById('threshold').value); }

function barColor(pct) {
  var t = getThreshold();
  if (pct >= 90) return 'var(--red)';
  if (pct >= t && t > 0) return 'var(--yellow)';
  if (pct >= 50) return 'var(--accent)';
  return 'var(--green)';
}

function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

function getFiltered() {
  var filter = document.getElementById('filterType').value;
  var sortBy = document.getElementById('sortBy').value;
  var list = filesystems.slice();

  if (filter === 'physical') list = list.filter(function(f) { return f.category === 'physical'; });
  else if (filter === 'network') list = list.filter(function(f) { return f.category === 'network'; });
  else if (filter === 'snap') list = list.filter(function(f) { return f.category === 'snap'; });

  list.sort(function(a, b) {
    if (sortBy === 'pct-desc') return b.pct - a.pct;
    if (sortBy === 'pct-asc') return a.pct - b.pct;
    if (sortBy === 'size-desc') return b.sizeB - a.sizeB;
    if (sortBy === 'used-desc') return b.usedB - a.usedB;
    if (sortBy === 'avail-desc') return b.availB - a.availB;
    return a.label.localeCompare(b.label);
  });
  return list;
}

/* --- Renderers (all use safe DOM methods, no innerHTML) --- */

function renderSummary() {
  var phys = filesystems.filter(function(f) { return f.category === 'physical' && f.mount.indexOf('(') === -1; });
  var totalSize = phys.reduce(function(s, f) { return s + f.sizeB; }, 0);
  var totalUsed = phys.reduce(function(s, f) { return s + f.usedB; }, 0);
  var totalAvail = phys.reduce(function(s, f) { return s + f.availB; }, 0);
  var t = getThreshold();
  var overT = t > 0 ? filesystems.filter(function(f) { return f.pct >= t && f.usedB > 0; }).length : 0;

  var cont = document.getElementById('summaryCards');
  cont.replaceChildren();

  var cards = [
    { label: 'Total Capacity', value: fmtBytes(totalSize), sub: 'Physical disks (mounted)', color: '' },
    { label: 'Used', value: fmtBytes(totalUsed), sub: (totalSize > 0 ? (totalUsed / totalSize * 100).toFixed(1) : 0) + '% of capacity', color: 'var(--accent)' },
    { label: 'Available', value: fmtBytes(totalAvail), sub: 'Across all physical mounts', color: 'var(--green)' },
    { label: 'Over ' + t + '% threshold', value: String(overT), sub: overT === 0 ? 'All clear' : 'Needs attention', color: overT > 0 ? 'var(--yellow)' : 'var(--green)' },
  ];

  cards.forEach(function(c) {
    var card = el('div', 'card');
    card.appendChild(el('div', 'label', c.label));
    var v = el('div', 'value', c.value);
    if (c.color) v.style.color = c.color;
    card.appendChild(v);
    card.appendChild(el('div', 'sub', c.sub));
    cont.appendChild(card);
  });
}

function renderBars() {
  var list = getFiltered();
  var cont = document.getElementById('barsView');
  var t = getThreshold();
  cont.replaceChildren();

  list.forEach(function(f) {
    var row = el('div', 'bar-row' + (state.selected === f.dev ? ' selected' : ''));
    row.addEventListener('click', function() { selectFs(f.dev); });

    var header = el('div', 'bar-header');
    var name = el('div', 'bar-name');
    name.appendChild(el('span', '', ICONS[f.category] || ''));
    name.appendChild(document.createTextNode(' ' + f.label));
    header.appendChild(name);

    var stats = el('div', 'bar-stats');
    stats.appendChild(el('span', '', fmtBytes(f.usedB) + ' / ' + fmtBytes(f.sizeB)));
    var pctSpan = el('span', '', f.pct.toFixed(1) + '%');
    pctSpan.style.color = barColor(f.pct);
    stats.appendChild(pctSpan);
    header.appendChild(stats);
    row.appendChild(header);

    var track = el('div', 'bar-track');
    track.style.position = 'relative';
    var fill = el('div', 'bar-fill', f.pct >= 5 ? f.pct.toFixed(0) + '%' : '');
    fill.style.width = Math.max(f.pct, 1.5) + '%';
    fill.style.background = barColor(f.pct);
    track.appendChild(fill);

    if (t > 0) {
      var tl = el('div', 'threshold-line');
      tl.style.position = 'absolute';
      tl.style.left = t + '%';
      track.appendChild(tl);
    }

    row.appendChild(track);
    cont.appendChild(row);
  });
}

function renderDonut() {
  var list = getFiltered().filter(function(f) { return f.usedB > 0; });
  var totalUsed = list.reduce(function(s, f) { return s + f.usedB; }, 0);
  var totalSize = list.reduce(function(s, f) { return s + f.sizeB; }, 0);
  var overallPct = totalSize > 0 ? (totalUsed / totalSize * 100).toFixed(1) : '0';
  var cont = document.getElementById('donutView');
  cont.replaceChildren();

  var mode = state.donutMode;
  // capacity: segment = total size, single arc per fs
  // detail: segment = total size, split into used (full opacity) + free (30% opacity)
  // used: segment = used bytes, single arc per fs
  var segmentTotal = (mode === 'capacity' || mode === 'detail')
    ? list.reduce(function(s, f) { return s + f.sizeB; }, 0)
    : totalUsed;

  var R = 80, C = 2 * Math.PI * R;
  var svgNS = 'http://www.w3.org/2000/svg';
  var wrapper = el('div', 'donut-container');
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 220 220');

  var offset = 0;

  function makeArc(f, dashLen, arcOffset, opacity) {
    var circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '110');
    circle.setAttribute('cy', '110');
    circle.setAttribute('r', String(R));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', f.color);
    circle.setAttribute('stroke-width', '28');
    circle.setAttribute('stroke-dasharray', dashLen + ' ' + (C - dashLen));
    circle.setAttribute('stroke-dashoffset', String(-arcOffset));
    circle.setAttribute('opacity', String(opacity));
    circle.style.cursor = 'pointer';
    circle.addEventListener('click', function() { selectFs(f.dev); });
    return circle;
  }

  list.forEach(function(f) {
    if (mode === 'detail') {
      // Total segment proportional to capacity
      var totalPct = segmentTotal > 0 ? f.sizeB / segmentTotal : 0;
      var totalDash = totalPct * C;
      // Split into used portion and free portion
      var usedRatio = f.sizeB > 0 ? f.usedB / f.sizeB : 0;
      var usedDash = totalDash * usedRatio;
      var freeDash = totalDash - usedDash;

      // Used arc: full opacity
      if (usedDash > 0.5) {
        svg.appendChild(makeArc(f, usedDash, offset, 1.0));
      }
      // Free arc: dimmed
      if (freeDash > 0.5) {
        svg.appendChild(makeArc(f, freeDash, offset + usedDash, 0.60));
      }
      offset += totalDash;
    } else {
      var segVal = mode === 'capacity' ? f.sizeB : f.usedB;
      var pct = segmentTotal > 0 ? segVal / segmentTotal : 0;
      var dash = pct * C;
      svg.appendChild(makeArc(f, dash, offset, 1.0));
      offset += dash;
    }
  });

  wrapper.appendChild(svg);
  var center = el('div', 'donut-center');
  center.appendChild(el('div', 'pct', overallPct + '%'));
  var centerLabel = mode === 'detail' ? 'used of capacity'
    : mode === 'capacity' ? 'used of capacity'
    : 'used (by volume)';
  center.appendChild(el('div', 'lbl', centerLabel));
  wrapper.appendChild(center);
  cont.appendChild(wrapper);

  var legend = el('div', 'legend');
  list.forEach(function(f) {
    var item = el('div', 'legend-item');
    item.addEventListener('click', function() { selectFs(f.dev); });
    var dot = el('div', 'legend-dot');
    dot.style.background = f.color;
    item.appendChild(dot);
    item.appendChild(el('span', '', f.label));
    var legendText;
    if (mode === 'detail') {
      legendText = fmtBytes(f.usedB) + ' / ' + fmtBytes(f.sizeB) + ' (' + f.pct.toFixed(0) + '%)';
    } else if (mode === 'capacity') {
      legendText = fmtBytes(f.sizeB) + ' (' + f.pct.toFixed(0) + '% used)';
    } else {
      legendText = fmtBytes(f.usedB);
    }
    item.appendChild(el('span', 'legend-val', legendText));
    legend.appendChild(item);
  });
  cont.appendChild(legend);
}

function selectFs(dev) {
  state.selected = state.selected === dev ? null : dev;
  render();
}

function renderDetail() {
  var panel = document.getElementById('detailPanel');
  if (!state.selected) { panel.classList.remove('visible'); panel.replaceChildren(); return; }
  var f = filesystems.find(function(x) { return x.dev === state.selected; });
  if (!f) { panel.classList.remove('visible'); panel.replaceChildren(); return; }
  panel.classList.add('visible');
  panel.replaceChildren();

  panel.appendChild(el('h3', '', f.label));
  var grid = el('div', 'detail-grid');
  var items = [
    ['Device', f.dev], ['Mount', f.mount], ['Filesystem', f.fstype],
    ['Total', fmtBytes(f.sizeB)], ['Used', fmtBytes(f.usedB)], ['Available', fmtBytes(f.availB)],
    ['Usage', f.pct.toFixed(2) + '%'], ['Category', f.category],
  ];
  items.forEach(function(pair) {
    var item = el('div', 'detail-item');
    item.appendChild(el('span', 'k', pair[0]));
    var v = el('span', 'v', pair[1]);
    if (pair[0] === 'Usage') v.style.color = barColor(f.pct);
    item.appendChild(v);
    grid.appendChild(item);
  });
  panel.appendChild(grid);
}

function updatePrompt() {
  var list = getFiltered();
  var t = getThreshold();
  var filter = document.getElementById('filterType').value;
  var parts = ['Disk usage report for learn2improve (Arch Linux):'];
  var warnings = list.filter(function(f) { return t > 0 && f.pct >= t && f.usedB > 0; });

  if (warnings.length > 0) {
    parts.push('\n' + warnings.length + ' filesystem(s) above ' + t + '% threshold:');
    warnings.forEach(function(f) {
      parts.push('  - ' + f.label + ': ' + f.pct.toFixed(1) + '% used (' + fmtBytes(f.usedB) + ' of ' + fmtBytes(f.sizeB) + ')');
    });
  }

  parts.push('\nFilesystem summary (' + (filter === 'all' ? 'all' : filter) + '):');
  list.forEach(function(f) {
    if (f.usedB > 0) parts.push('  ' + f.label + ' [' + f.mount + ']: ' + f.pct.toFixed(1) + '% \u2014 ' + fmtBytes(f.usedB) + ' used, ' + fmtBytes(f.availB) + ' free');
  });

  if (state.selected) {
    var f = filesystems.find(function(x) { return x.dev === state.selected; });
    if (f) parts.push('\nSelected: ' + f.label + ' (' + f.dev + ', ' + f.fstype + ', mounted at ' + f.mount + ')');
  }

  document.getElementById('promptText').textContent = parts.join('\n');
}

/* --- Controls --- */

function setView(v) {
  state.view = v;
  document.getElementById('viewBars').classList.toggle('active', v === 'bars');
  document.getElementById('viewDonut').classList.toggle('active', v === 'donut');
  document.getElementById('barsView').style.display = v === 'bars' ? '' : 'none';
  document.getElementById('donutView').style.display = v === 'donut' ? '' : 'none';
  render();
}

function setUnit(u) {
  state.unit = u;
  document.getElementById('unitHuman').classList.toggle('active', u === 'human');
  document.getElementById('unitGB').classList.toggle('active', u === 'gb');
  document.getElementById('unitBytes').classList.toggle('active', u === 'bytes');
  render();
}

function setDonutMode(mode) {
  state.donutMode = mode;
  document.getElementById('donutCapacity').classList.toggle('active', mode === 'capacity');
  document.getElementById('donutDetail').classList.toggle('active', mode === 'detail');
  document.getElementById('donutUsed').classList.toggle('active', mode === 'used');
  render();
}

function togglePrompt() {
  state.promptOpen = !state.promptOpen;
  document.getElementById('promptContent').classList.toggle('visible', state.promptOpen);
  document.getElementById('promptArrow').classList.toggle('open', state.promptOpen);
}

function copyPrompt() {
  navigator.clipboard.writeText(document.getElementById('promptText').textContent).then(function() {
    var btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  });
}

function render() {
  renderSummary();
  renderBars();
  renderDonut();
  renderDetail();
  updatePrompt();
}

/* --- Init --- */
fetchData();
setRefreshInterval();
