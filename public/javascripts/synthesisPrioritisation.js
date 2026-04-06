(function () {
  'use strict';

  function bindCounter(scope) {
    (scope || document).querySelectorAll('[data-analysis-counter]').forEach(function (wrap) {
      if (wrap.dataset.spCounterBound) return;
      wrap.dataset.spCounterBound = '1';
      var dec = wrap.querySelector('[data-counter-dec]');
      var inc = wrap.querySelector('[data-counter-inc]');
      var valueEl = wrap.querySelector('[data-counter-value]');
      var input = wrap.querySelector('[data-counter-input]');
      if (!dec || !inc || !valueEl || !input) return;
      var minVal = 0;
      var rawMax = parseInt(wrap.getAttribute('data-counter-max') || '', 10);
      var maxVal = Number.isFinite(rawMax) ? rawMax : null;

      function setValue(n) {
        var v = Math.max(minVal, n);
        if (maxVal !== null) v = Math.min(maxVal, v);
        valueEl.textContent = String(v);
        input.value = String(v);
      }
      function getValue() {
        var n = parseInt(input.value || '0', 10);
        return Number.isFinite(n) ? n : 0;
      }
      dec.addEventListener('click', function () {
        setValue(getValue() - 1);
      });
      inc.addEventListener('click', function () {
        setValue(getValue() + 1);
      });
      setValue(getValue());
    });
  }

  function bindChipGroups(scope) {
    (scope || document).querySelectorAll('[data-analysis-chip-hidden]').forEach(function (input) {
      var group = input.parentElement;
      if (!group || group.dataset.spChipBound) return;
      group.dataset.spChipBound = '1';
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-analysis-chip-value]');
        if (!btn || !group.contains(btn)) return;
        var value = btn.getAttribute('data-analysis-chip-value') || '';
        input.value = value;
        group.querySelectorAll('[data-analysis-chip-value]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
      });
    });
  }

  function bindThemeTypeCheckboxes(scope) {
    (scope || document).querySelectorAll('[data-analysis-sp-theme-card]').forEach(function (card) {
      if (card.dataset.spThemeTypeBound) return;
      card.dataset.spThemeTypeBound = '1';

      var hidden = card.querySelector('.analysis-sp-themeType-hidden');
      if (!hidden) return;

      var checkboxes = Array.from(card.querySelectorAll('.analysis-sp-type-checkbox'));
      if (!checkboxes.length) return;

      function syncFromChecked(preferred) {
        var checked = checkboxes.filter(function (c) {
          return c.checked;
        });

        var winner = preferred && preferred.checked ? preferred : (checked[0] || null);

        checkboxes.forEach(function (c) {
          c.checked = winner ? c === winner : false;
        });
        hidden.value = winner ? (winner.value || '') : '';
      }

      // Normalize any pre-existing multi-selected state to single-select.
      syncFromChecked(null);

      // Keep hidden `themeType[]` in sync (single-select).
      card.addEventListener('change', function (e) {
        var cb = e.target.closest('.analysis-sp-type-checkbox');
        if (!cb || !card.contains(cb)) return;
        syncFromChecked(cb.checked ? cb : null);
      });
    });
  }

  function ensureCounterIcons(scope) {
    (scope || document).querySelectorAll('[data-analysis-counter]').forEach(function (wrap) {
      var dec = wrap.querySelector('[data-counter-dec]');
      if (dec) {
        dec.textContent = '';
        var minusImg = document.createElement('img');
        minusImg.src = '/images/analysis-counter-minus.png';
        minusImg.alt = '';
        minusImg.className = 'analysis-sp-minus-icon';
        minusImg.width = 11;
        minusImg.height = 11;
        minusImg.setAttribute('aria-hidden', 'true');
        dec.appendChild(minusImg);
      }

      var inc = wrap.querySelector('[data-counter-inc]');
      if (inc) {
        inc.textContent = '';
        var plusImg = document.createElement('img');
        plusImg.src = '/images/challenge-intent-plus.png';
        plusImg.alt = '';
        plusImg.className = 'pd-add-field__icon';
        plusImg.width = 11;
        plusImg.height = 11;
        plusImg.setAttribute('aria-hidden', 'true');
        inc.appendChild(plusImg);
      }
    });
  }

  function bindAccordion(scope) {
    var root = scope || document;
    var accordions = [];
    if (root.matches && root.matches('[data-analysis-sp-accordion]')) {
      accordions.push(root);
    }
    accordions = accordions.concat(Array.from(root.querySelectorAll('[data-analysis-sp-accordion]')));

    accordions.forEach(function (acc) {
      if (acc.dataset.spAccordionBound) return;
      acc.dataset.spAccordionBound = '1';
      var toggle = acc.querySelector('[data-analysis-sp-toggle]');
      var content = acc.querySelector('[data-analysis-sp-content]');
      if (!toggle || !content) return;

      var transitionLock = false;
      function setExpanded(expanded, animate) {
        if (transitionLock) return;
        transitionLock = true;
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        acc.classList.toggle('analysis-sp-accordion--collapsed', !expanded);

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
        setExpanded(toggle.getAttribute('aria-expanded') !== 'true', true);
      });
    });
  }

  function resetAccordionFields(scope) {
    scope.querySelectorAll('textarea').forEach(function (t) {
      t.value = '';
      t.removeAttribute('required');
    });
    scope.querySelectorAll('[data-counter-input]').forEach(function (i) {
      i.value = '0';
    });
    scope.querySelectorAll('[data-counter-value]').forEach(function (s) {
      s.textContent = '0';
    });
    scope.querySelectorAll('[data-analysis-counter]').forEach(function (wrap) {
      delete wrap.dataset.spCounterBound;
    });
    scope.querySelectorAll('[data-analysis-chip-hidden]').forEach(function (i) {
      i.value = '';
    });
    scope.querySelectorAll('[data-analysis-chip-value]').forEach(function (b) {
      b.classList.remove('is-active');
    });
    scope.querySelectorAll('[data-analysis-chip-hidden]').forEach(function (input) {
      var group = input.parentElement;
      if (group) delete group.dataset.spChipBound;
    });
    scope.querySelectorAll('.analysis-sp-themeType-hidden').forEach(function (h) {
      h.value = '';
    });
    scope.querySelectorAll('.analysis-sp-type-checkbox').forEach(function (cb) {
      cb.checked = false;
    });
    scope.querySelectorAll('[data-analysis-sp-theme-card]').forEach(function (card) {
      delete card.dataset.spThemeTypeBound;
    });
    ensureCounterIcons(scope);
  }

  function syncAccordionRemoveButtons(list, removeSelector) {
    if (!list) return;
    var accordions = list.querySelectorAll('[data-analysis-sp-accordion]');
    var show = accordions.length >= 2;
    accordions.forEach(function (acc) {
      var btn = acc.querySelector(removeSelector);
      if (!btn) return;
      btn.style.display = show ? 'inline-flex' : 'none';
      btn.disabled = !show;
    });
  }

  function initAccordionRemoval() {
    var themeList = document.querySelector('[data-analysis-theme-accordion-list]');
    if (themeList) {
      syncAccordionRemoveButtons(themeList, '[data-analysis-remove-theme-accordion]');
      themeList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-analysis-remove-theme-accordion]');
        if (!btn || !themeList.contains(btn) || btn.disabled) return;
        var accordion = btn.closest('[data-analysis-sp-accordion]');
        if (!accordion || !themeList.contains(accordion)) return;
        accordion.remove();
        syncAccordionRemoveButtons(themeList, '[data-analysis-remove-theme-accordion]');
      });
    }

    var draftList = document.querySelector('[data-analysis-draft-accordion-list]');
    if (draftList) {
      syncAccordionRemoveButtons(draftList, '[data-analysis-remove-draft-accordion]');
      draftList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-analysis-remove-draft-accordion]');
        if (!btn || !draftList.contains(btn) || btn.disabled) return;
        var accordion = btn.closest('[data-analysis-sp-accordion]');
        if (!accordion || !draftList.contains(accordion)) return;
        accordion.remove();
        syncAccordionRemoveButtons(draftList, '[data-analysis-remove-draft-accordion]');
      });
    }
  }

  function sortDraftAccordionsByPriority() {
    var list = document.querySelector('[data-analysis-draft-accordion-list]');
    if (!list) return;
    var accordions = Array.from(list.querySelectorAll('[data-analysis-sp-accordion]'));
    if (!accordions.length) return;

    accordions
      .map(function (acc, idx) {
        var input = acc.querySelector('input[name="priorityRank[]"]');
        var raw = input ? parseInt((input.value || '').trim(), 10) : 0;
        var rank = Number.isFinite(raw) ? raw : 0;
        return { acc: acc, rank: rank, idx: idx };
      })
      .sort(function (a, b) {
        var aUnset = a.rank <= 0;
        var bUnset = b.rank <= 0;
        if (aUnset && bUnset) return a.idx - b.idx;
        if (aUnset) return 1;
        if (bUnset) return -1;
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.idx - b.idx;
      })
      .forEach(function (row) {
        list.appendChild(row.acc);
      });
  }

  function cloneThemeAccordion() {
    var list = document.querySelector('[data-analysis-theme-accordion-list]');
    var template = list ? list.querySelector('[data-analysis-theme-accordion-template]') : null;
    if (!list || !template) return;
    var holder = document.createElement('div');
    holder.innerHTML = template.outerHTML;
    var clone = holder.firstElementChild;
    if (!clone) return;
    clone.removeAttribute('data-analysis-theme-accordion-template');
    delete clone.dataset.spAccordionBound;
    resetAccordionFields(clone);
    list.appendChild(clone);
    bindCounter(clone);
    ensureCounterIcons(clone);
    bindChipGroups(clone);
    bindThemeTypeCheckboxes(clone);
    bindAccordion(clone);
    syncAccordionRemoveButtons(list, '[data-analysis-remove-theme-accordion]');
    var firstTa = clone.querySelector('textarea');
    if (firstTa) firstTa.focus();
  }

  function cloneDraftAccordion() {
    var list = document.querySelector('[data-analysis-draft-accordion-list]');
    var template = list ? list.querySelector('[data-analysis-draft-accordion-template]') : null;
    if (!list || !template) return;
    var holder = document.createElement('div');
    holder.innerHTML = template.outerHTML;
    var clone = holder.firstElementChild;
    if (!clone) return;
    clone.removeAttribute('data-analysis-draft-accordion-template');
    delete clone.dataset.spAccordionBound;
    resetAccordionFields(clone);
    list.appendChild(clone);
    bindCounter(clone);
    ensureCounterIcons(clone);
    bindChipGroups(clone);
    bindThemeTypeCheckboxes(clone);
    bindAccordion(clone);
    syncAccordionRemoveButtons(list, '[data-analysis-remove-draft-accordion]');
    var firstTa = clone.querySelector('textarea');
    if (firstTa) firstTa.focus();
  }

  var addTheme = document.querySelector('[data-analysis-add-theme-accordion]');
  if (addTheme) {
    addTheme.addEventListener('click', cloneThemeAccordion);
  }

  var addDraft = document.querySelector('[data-analysis-add-draft-accordion]');
  if (addDraft) {
    addDraft.addEventListener('click', cloneDraftAccordion);
  }

  var form = document.querySelector('form.analysis-sp-form');
  if (form) {
    // Run before analysisForms.js builds FormData so saved order is sorted.
    form.addEventListener('submit', function () {
      sortDraftAccordionsByPriority();
    }, true);
  }

  bindCounter(document);
  ensureCounterIcons(document);
  bindChipGroups(document);
  bindThemeTypeCheckboxes(document);
  bindAccordion(document);
  initAccordionRemoval();
})();
