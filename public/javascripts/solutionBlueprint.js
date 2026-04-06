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

  function getRows(stack) {
    return stack.querySelectorAll('.solution-repeat-row');
  }

  function syncRemoveButtons(stack) {
    var rows = getRows(stack);
    var show = rows.length >= 2;
    rows.forEach(function (row) {
      var btn = row.querySelector('.pd-repeat-remove');
      if (!btn) return;
      btn.style.display = show ? 'flex' : 'none';
      btn.disabled = !show;
    });
  }

  function syncIndices(stack, showIndex) {
    var rows = getRows(stack);
    rows.forEach(function (row, idx) {
      var index = row.querySelector('.solution-repeat-row-index');
      if (!index) return;
      if (!showIndex) {
        index.textContent = '';
        return;
      }
      index.textContent = (idx + 1) + '.';
    });
  }

  function syncRequiredFirstTextarea(stack) {
    var textareas = stack.querySelectorAll('.solution-repeat-row textarea');
    textareas.forEach(function (ta, idx) {
      if (idx === 0) ta.setAttribute('required', 'required');
      else ta.removeAttribute('required');
    });
  }

  function createRepeatRow(name, placeholder, showIndex, label) {
    var row = document.createElement('div');
    row.className = 'pd-repeat-row solution-repeat-row';

    if (showIndex) {
      var index = document.createElement('div');
      index.className = 'solution-repeat-row-index';
      index.textContent = label || '1.';
      row.appendChild(index);
    }

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
    shell.appendChild(remove);

    var textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.name = name;
    textarea.rows = 4;
    textarea.placeholder = placeholder;
    shell.appendChild(textarea);

    row.appendChild(shell);

    return row;
  }

  function initRepeatSection(section) {
    if (!section || section.dataset.solutionRepeatBound) return;
    section.dataset.solutionRepeatBound = '1';
    var stack = section.querySelector('.pd-repeat-stack');
    if (!stack) return;
    var field = section.getAttribute('data-field');
    if (!field) return;
    var showIndex = String(section.getAttribute('data-show-index')) === '1';
    var name = field + '[]';
    var placeholder = section.getAttribute('data-placeholder') || '';
    var plusBtn = section.querySelector('.solution-add-btn.solution-plus-btn--grid');
    if (!plusBtn) return;

    function refresh() {
      syncIndices(stack, showIndex);
      syncRemoveButtons(stack);
      syncRequiredFirstTextarea(stack);
    }

    section.addEventListener('click', function (e) {
      var plus = e.target.closest('.solution-add-btn.solution-plus-btn--grid');
      if (plus && plus === plusBtn) {
        var nextLabel = (getRows(stack).length + 1) + '.';
        var row = createRepeatRow(name, placeholder, showIndex, nextLabel);
        stack.insertBefore(row, plusBtn);
        refresh();
        var ta = row.querySelector('textarea');
        if (ta) ta.focus();
        return;
      }

      var remove = e.target.closest('.pd-repeat-remove');
      if (remove && section.contains(remove) && !remove.disabled) {
        var rowToRemove = remove.closest('.solution-repeat-row');
        if (rowToRemove) {
          rowToRemove.remove();
          refresh();
        }
      }
    });

    refresh();
  }

  function parseJson(text) {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }

  function updatePills(data) {
    var map = [
      ['blueprint', !!(data && data.conceptualSolutionBlueprintSubmitted)],
      ['marketLogic', !!(data && data.conceptualSolutionMarketLogicSubmitted)],
      ['executionRoadmap', !!(data && data.conceptualSolutionExecutionRoadmapSubmitted)]
    ];

    map.forEach(function (entry) {
      var key = entry[0];
      var submitted = entry[1];
      var dot = document.querySelector('[data-solution-pill="' + key + '"]');
      if (!dot) return;
      dot.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
      if (submitted) dot.classList.add('groundwork-tab-dot--complete');
      else if (key === 'blueprint') dot.classList.add('groundwork-tab-dot--current');
      else dot.classList.add('groundwork-tab-dot--pending');
    });
  }

  document.querySelectorAll('.solution-repeat-section').forEach(initRepeatSection);

  var form = document.querySelector('form.solution-blueprint-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();

    var keyFeatures = Array.prototype.map.call(form.querySelectorAll('textarea[name="keyFeatures[]"]'), function (el) {
      return trim(el.value);
    }).filter(Boolean);
    var customerJourney = Array.prototype.map.call(form.querySelectorAll('textarea[name="customerJourney[]"]'), function (el) {
      return trim(el.value);
    }).filter(Boolean);
    var usp = trim(form.querySelector('textarea[name="usp"]') ? form.querySelector('textarea[name="usp"]').value : '');

    if (!keyFeatures.length || !customerJourney.length || !usp) {
      window.alert('Please fill Key Features, USP, and Customer Journey before submitting.');
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    var start = Date.now();
    setButtonLoading(submitBtn, true);

    fetch(form.getAttribute('action'), {
      method: 'POST',
      body: new FormData(form),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json'
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
