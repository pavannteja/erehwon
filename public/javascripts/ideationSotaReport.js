(function () {
  'use strict';

  var MIN_LOADING_MS = 2000;

  var METRICS = [
    {
      key: 'technologyUsed',
      label: 'Technology Used',
      placeholder: 'e.g., OpenCV for image processing'
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      placeholder: 'e.g., 95% success rate under low-light'
    },
    {
      key: 'latency',
      label: 'Latency',
      placeholder: 'e.g., Less than 200ms delay'
    },
    {
      key: 'cost',
      label: 'Cost',
      placeholder: 'e.g., ₹8,500 for initial build; ₹1,200 per unit'
    },
    {
      key: 'powerUse',
      label: 'Power Use',
      placeholder: 'e.g., Operates for 6 months on a single 9V battery'
    },
    {
      key: 'scalability',
      label: 'Scalability',
      placeholder: 'e.g., System can handle 5,000 concurrent users'
    }
  ];

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

  function showSavedToast(message) {
    var el = ensureToastEl();
    el.textContent = message || 'Saved Successfully!';
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

  function parseJsonResponse(text) {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }

  function updateSotaPill(submitted) {
    var pill = document.querySelector('[data-sota-root] .groundwork-tabs .groundwork-tab--active .groundwork-tab-dot');
    if (!pill) return;
    pill.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete');
    pill.classList.add(submitted ? 'groundwork-tab-dot--complete' : 'groundwork-tab-dot--current');
  }

  function emptyMetricMap() {
    return {
      technologyUsed: [],
      accuracy: [],
      latency: [],
      cost: [],
      powerUse: [],
      scalability: []
    };
  }

  function cleanLines(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (v) { return trim(v); }).filter(Boolean);
  }

  function normalizeSolution(raw, fallbackKey, fallbackLabel) {
    var sol = raw && typeof raw === 'object' ? raw : {};
    var out = {
      key: trim(sol.key) || fallbackKey,
      label: trim(sol.label) || fallbackLabel
    };
    METRICS.forEach(function (metric) {
      out[metric.key] = cleanLines(sol[metric.key]);
    });
    return out;
  }

  function normalizeState(raw) {
    var obj = raw && typeof raw === 'object' ? raw : {};
    var solutions = Array.isArray(obj.solutions)
      ? obj.solutions.map(function (row, idx) {
          return normalizeSolution(row, 'solution' + (idx + 1), defaultLabel(idx));
        })
      : [];
    if (!solutions.length) {
      solutions = [normalizeSolution({}, 'solutionA', 'Solution A')];
    }
    var selected = trim(obj.selectedSolutionKey);
    if (!solutions.some(function (s) { return s.key === selected; })) {
      selected = solutions[0].key;
    }

    var your = emptyMetricMap();
    METRICS.forEach(function (metric) {
      your[metric.key] = cleanLines(obj.yourSolution && obj.yourSolution[metric.key]);
    });

    return {
      selectedSolutionKey: selected,
      solutions: solutions,
      yourSolution: your
    };
  }

  function defaultLabel(index) {
    if (index >= 0 && index < 26) return 'Solution ' + String.fromCharCode(65 + index);
    return 'Solution ' + (index + 1);
  }

  function createNextSolution(existing) {
    var nextIndex = existing.length;
    var label = defaultLabel(nextIndex);
    var base = 'solution' + (nextIndex + 1);
    var key = base;
    var suffix = 1;
    while (existing.some(function (s) { return s.key === key; })) {
      key = base + '_' + suffix;
      suffix += 1;
    }
    return normalizeSolution({}, key, label);
  }

  function getSelectedSolution(state) {
    return state.solutions.find(function (s) { return s.key === state.selectedSolutionKey; }) || state.solutions[0];
  }

  function metricValuesForRender(arr) {
    return Array.isArray(arr) && arr.length ? arr.slice() : [''];
  }

  function renderSelect(selectEl, state) {
    selectEl.innerHTML = '';
    state.solutions.forEach(function (solution) {
      var option = document.createElement('option');
      option.value = solution.key;
      option.textContent = solution.label;
      option.selected = solution.key === state.selectedSolutionKey;
      selectEl.appendChild(option);
    });
  }

  function makeMetricSection(metric, target, reRender) {
    var metricKey = metric.key;
    ensureMetricArray(target, metricKey);
    var lines = metricValuesForRender(target[metricKey]);
    var showRemove = lines.length >= 2;

    var section = document.createElement('section');
    section.className = 'ideation-sota-metric';

    var label = document.createElement('h3');
    label.className = 'ideation-sota-metric__label';
    label.textContent = metric.label;
    section.appendChild(label);

    var list = document.createElement('div');
    list.className = 'pd-repeat-stack ideation-sota-repeat-stack';

    lines.forEach(function (value, idx) {
      var row = document.createElement('div');
      row.className = 'pd-repeat-row';

      var shell = document.createElement('div');
      shell.className = 'pd-repeat-row-shell pd-repeat-row-shell--close-inside';

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'pd-repeat-remove';
      rm.setAttribute('aria-label', 'Remove this ' + metric.label + ' entry');
      rm.style.display = showRemove ? 'flex' : 'none';
      rm.disabled = !showRemove;
      var rmImg = document.createElement('img');
      rmImg.src = '/images/challenge-intent-close.png';
      rmImg.alt = '';
      rmImg.className = 'pd-repeat-remove__icon';
      rmImg.width = 13;
      rmImg.height = 13;
      rmImg.setAttribute('aria-hidden', 'true');
      rm.appendChild(rmImg);
      rm.addEventListener('click', function () {
        if (!showRemove) return;
        ensureMetricArray(target, metricKey);
        target[metricKey].splice(idx, 1);
        if (!target[metricKey].length) target[metricKey] = [''];
        reRender();
      });

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control ideation-sota-input';
      input.placeholder = metric.placeholder;
      input.value = value;
      input.addEventListener('input', function () {
        ensureMetricArray(target, metricKey);
        if (!target[metricKey].length) target[metricKey].push('');
        target[metricKey][idx] = trim(input.value);
      });

      shell.appendChild(rm);
      shell.appendChild(input);
      row.appendChild(shell);
      list.appendChild(row);
    });

    section.appendChild(list);

    var addWrap = document.createElement('div');
    addWrap.className = 'pd-add-wrap';
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'pd-add-field';
    addBtn.setAttribute('aria-label', 'Add another ' + metric.label + ' entry');
    var addIcon = document.createElement('img');
    addIcon.src = '/images/challenge-intent-plus.png';
    addIcon.alt = '';
    addIcon.className = 'pd-add-field__icon';
    addIcon.width = 11;
    addIcon.height = 11;
    addIcon.setAttribute('aria-hidden', 'true');
    addBtn.appendChild(addIcon);
    addBtn.addEventListener('click', function () {
      ensureMetricArray(target, metricKey);
      if (!target[metricKey].length) target[metricKey] = [''];
      target[metricKey].push('');
      reRender();
    });
    addWrap.appendChild(addBtn);
    section.appendChild(addWrap);

    return section;
  }

  function ensureMetricArray(target, metricKey) {
    if (!Array.isArray(target[metricKey])) target[metricKey] = [];
  }

  function renderPanel(container, state, type) {
    container.innerHTML = '';
    var target = type === 'existing' ? getSelectedSolution(state) : state.yourSolution;

    function reRender() {
      renderPanel(container, state, type);
    }

    METRICS.forEach(function (metric) {
      ensureMetricArray(target, metric.key);
      var section = makeMetricSection(metric, target, reRender);
      container.appendChild(section);
    });
  }

  function serializeState(state) {
    var copy = {
      selectedSolutionKey: state.selectedSolutionKey,
      solutions: state.solutions.map(function (solution) {
        var out = { key: solution.key, label: solution.label };
        METRICS.forEach(function (metric) {
          out[metric.key] = cleanLines(solution[metric.key]);
        });
        return out;
      }),
      yourSolution: {}
    };
    METRICS.forEach(function (metric) {
      copy.yourSolution[metric.key] = cleanLines(state.yourSolution[metric.key]);
    });
    return copy;
  }

  var root = document.querySelector('[data-sota-root]');
  if (!root) return;

  var stateNode = document.getElementById('sotaInitialState');
  var initial = {};
  try {
    initial = stateNode ? JSON.parse(stateNode.textContent || '{}') : {};
  } catch (e) {
    initial = {};
  }
  var state = normalizeState(initial);

  var selectEl = root.querySelector('[data-sota-select]');
  var addSolutionBtn = root.querySelector('[data-sota-add-solution]');
  var selectedTitleEl = root.querySelector('[data-sota-selected-title]');
  var existingPanel = root.querySelector('[data-sota-existing-panel]');
  var yourPanel = root.querySelector('[data-sota-your-panel]');
  var form = root.querySelector('[data-sota-form]');
  var hiddenField = document.getElementById('sotaPayloadField');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  var deleteSolutionBtn = root.querySelector('[data-ideation-delete-sota-solution]');
  var deleteSolutionModal = document.getElementById('delete-sota-solution-confirm-modal');
  var deleteSolutionCancel = document.getElementById('delete-sota-solution-confirm-cancel');
  var deleteSolutionConfirm = document.getElementById('delete-sota-solution-confirm-delete');

  function syncDeleteSolutionButtonState() {
    if (!deleteSolutionBtn) return;
    var hasMultiple = state.solutions && state.solutions.length >= 2;
    if (hasMultiple) {
      deleteSolutionBtn.removeAttribute('hidden');
      deleteSolutionBtn.disabled = false;
    } else {
      deleteSolutionBtn.setAttribute('hidden', '');
      deleteSolutionBtn.disabled = true;
    }
  }

  function openDeleteSolutionModal() {
    if (!deleteSolutionModal) return;
    deleteSolutionModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteSolutionModal() {
    if (!deleteSolutionModal) return;
    deleteSolutionModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function deleteSelectedSolution() {
    if (!state.solutions || state.solutions.length <= 1) return;
    var idx = state.solutions.findIndex(function (s) { return s.key === state.selectedSolutionKey; });
    if (idx < 0) idx = 0;
    state.solutions.splice(idx, 1);
    if (!state.solutions.length) {
      state.solutions = [normalizeSolution({}, 'solutionA', 'Solution A')];
      state.selectedSolutionKey = state.solutions[0].key;
    } else {
      var nextIdx = Math.max(0, Math.min(idx, state.solutions.length - 1));
      state.selectedSolutionKey = state.solutions[nextIdx].key;
    }
    renderAll();
    syncDeleteSolutionButtonState();
  }

  function renderAll() {
    renderSelect(selectEl, state);
    var selected = getSelectedSolution(state);
    selectedTitleEl.textContent = selected && selected.label ? selected.label : 'Solution';
    renderPanel(existingPanel, state, 'existing');
    renderPanel(yourPanel, state, 'your');
    syncDeleteSolutionButtonState();
  }

  selectEl.addEventListener('change', function () {
    state.selectedSolutionKey = selectEl.value;
    renderAll();
  });

  addSolutionBtn.addEventListener('click', function () {
    var next = createNextSolution(state.solutions);
    state.solutions.push(next);
    state.selectedSolutionKey = next.key;
    renderAll();
  });

  if (deleteSolutionBtn) {
    deleteSolutionBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (deleteSolutionBtn.disabled) return;
      openDeleteSolutionModal();
    });
  }

  if (deleteSolutionCancel) {
    deleteSolutionCancel.addEventListener('click', function () {
      closeDeleteSolutionModal();
    });
  }

  if (deleteSolutionConfirm) {
    deleteSolutionConfirm.addEventListener('click', function () {
      deleteSelectedSolution();
      closeDeleteSolutionModal();
    });
  }

  if (deleteSolutionModal) {
    deleteSolutionModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('delete-confirm-backdrop')) closeDeleteSolutionModal();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    form.classList.remove('was-validated');

    var start = Date.now();
    setButtonLoading(submitBtn, true);

    hiddenField.value = JSON.stringify(serializeState(state));
    var params = new URLSearchParams(new FormData(form));
    params.set('ideationAjax', '1');

    fetch(form.getAttribute('action'), {
      method: 'POST',
      body: params,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { res: res, data: parseJsonResponse(text) };
        });
      })
      .then(function (ref) {
        var res = ref.res;
        var data = ref.data;
        if (!res.ok || !data || !data.ok) {
          var msg = data && data.error ? data.error : 'Could not save. Please try again.';
          window.alert(msg);
          return;
        }
        var elapsed = Date.now() - start;
        var waitMore = Math.max(0, MIN_LOADING_MS - elapsed);
        return new Promise(function (resolve) {
          setTimeout(resolve, waitMore);
        }).then(function () {
          updateSotaPill(!!data.ideationSotaReportSubmitted);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(function () {
            showSavedToast('Saved Successfully!');
          }, 150);
        });
      })
      .catch(function () {
        window.alert('Network error. Please try again.');
      })
      .finally(function () {
        setButtonLoading(submitBtn, false);
      });
  });

  renderAll();
})();
