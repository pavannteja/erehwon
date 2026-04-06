(function () {
  'use strict';

  var MIN_LOADING_MS = 2000;

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

  function updateAnalysisPills(data, page) {
    var insight = document.querySelector('[data-analysis-pill="insight"]');
    var synthesis = document.querySelector('[data-analysis-pill="synthesis"]');
    var statement = document.querySelector('[data-analysis-pill="statement"]');
    if (!insight || !synthesis || !statement) return;

    function setDot(el, submitted, activePage, step) {
      el.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
      if (submitted) {
        el.classList.add('groundwork-tab-dot--complete');
      } else if (activePage === step) {
        el.classList.add('groundwork-tab-dot--current');
      } else {
        el.classList.add('groundwork-tab-dot--pending');
      }
    }

    setDot(insight, !!data.analysisInsightRecordsSubmitted, page, 'insight');
    setDot(synthesis, !!data.analysisSynthesisPrioritisationSubmitted, page, 'synthesis');
    setDot(statement, !!data.analysisProblemStatementSubmitted, page, 'statement');
  }

  function parseJsonResponse(text) {
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

  function syncFirstRequired(stack) {
    var textareas = stack.querySelectorAll('textarea');
    textareas.forEach(function (ta, i) {
      if (i === 0) ta.setAttribute('required', 'required');
      else ta.removeAttribute('required');
    });
  }

  function createRow(name, placeholder) {
    var row = document.createElement('div');
    row.className = 'pd-repeat-row mb-2';
    var shell = document.createElement('div');
    shell.className = 'pd-repeat-row-shell pd-repeat-row-shell--close-inside';
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'pd-repeat-remove';
    rm.setAttribute('aria-label', 'Remove this answer');
    var rmImg = document.createElement('img');
    rmImg.src = '/images/challenge-intent-close.png';
    rmImg.alt = '';
    rmImg.className = 'pd-repeat-remove__icon';
    rmImg.width = 13;
    rmImg.height = 13;
    rmImg.setAttribute('aria-hidden', 'true');
    rm.appendChild(rmImg);
    var ta = document.createElement('textarea');
    ta.className = 'form-control';
    ta.setAttribute('name', name);
    ta.setAttribute('rows', '4');
    ta.setAttribute('placeholder', placeholder);
    shell.appendChild(rm);
    shell.appendChild(ta);
    row.appendChild(shell);
    return row;
  }

  function initRepeatSections(scope) {
    (scope || document).querySelectorAll('.pd-repeat-section').forEach(function (section) {
      if (section.dataset.analysisRepeatBound) return;
      section.dataset.analysisRepeatBound = '1';

      var field = section.getAttribute('data-field');
      var placeholder = section.getAttribute('data-placeholder') || '';
      var stack = section.querySelector('.pd-repeat-stack');
      var addBtn = section.querySelector('.pd-add-field');
      if (!stack || !addBtn || !field) return;
      var name = field + '[]';

      syncRemoveButtons(stack);
      syncFirstRequired(stack);

      addBtn.addEventListener('click', function () {
        var row = createRow(name, placeholder);
        stack.appendChild(row);
        syncRemoveButtons(stack);
        syncFirstRequired(stack);
        var ta = row.querySelector('textarea');
        if (ta) ta.focus();
      });

      stack.addEventListener('click', function (e) {
        var btn = e.target.closest('.pd-repeat-remove');
        if (!btn || !stack.contains(btn) || btn.disabled) return;
        var row = btn.closest('.pd-repeat-row');
        if (!row || !stack.contains(row)) return;
        row.remove();
        syncRemoveButtons(stack);
        syncFirstRequired(stack);
      });
    });
  }

  function bindAccordion(root) {
    if (!root || root.dataset.analysisAccordionBound) return;
    var toggle = root.querySelector('[data-analysis-accordion-toggle]');
    var content = root.querySelector('[data-analysis-accordion-content]');
    if (!toggle || !content) return;
    root.dataset.analysisAccordionBound = '1';

    var transitionLock = false;
    function setExpanded(expanded, animate) {
      if (transitionLock) return;
      transitionLock = true;
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      root.classList.toggle('analysis-ir-accordion--collapsed', !expanded);

      if (!animate) {
        content.hidden = !expanded;
        content.style.maxHeight = expanded ? 'none' : '0px';
        transitionLock = false;
        return;
      }
      if (expanded) {
        content.hidden = false;
        content.style.maxHeight = '0px';
        requestAnimationFrame(function () {
          content.style.maxHeight = content.scrollHeight + 'px';
        });
        var onExpandEnd = function (ev) {
          if (ev.target !== content || ev.propertyName !== 'max-height') return;
          content.style.maxHeight = 'none';
          content.removeEventListener('transitionend', onExpandEnd);
          transitionLock = false;
        };
        content.addEventListener('transitionend', onExpandEnd);
        return;
      }
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(function () {
        content.style.maxHeight = '0px';
      });
      var onCollapseEnd = function (ev) {
        if (ev.target !== content || ev.propertyName !== 'max-height') return;
        content.hidden = true;
        content.removeEventListener('transitionend', onCollapseEnd);
        transitionLock = false;
      };
      content.addEventListener('transitionend', onCollapseEnd);
    }

    setExpanded(true, false);
    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      setExpanded(!expanded, true);
    });
  }

  function initInsightAccordion() {
    document.querySelectorAll('[data-analysis-accordion]').forEach(bindAccordion);
  }

  function initAddInterviewee() {
    var list = document.querySelector('[data-analysis-accordion-list]');
    var addBtn = document.querySelector('[data-analysis-add-interviewee]');
    if (!list || !addBtn) return;
    var templateNode = list.querySelector('[data-analysis-accordion-template]');
    if (!templateNode) return;
    var templateHtml = templateNode.outerHTML;

    addBtn.addEventListener('click', function () {
      var holder = document.createElement('div');
      holder.innerHTML = templateHtml;
      var clone = holder.firstElementChild;
      if (!clone) return;
      clone.removeAttribute('data-analysis-accordion-template');
      delete clone.dataset.analysisAccordionBound;

      clone.querySelectorAll('textarea').forEach(function (ta) {
        ta.value = '';
      });
      clone.querySelectorAll('.pd-repeat-section').forEach(function (section) {
        delete section.dataset.analysisRepeatBound;
        var stack = section.querySelector('.pd-repeat-stack');
        if (!stack) return;
        var rows = Array.from(stack.querySelectorAll('.pd-repeat-row'));
        rows.forEach(function (row, idx) {
          if (idx > 0) row.remove();
        });
      });

      list.appendChild(clone);
      initRepeatSections(clone);
      bindAccordion(clone);
      syncAccordionRemoveButtons(list);
      var firstTa = clone.querySelector('textarea');
      if (firstTa) firstTa.focus();
      clone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function syncAccordionRemoveButtons(list) {
    if (!list) return;
    var accordions = list.querySelectorAll('[data-analysis-accordion]');
    var show = accordions.length >= 2;
    accordions.forEach(function (acc) {
      var btn = acc.querySelector('[data-analysis-remove-accordion]');
      if (!btn) return;
      btn.style.display = show ? 'inline-flex' : 'none';
      btn.disabled = !show;
    });
  }

  function initRemoveInterviewee() {
    var list = document.querySelector('[data-analysis-accordion-list]');
    if (!list) return;
    syncAccordionRemoveButtons(list);
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-analysis-remove-accordion]');
      if (!btn || !list.contains(btn) || btn.disabled) return;
      var accordion = btn.closest('[data-analysis-accordion]');
      if (!accordion || !list.contains(accordion)) return;
      accordion.remove();
      syncAccordionRemoveButtons(list);
    });
  }

  document.querySelectorAll('form.analysis-ajax-form').forEach(function (form) {
    form.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        form.classList.remove('was-validated');

        var btn = form.querySelector('button[type="submit"]');
        var page = form.getAttribute('data-analysis-page') || 'insight';
        var action = form.getAttribute('action');
        var start = Date.now();
        setButtonLoading(btn, true);

        var params = new URLSearchParams(new FormData(form));

        fetch(action, {
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
            return new Promise(function (r) {
              setTimeout(r, waitMore);
            }).then(function () {
              updateAnalysisPills(data, page);
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
      },
      true
    );
  });

  initRepeatSections(document);
  initInsightAccordion();
  initAddInterviewee();
  initRemoveInterviewee();
})();
