(function () {
  'use strict';

  var MIN_LOADING_MS = 2000;

  function trim(v) {
    return (v == null ? '' : String(v)).trim();
  }

  function ensureToastEl() {
    var el = document.getElementById('mission-launch-saved-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mission-launch-saved-toast';
      el.className = 'mission-launch-saved-toast';
      el.setAttribute('role', 'status');
      el.textContent = 'Saved Successfully!';
      document.body.appendChild(el);
    }
    return el;
  }

  function showSavedToast() {
    var el = ensureToastEl();
    el.classList.remove('mission-launch-saved-toast--hide');
    el.classList.add('mission-launch-saved-toast--show');
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      el.classList.remove('mission-launch-saved-toast--show');
      el.classList.add('mission-launch-saved-toast--hide');
    }, 5000);
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('groundwork-submit-btn--loading', loading);
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function parseJson(text) {
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
  }

  function initSimpleRepeat(section) {
    if (!section || section.dataset.solutionRepeatBound) return;
    section.dataset.solutionRepeatBound = '1';
    var field = section.getAttribute('data-field');
    var stack = section.querySelector('.pd-repeat-stack');
    var plus = section.querySelector('.solution-add-btn');
    var placeholder = section.getAttribute('data-placeholder') || '';
    if (!field || !stack || !plus) return;
    var name = field + '[]';

    function sync() {
      var rows = stack.querySelectorAll('.pd-repeat-row');
      var show = rows.length >= 2;
      rows.forEach(function (row, idx) {
        var remove = row.querySelector('.pd-repeat-remove');
        if (remove) {
          remove.style.display = show ? 'flex' : 'none';
          remove.disabled = !show;
        }
        var ta = row.querySelector('textarea');
        if (ta) {
          if (idx === 0) ta.setAttribute('required', 'required');
          else ta.removeAttribute('required');
        }
      });
    }

    plus.addEventListener('click', function () {
      var row = document.createElement('div');
      row.className = 'pd-repeat-row';
      row.innerHTML = ''
        + '<div class="pd-repeat-row-shell pd-repeat-row-shell--close-inside">'
        + '  <button type="button" class="pd-repeat-remove">'
        + '    <img src="/images/challenge-intent-close.png" alt="" class="pd-repeat-remove__icon" width="13" height="13" aria-hidden="true">'
        + '  </button>'
        + '  <textarea class="form-control" name="' + name + '" rows="4" placeholder="' + placeholder.replace(/"/g, '&quot;') + '"></textarea>'
        + '</div>';
      if (plus.parentElement === stack) {
        stack.insertBefore(row, plus);
      } else {
        stack.appendChild(row);
      }
      sync();
      var ta = row.querySelector('textarea');
      if (ta) ta.focus();
    });

    stack.addEventListener('click', function (e) {
      var remove = e.target.closest('.pd-repeat-remove');
      if (!remove || !stack.contains(remove) || remove.disabled) return;
      var row = remove.closest('.pd-repeat-row');
      if (row) row.remove();
      sync();
    });

    sync();
  }

  function formatDate(iso) {
    if (!iso || typeof iso !== 'string') return '';
    var p = iso.split('-');
    if (p.length !== 3) return '';
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
    var dt = new Date(y, m, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return '';
    try {
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function bindDateField(wrap) {
    if (!wrap || wrap.dataset.roadmapDateBound) return;
    var input = wrap.querySelector('.pd-sm-date-native');
    var pill = wrap.querySelector('.pd-sm-date-pill');
    var text = wrap.querySelector('.pd-sm-date-text');
    if (!input || !pill || !text) return;
    wrap.dataset.roadmapDateBound = '1';

    function syncText() {
      text.textContent = input.value ? formatDate(input.value) : '';
    }

    pill.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker();
        } catch (err) {
          input.click();
        }
      } else {
        input.click();
      }
    });

    input.addEventListener('change', syncText);
    input.addEventListener('input', syncText);
    syncText();
  }

  function bindAllDateFields(scope) {
    (scope || document).querySelectorAll('.solution-roadmap-date-field').forEach(bindDateField);
  }

  function syncDevRows() {
    var list = document.querySelector('.solution-roadmap-dev-grid');
    if (!list) return;
    var rows = list.querySelectorAll('.solution-roadmap-dev-item');
    var show = rows.length >= 2;
    rows.forEach(function (row, idx) {
      var idxNode = row.querySelector('.solution-roadmap-dev-index');
      if (idxNode) idxNode.textContent = (idx + 1) + '.';
      row.querySelectorAll('.pd-repeat-remove').forEach(function (btn) {
        btn.style.display = show ? 'flex' : 'none';
        btn.disabled = !show;
      });
      var step = row.querySelector('textarea[name="developmentPlanSteps[]"]');
      var date = row.querySelector('.pd-sm-date-native[name="developmentPlanCompletionDates[]"]');
      if (step) idx === 0 ? step.setAttribute('required', 'required') : step.removeAttribute('required');
      if (date) idx === 0 ? date.setAttribute('required', 'required') : date.removeAttribute('required');
    });
  }

  function initDevRows() {
    var add = document.querySelector('[data-roadmap-dev-add]');
    var list = document.querySelector('.solution-roadmap-dev-grid');
    if (!add || !list) return;

    add.addEventListener('click', function () {
      var row = document.createElement('article');
      row.className = 'solution-roadmap-dev-item';
      row.innerHTML = ''
        + '<div class="solution-roadmap-dev-item-head">'
        + '  <span class="solution-roadmap-dev-index">1.</span>'
        + '  <div class="pd-repeat-row-shell pd-repeat-row-shell--close-inside">'
        + '    <button type="button" class="pd-repeat-remove"><img src="/images/challenge-intent-close.png" alt="" class="pd-repeat-remove__icon" width="13" height="13" aria-hidden="true"></button>'
        + '    <textarea class="form-control" name="developmentPlanSteps[]" rows="4" placeholder="e.g., Finalizing circuit design and sourcing  housing materials."></textarea>'
        + '  </div>'
        + '</div>'
        + '<label class="solution-roadmap-date-label">Completion Date</label>'
        + '<div class="pd-sm-date-field solution-roadmap-date-field">'
        + '  <button type="button" class="pd-sm-date-pill">Select Date</button>'
        + '  <span class="pd-sm-date-text" aria-hidden="true"></span>'
        + '  <input type="date" class="form-control pd-sm-date-native" name="developmentPlanCompletionDates[]" tabindex="-1">'
        + '</div>';
      list.insertBefore(row, add);
      bindAllDateFields(row);
      syncDevRows();
    });

    list.addEventListener('click', function (e) {
      var remove = e.target.closest('.pd-repeat-remove');
      if (!remove || remove.disabled) return;
      var row = remove.closest('.solution-roadmap-dev-item');
      if (row) row.remove();
      syncDevRows();
    });

    bindAllDateFields(list);
    syncDevRows();
  }

  function syncFinanceRows() {
    var list = document.querySelector('.solution-roadmap-finance-list');
    if (!list) return;
    var blocks = list.querySelectorAll('.solution-roadmap-finance-block');
    var show = blocks.length >= 2;
    blocks.forEach(function (block, idx) {
      var row = block.querySelector('.solution-roadmap-finance-row');
      if (!row) return;
      var idxNode = block.querySelector('.solution-roadmap-finance-index');
      if (idxNode) idxNode.textContent = (idx + 1) + '.';
      var removeBtn = block.querySelector('.solution-roadmap-finance-remove');
      if (removeBtn) {
        removeBtn.style.display = show ? 'flex' : 'none';
        removeBtn.disabled = !show;
      }
      var comp = block.querySelector('input[name="financeComponents[]"]');
      var cost = block.querySelector('input[name="financeComponentCosts[]"]');
      if (comp) idx === 0 ? comp.setAttribute('required', 'required') : comp.removeAttribute('required');
      if (cost) idx === 0 ? cost.setAttribute('required', 'required') : cost.removeAttribute('required');
    });
  }

  function initFinanceRows() {
    var add = document.querySelector('[data-roadmap-finance-add]');
    var list = document.querySelector('.solution-roadmap-finance-list');
    if (!add || !list) return;

    add.addEventListener('click', function () {
      var block = document.createElement('div');
      block.className = 'solution-roadmap-finance-block';
      block.innerHTML = ''
        + '<div class="solution-roadmap-finance-remove-strip">'
        + '  <button type="button" class="solution-roadmap-finance-remove pd-repeat-remove" aria-label="Remove this finance row">'
        + '    <img src="/images/challenge-intent-close.png" alt="" class="pd-repeat-remove__icon" width="13" height="13" aria-hidden="true">'
        + '  </button>'
        + '</div>'
        + '<div class="solution-roadmap-finance-row">'
        + '  <div class="solution-roadmap-finance-index">1.</div>'
        + '  <div class="pd-repeat-row-shell pd-repeat-row-shell--close-inside">'
        + '    <input class="form-control" type="text" name="financeComponents[]" placeholder="e.g., Circuit Boards">'
        + '  </div>'
        + '  <div class="solution-roadmap-rs">Rs.</div>'
        + '  <div class="pd-repeat-row-shell pd-repeat-row-shell--close-inside">'
        + '    <input class="form-control" type="text" name="financeComponentCosts[]" placeholder="e.g., ₹400">'
        + '  </div>'
        + '</div>';
      list.appendChild(block);
      syncFinanceRows();
    });

    list.addEventListener('click', function (e) {
      var remove = e.target.closest('.solution-roadmap-finance-remove');
      if (!remove || remove.disabled) return;
      var block = remove.closest('.solution-roadmap-finance-block');
      if (block) block.remove();
      syncFinanceRows();
    });

    syncFinanceRows();
  }

  function updatePills(data) {
    var map = [
      ['blueprint', !!data.conceptualSolutionBlueprintSubmitted, 'pending'],
      ['marketLogic', !!data.conceptualSolutionMarketLogicSubmitted, 'pending'],
      ['executionRoadmap', !!data.conceptualSolutionExecutionRoadmapSubmitted, 'current']
    ];
    map.forEach(function (item) {
      var dot = document.querySelector('[data-solution-pill="' + item[0] + '"]');
      if (!dot) return;
      dot.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
      if (item[1]) dot.classList.add('groundwork-tab-dot--complete');
      else dot.classList.add(item[2] === 'current' ? 'groundwork-tab-dot--current' : 'groundwork-tab-dot--pending');
    });
  }

  document.querySelectorAll('.solution-roadmap-repeat').forEach(initSimpleRepeat);
  initDevRows();
  initFinanceRows();

  var form = document.querySelector('form.solution-roadmap-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var requiredOk = [
      'targetUsersForTesting[]',
      'keyFeaturesToBeBuilt[]',
      'developmentPlanSteps[]',
      'developmentPlanCompletionDates[]',
      'financeComponents[]',
      'financeComponentCosts[]'
    ].every(function (name) {
      var nodes = form.querySelectorAll('[name="' + name + '"]');
      var has = Array.prototype.some.call(nodes, function (n) { return !!trim(n.value); });
      return has;
    });
    var scalarOk =
      !!trim((form.querySelector('[name="prototypeCost"]') || {}).value) &&
      !!trim((form.querySelector('[name="marketLaunchPrice"]') || {}).value) &&
      !!trim((form.querySelector('[name="unitMargin"]') || {}).value);
    if (!requiredOk || !scalarOk) {
      window.alert('Please fill all roadmap sections before saving.');
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var start = Date.now();
    setButtonLoading(btn, true);

    fetch(form.getAttribute('action'), {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { ok: res.ok, data: parseJson(text) };
        });
      })
      .then(function (ref) {
        if (!ref.ok || !ref.data || !ref.data.ok) {
          window.alert((ref.data && ref.data.error) || 'Could not save. Please try again.');
          return;
        }
        var elapsed = Date.now() - start;
        var waitMore = Math.max(0, MIN_LOADING_MS - elapsed);
        return new Promise(function (resolve) { setTimeout(resolve, waitMore); }).then(function () {
          updatePills(ref.data);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(showSavedToast, 150);
        });
      })
      .catch(function () {
        window.alert('Network error. Please try again.');
      })
      .finally(function () {
        setButtonLoading(btn, false);
      });
  });
})();
