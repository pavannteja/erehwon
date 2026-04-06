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
    el.textContent = 'Saved Successfully!';
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
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }

  function syncRemoveButtons(stack) {
    var rows = stack.querySelectorAll('.pd-repeat-row');
    var show = rows.length >= 2;
    rows.forEach(function (row) {
      var btn = row.querySelector('.pd-repeat-remove');
      if (!btn) return;
      btn.style.display = show ? 'flex' : 'none';
      btn.disabled = !show;
    });
  }

  function syncRequiredFirst(stack) {
    var textareas = stack.querySelectorAll('textarea');
    textareas.forEach(function (ta, idx) {
      if (idx === 0) ta.setAttribute('required', 'required');
      else ta.removeAttribute('required');
    });
  }

  function createRow(name, placeholder) {
    var row = document.createElement('div');
    row.className = 'pd-repeat-row';
    var shell = document.createElement('div');
    shell.className = 'pd-repeat-row-shell pd-repeat-row-shell--close-inside';
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'pd-repeat-remove';
    var icon = document.createElement('img');
    icon.src = '/images/challenge-intent-close.png';
    icon.alt = '';
    icon.className = 'pd-repeat-remove__icon';
    icon.width = 13;
    icon.height = 13;
    icon.setAttribute('aria-hidden', 'true');
    remove.appendChild(icon);
    var textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.name = name;
    textarea.rows = 4;
    textarea.placeholder = placeholder;
    shell.appendChild(remove);
    shell.appendChild(textarea);
    row.appendChild(shell);
    return row;
  }

  function initRepeatSection(section) {
    if (!section || section.dataset.solutionRepeatBound) return;
    section.dataset.solutionRepeatBound = '1';
    var field = section.getAttribute('data-field');
    var stack = section.querySelector('.pd-repeat-stack');
    var plusBtn = section.querySelector('.solution-add-btn');
    var placeholder = section.getAttribute('data-placeholder') || '';
    if (!field || !stack || !plusBtn) return;
    var name = field + '[]';

    function refresh() {
      syncRemoveButtons(stack);
      syncRequiredFirst(stack);
    }

    plusBtn.addEventListener('click', function () {
      var row = createRow(name, placeholder);
      stack.appendChild(row);
      refresh();
      var ta = row.querySelector('textarea');
      if (ta) ta.focus();
    });

    stack.addEventListener('click', function (e) {
      var btn = e.target.closest('.pd-repeat-remove');
      if (!btn || !stack.contains(btn) || btn.disabled) return;
      var row = btn.closest('.pd-repeat-row');
      if (!row) return;
      row.remove();
      refresh();
    });

    refresh();
  }

  function updatePills(data) {
    var blueprint = document.querySelector('[data-solution-pill="blueprint"]');
    var marketLogic = document.querySelector('[data-solution-pill="marketLogic"]');
    var executionRoadmap = document.querySelector('[data-solution-pill="executionRoadmap"]');
    if (!blueprint || !marketLogic || !executionRoadmap) return;

    function setDot(el, submitted, activeKey, key) {
      el.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
      if (submitted) el.classList.add('groundwork-tab-dot--complete');
      else if (activeKey === key) el.classList.add('groundwork-tab-dot--current');
      else el.classList.add('groundwork-tab-dot--pending');
    }

    setDot(blueprint, !!data.conceptualSolutionBlueprintSubmitted, 'marketLogic', 'blueprint');
    setDot(marketLogic, !!data.conceptualSolutionMarketLogicSubmitted, 'marketLogic', 'marketLogic');
    setDot(executionRoadmap, !!data.conceptualSolutionExecutionRoadmapSubmitted, 'marketLogic', 'executionRoadmap');
  }

  document.querySelectorAll('.solution-market-repeat').forEach(initRepeatSection);

  var form = document.querySelector('form.solution-market-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();

    var requiredNames = [
      'competitors[]',
      'competitorAdvantage[]',
      'ourEdge[]',
      'whoPays[]',
      'revenueModel[]',
      'pricingStrategy[]'
    ];

    var allHaveValue = requiredNames.every(function (name) {
      var values = Array.prototype.map.call(form.querySelectorAll('textarea[name="' + name + '"]'), function (el) {
        return trim(el.value);
      }).filter(Boolean);
      return values.length > 0;
    });

    if (!allHaveValue) {
      window.alert('Please fill at least one answer in each Market Logic section before submitting.');
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    var start = Date.now();
    setButtonLoading(submitBtn, true);

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
          var msg = ref.data && ref.data.error ? ref.data.error : 'Could not save. Please try again.';
          window.alert(msg);
          return;
        }
        var elapsed = Date.now() - start;
        var waitMore = Math.max(0, MIN_LOADING_MS - elapsed);
        return new Promise(function (resolve) {
          setTimeout(resolve, waitMore);
        }).then(function () {
          updatePills(ref.data);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(showSavedToast, 150);
        });
      })
      .catch(function () {
        window.alert('Network error. Please try again.');
      })
      .finally(function () {
        setButtonLoading(submitBtn, false);
      });
  });
})();
