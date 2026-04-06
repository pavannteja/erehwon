(function () {
  'use strict';

  function syncStakeRemove(stack) {
    var rows = stack.querySelectorAll('.pd-sm-stake-row');
    var show = rows.length >= 2;
    rows.forEach(function (row) {
      var btn = row.querySelector('.pd-sm-stake-remove');
      if (!btn) return;
      btn.style.display = show ? 'flex' : 'none';
      btn.disabled = !show;
    });
  }

  function syncStakeRequired(stack, optionalCat) {
    var rows = stack.querySelectorAll('.pd-sm-stake-row');
    rows.forEach(function (row, ri) {
      row.querySelectorAll('textarea').forEach(function (el) {
        if (!optionalCat && ri === 0) {
          el.setAttribute('required', 'required');
        } else {
          el.removeAttribute('required');
        }
      });
    });
  }

  function syncContactHidden(optionEl) {
    var cb = optionEl.querySelector('.pd-sm-contact-box-input');
    var hid = optionEl.querySelector('.pd-sm-contact-hidden');
    if (!cb || !hid) return;
    hid.value = cb.checked ? '1' : '0';
  }

  function bindContactStack(scope) {
    (scope || document).querySelectorAll('.pd-sm-contact-option').forEach(function (opt) {
      var cb = opt.querySelector('.pd-sm-contact-box-input');
      if (!cb || cb.dataset.pdSmContactBound) return;
      cb.dataset.pdSmContactBound = '1';
      cb.addEventListener('change', function () {
        syncContactHidden(opt);
      });
      syncContactHidden(opt);
    });
  }

  function resetContactStackToDefault(row) {
    if (!row) return;
    var opts = row.querySelectorAll('.pd-sm-contact-option');
    opts.forEach(function (opt, i) {
      var cb = opt.querySelector('.pd-sm-contact-box-input');
      if (!cb) return;
      delete cb.dataset.pdSmContactBound;
      cb.checked = i === 0;
      syncContactHidden(opt);
    });
    bindContactStack(row);
  }

  function formatLogDate(iso) {
    if (!iso || typeof iso !== 'string') return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var day = parseInt(p[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(day)) return iso;
    var d = new Date(y, m, day);
    if (d.getFullYear() !== y || d.getMonth() !== m || d.getDate() !== day) return iso;
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function syncLogDateText(inp) {
    var wrap = inp.closest('.pd-sm-date-field');
    if (!wrap) return;
    var span = wrap.querySelector('.pd-sm-date-text');
    if (!span) return;
    var v = (inp.value || '').trim();
    span.textContent = v ? formatLogDate(v) : '';
  }

  function bindLogDateInput(inp) {
    if (!inp || inp.dataset.pdSmDateBound) return;
    inp.dataset.pdSmDateBound = '1';
    function sync() {
      syncLogDateText(inp);
    }
    inp.addEventListener('change', sync);
    inp.addEventListener('input', sync);
    sync();
  }

  function initLogDateFields(root) {
    if (!root) return;
    root.querySelectorAll('.pd-sm-date-field input[type="date"]').forEach(bindLogDateInput);
  }

  function syncLogSectionRemove(section) {
    var stack = section.querySelector('.pd-sm-log-section-rows');
    if (!stack) return;
    var rows = stack.querySelectorAll('.pd-sm-log-block');
    var show = rows.length >= 2;
    rows.forEach(function (block) {
      var btn = block.querySelector('.pd-sm-log-remove');
      if (!btn) return;
      btn.style.display = show ? 'flex' : 'none';
      btn.disabled = !show;
    });
  }

  function refreshLogSectionAria(section) {
    var label = section.getAttribute('data-log-label') || 'Interaction';
    section.querySelectorAll('.pd-sm-log-block').forEach(function (block, ri) {
      var n = ri + 1;
      var tail = ', ' + label + ', row ' + n;
      var org = block.querySelector('textarea[name$="_organization[]"]');
      if (org) org.setAttribute('aria-label', 'Organization or person' + tail);
      var obj = block.querySelector('textarea[name$="_objective[]"]');
      if (obj) obj.setAttribute('aria-label', 'Objective' + tail);
      var take = block.querySelector('textarea[name$="_takeaways[]"]');
      if (take) take.setAttribute('aria-label', 'Key takeaways' + tail);
      var d = block.querySelector('input[type="date"]');
      if (d) d.setAttribute('aria-label', 'Date' + tail);
      var pill = block.querySelector('.pd-sm-date-pill');
      if (pill) pill.setAttribute('aria-label', 'Select date' + tail);
    });
  }

  function initLogSection(section) {
    var rows = section.querySelector('.pd-sm-log-section-rows');
    var addBtn = section.querySelector('[data-pd-sm-log-add]');
    if (!rows || !addBtn) return;

    syncLogSectionRemove(section);
    refreshLogSectionAria(section);

    addBtn.addEventListener('click', function () {
      var last = rows.querySelector('.pd-sm-log-block:last-child');
      if (!last) return;
      var clone = last.cloneNode(true);
      clone.querySelectorAll('textarea').forEach(function (ta) {
        ta.value = '';
        ta.removeAttribute('required');
      });
      clone.querySelectorAll('input[type="date"]').forEach(function (inp) {
        delete inp.dataset.pdSmDateBound;
        inp.value = '';
      });
      clone.querySelectorAll('.pd-sm-date-text').forEach(function (span) {
        span.textContent = '';
      });
      rows.appendChild(clone);
      initLogDateFields(clone);
      syncLogSectionRemove(section);
      refreshLogSectionAria(section);
      var f = clone.querySelector('textarea');
      if (f) f.focus();
    });

    rows.addEventListener('click', function (e) {
      var btn = e.target.closest('.pd-sm-log-remove');
      if (!btn || !rows.contains(btn) || btn.disabled) return;
      var block = btn.closest('.pd-sm-log-block');
      if (!block || !rows.contains(block)) return;
      block.remove();
      syncLogSectionRemove(section);
      refreshLogSectionAria(section);
    });
  }

  function bindLogDatePills(stack) {
    if (!stack) return;
    stack.addEventListener('click', function (e) {
      var pill = e.target.closest('.pd-sm-date-pill');
      if (!pill || !stack.contains(pill)) return;
      var wrap = pill.closest('.pd-sm-date-field');
      var inp = wrap && wrap.querySelector('input[type="date"]');
      if (!inp) return;
      e.preventDefault();
      if (typeof inp.showPicker === 'function') {
        try {
          inp.showPicker();
        } catch (err) {
          inp.click();
        }
      } else {
        inp.click();
      }
    });
  }

  document.querySelectorAll('.pd-sm-stake-category').forEach(function (cat) {
    var base = cat.getAttribute('data-base');
    var optionalCat = cat.getAttribute('data-optional') === '1';
    var stack = cat.querySelector('.pd-sm-stake-stack');
    var addBtn = cat.querySelector('.pd-add-field');
    if (!stack || !addBtn || !base) return;

    syncStakeRemove(stack);
    syncStakeRequired(stack, optionalCat);
    bindContactStack(stack);

    addBtn.addEventListener('click', function () {
      var last = stack.querySelector('.pd-sm-stake-row:last-child');
      if (!last) return;
      var clone = last.cloneNode(true);
      clone.querySelectorAll('textarea').forEach(function (ta) {
        ta.value = '';
        ta.removeAttribute('required');
      });
      clone.querySelectorAll('.pd-sm-contact-box-input').forEach(function (cb) {
        delete cb.dataset.pdSmContactBound;
      });
      resetContactStackToDefault(clone);
      stack.appendChild(clone);
      syncStakeRemove(stack);
      syncStakeRequired(stack, optionalCat);
      var f = clone.querySelector('textarea');
      if (f) f.focus();
    });

    stack.addEventListener('click', function (e) {
      var btn = e.target.closest('.pd-sm-stake-remove');
      if (!btn || !stack.contains(btn) || btn.disabled) return;
      var row = btn.closest('.pd-sm-stake-row');
      if (!row || !stack.contains(row)) return;
      row.remove();
      syncStakeRemove(stack);
      syncStakeRequired(stack, optionalCat);
    });
  });

  var logRoot = document.querySelector('.pd-sm-section--log');
  if (logRoot) {
    bindLogDatePills(logRoot);
    initLogDateFields(logRoot);
    logRoot.querySelectorAll('.pd-sm-log-section').forEach(initLogSection);
  }
})();
