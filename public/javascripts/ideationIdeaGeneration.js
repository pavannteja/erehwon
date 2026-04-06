(function () {
  'use strict';

  var MIN_LOADING_MS = 2000;
  var PLACEHOLDER = 'Plant 5 raw ideas to unlock themes.';
  var MASONRY_GAP = 10;

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

  function updateIdeaPill(complete) {
    var ideaPill = document.querySelector('[data-idea-gen-pill="idea"]');
    if (!ideaPill) return;
    ideaPill.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
    ideaPill.classList.add(complete ? 'groundwork-tab-dot--complete' : 'groundwork-tab-dot--current');
  }

  function normalizeState(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var arr =
      raw && Array.isArray(raw.rawIdeas) && raw.rawIdeas.length
        ? raw.rawIdeas.map(function (s) {
            return s == null ? '' : String(s);
          })
        : [''];
    var themes = Array.isArray(src.themes) && src.themes.length
      ? src.themes.map(function (t, idx) {
          var entry = t && typeof t === 'object' ? t : {};
          var id = trim(entry.id) || 'theme' + (idx + 1);
          var label = trim(entry.label) || ('Theme ' + (idx + 1));
          var note = trim(entry.note);
          var dropped = Array.isArray(entry.dropped)
            ? entry.dropped
                .map(function (d, j) {
                  var item = d && typeof d === 'object' ? d : {};
                  var did = trim(item.id) || ('idea_' + (idx + 1) + '_' + (j + 1));
                  var text = trim(item.text);
                  if (!text) return null;
                  return { id: did, text: text };
                })
                .filter(Boolean)
            : [];
          return { id: id, label: label, note: note, dropped: dropped };
        })
      : [{ id: 'theme1', label: 'Theme 1', note: '', dropped: [] }];
    var selectedThemeId = trim(src.selectedThemeId);
    if (!themes.some(function (t) { return t.id === selectedThemeId; })) {
      selectedThemeId = themes[0].id;
    }
    return {
      rawIdeas: arr,
      themes: themes,
      selectedThemeId: selectedThemeId,
      themesUnlocked: !!src.themesUnlocked,
      editable: arr.map(function (v) {
        // Existing filled ideas are locked until "Edit" is chosen from menu.
        // Fresh empty ideas stay directly editable.
        return !trim(v);
      })
    };
  }

  function setOnlyEditable(idx) {
    state.editable = state.rawIdeas.map(function (_v, i) {
      return i === idx;
    });
  }

  function applyEditableStateToDom() {
    if (!stack) return;
    var areas = stack.querySelectorAll('.ideation-idea-gen-input');
    areas.forEach(function (ta, i) {
      var canEdit = !!state.editable[i];
      ta.readOnly = !canEdit;
      ta.classList.toggle('ideation-idea-gen-input--locked', !canEdit);
    });
  }

  function masonryColumnCount(containerWidth) {
    if (containerWidth <= 420) return 1;
    if (containerWidth <= 720) return 2;
    return 3;
  }

  function autoGrowTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function focusWithoutScroll(el) {
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      el.focus();
    }
  }

  function placeCaretAtEnd(el) {
    if (!el || typeof el.value !== 'string') return;
    try {
      var end = el.value.length;
      el.setSelectionRange(end, end);
    } catch (e) {
      /* no-op */
    }
  }

  var root = document.querySelector('[data-idea-gen-root]');
  if (!root) return;

  var stateNode = document.getElementById('ideaGenInitialState');
  var initial = {};
  try {
    initial = stateNode ? JSON.parse(stateNode.textContent || '{}') : {};
  } catch (e) {
    initial = {};
  }
  var state = normalizeState(initial);
  var editableCount = state.editable.filter(function (x) { return !!x; }).length;
  if (editableCount > 1) {
    var lastEditable = state.editable.lastIndexOf(true);
    state.editable = state.rawIdeas.map(function (_v, i) { return i === lastEditable; });
  }

  var stack = root.querySelector('[data-idea-gen-stack]');
  var addBtn = root.querySelector('[data-idea-gen-add]');
  var form = root.querySelector('[data-idea-gen-form]');
  var ideationPayloadField = root.querySelector('[data-ideation-payload]');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  var tutorialBtn = root.querySelector('[data-idea-gen-tutorial]');
  var themesWrap = root.querySelector('[data-ideation-themes-wrap]');
  var tooltipCloseBtns = root.querySelectorAll('[data-idea-tooltip-close]');
  var themeSelect = root.querySelector('[data-ideation-theme-select]');
  var addThemeBtn = root.querySelector('[data-ideation-add-theme]');
  var themeInput = root.querySelector('[data-ideation-theme-input]');
  var dropzone = root.querySelector('[data-ideation-ideas-dropzone]');
  var dropInner = dropzone ? dropzone.querySelector('.ideation-ideas-dropzone__inner') : null;
  var dropStack = root.querySelector('[data-ideation-drop-stack]');
  var dropPlaceholder = root.querySelector('[data-ideation-drop-placeholder]');
  var deleteThemeTrigger = root.querySelector('[data-ideation-delete-theme]');
  var deleteThemeModal = document.getElementById('delete-theme-confirm-modal');
  var deleteThemeCancel = document.getElementById('delete-theme-confirm-cancel');
  var deleteThemeConfirm = document.getElementById('delete-theme-confirm-delete');
  var introTooltip = root.querySelector('.ideation-idea-gen-callout');
  var themesTooltip = root.querySelector('.ideation-themes-callout');
  var activeMenu = null;
  var activeMenuCtx = null;

  function getSelectedTheme() {
    if (!state.themes || !state.themes.length) {
      state.themes = [{ id: 'theme1', label: 'Theme 1', note: '', dropped: [] }];
      state.selectedThemeId = 'theme1';
    }
    var picked = state.themes.find(function (t) { return t.id === state.selectedThemeId; });
    if (picked) return picked;
    state.selectedThemeId = state.themes[0].id;
    return state.themes[0];
  }

  function renderThemeSelect() {
    if (!themeSelect) return;
    themeSelect.innerHTML = '';
    (state.themes || []).forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      opt.selected = t.id === state.selectedThemeId;
      themeSelect.appendChild(opt);
    });
  }

  function syncDeleteThemeButtonState() {
    if (!deleteThemeTrigger) return;
    var hasMultiple = !!state.themes && state.themes.length >= 2;
    if (hasMultiple) {
      deleteThemeTrigger.removeAttribute('hidden');
      deleteThemeTrigger.disabled = false;
    } else {
      deleteThemeTrigger.setAttribute('hidden', '');
      deleteThemeTrigger.disabled = true;
    }
  }

  function openDeleteThemeModal() {
    if (!deleteThemeModal) return;
    deleteThemeModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteThemeModal() {
    if (!deleteThemeModal) return;
    deleteThemeModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function deleteSelectedTheme() {
    if (!state.themes || state.themes.length <= 1) return;
    var idx = state.themes.findIndex(function (t) { return t.id === state.selectedThemeId; });
    if (idx < 0) idx = 0;
    var themeToDelete = state.themes[idx] || null;
    if (themeToDelete && Array.isArray(themeToDelete.dropped)) {
      themeToDelete.dropped.forEach(function (entry) {
        moveIdeaBackToIdeas(entry && entry.text);
      });
    }
    state.themes.splice(idx, 1);
    var nextIdx = Math.max(0, Math.min(idx, state.themes.length - 1));
    state.selectedThemeId = state.themes[nextIdx].id;
    renderThemeSelect();
    renderStack();
    renderDropStack();
    syncDeleteThemeButtonState();
  }

  function syncThemesVisibility() {
    if (!themesWrap) return;
    if (state.themesUnlocked) {
      themesWrap.classList.remove('ideation-themes-wrap--hidden');
    } else {
      themesWrap.classList.add('ideation-themes-wrap--hidden');
    }
  }

  function buildIdeationPayloadForSave() {
    return {
      rawIdeas: (state.rawIdeas || []).slice(),
      themesUnlocked: !!state.themesUnlocked,
      selectedThemeId: state.selectedThemeId,
      themes: (state.themes || []).map(function (t) {
        return {
          id: t.id,
          label: t.label,
          note: t.note || '',
          dropped: Array.isArray(t.dropped)
            ? t.dropped.map(function (d) { return { id: d.id, text: d.text }; })
            : []
        };
      })
    };
  }

  function moveIdeaBackToIdeas(text) {
    var value = trim(text);
    if (!value) return;
    if (!Array.isArray(state.rawIdeas)) state.rawIdeas = [''];
    if (!Array.isArray(state.editable)) state.editable = [true];

    var singleBlank =
      state.rawIdeas.length === 1 &&
      !trim(state.rawIdeas[0]);

    if (singleBlank) {
      state.rawIdeas[0] = value;
      state.editable[0] = false;
      return;
    }

    state.rawIdeas.push(value);
    state.editable.push(false);
  }

  function closeIdeaMenu() {
    if (activeMenu && activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu);
    activeMenu = null;
    activeMenuCtx = null;
  }

  function openIdeaMenu(trigger, ctx) {
    closeIdeaMenu();
    if (!trigger) return;
    activeMenuCtx = ctx || {};
    var mode = activeMenuCtx.mode || 'idea';

    var menu = document.createElement('div');
    menu.className = 'ideation-idea-menu';
    menu.setAttribute('role', 'menu');
    if (mode === 'theme') {
      menu.innerHTML =
        '<button type="button" class="ideation-idea-menu__item ideation-idea-menu__item--danger" data-idea-menu-action="delete-theme" role="menuitem">Delete from Theme</button>';
    } else {
      menu.innerHTML =
        '<button type="button" class="ideation-idea-menu__item" data-idea-menu-action="edit" role="menuitem">Edit</button>' +
        '<button type="button" class="ideation-idea-menu__item ideation-idea-menu__item--danger" data-idea-menu-action="delete" role="menuitem">Delete</button>';
    }

    var editBtn = menu.querySelector('[data-idea-menu-action="edit"]');
    var deleteBtn = menu.querySelector('[data-idea-menu-action="delete"]');
    var deleteThemeBtn = menu.querySelector('[data-idea-menu-action="delete-theme"]');

    if (deleteBtn && !activeMenuCtx.canDelete) {
      deleteBtn.disabled = true;
      deleteBtn.classList.add('is-disabled');
    }

    if (editBtn) {
      editBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = typeof activeMenuCtx.idx === 'number' ? activeMenuCtx.idx : -1;
        if (idx >= 0) setOnlyEditable(idx);
        applyEditableStateToDom();
        closeIdeaMenu();
        // Ensure the unlocked textbox is immediately ready for typing.
        requestAnimationFrame(function () {
          var target = null;
          if (idx >= 0 && stack) {
            var areas = stack.querySelectorAll('.ideation-idea-gen-input');
            target = areas[idx] || null;
          }
          if (!target) target = activeMenuCtx.textarea;
          if (!target) return;
          target.readOnly = false;
          target.classList.remove('ideation-idea-gen-input--locked');
          focusWithoutScroll(target);
          placeCaretAtEnd(target);
        });
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!activeMenuCtx.canDelete) return;
        state.rawIdeas.splice(activeMenuCtx.idx, 1);
        state.editable.splice(activeMenuCtx.idx, 1);
        if (!state.rawIdeas.length) state.rawIdeas = [''];
        if (!state.editable.length) state.editable = [true];
        if (state.editable.filter(Boolean).length > 1) {
          var first = state.editable.findIndex(function (x) { return x; });
          setOnlyEditable(first);
        }
        closeIdeaMenu();
        renderStack();
      });
    }

    if (deleteThemeBtn) {
      deleteThemeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var theme = getSelectedTheme();
        if (!theme || !theme.dropped || typeof activeMenuCtx.dropIdx !== 'number') return;
        var removed = theme.dropped.splice(activeMenuCtx.dropIdx, 1)[0];
        moveIdeaBackToIdeas(removed && removed.text);
        closeIdeaMenu();
        renderStack();
        renderDropStack();
      });
    }

    document.body.appendChild(menu);
    activeMenu = menu;

    var rect = trigger.getBoundingClientRect();
    var menuRect = menu.getBoundingClientRect();
    var left = rect.right - menuRect.width;
    var top = rect.bottom + 6;
    var maxLeft = window.innerWidth - menuRect.width - 8;
    var maxTop = window.innerHeight - menuRect.height - 8;
    menu.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
    menu.style.top = Math.max(8, Math.min(top, maxTop)) + 'px';
  }

  var tooltipRaf = null;
  function scheduleTooltipLayout() {
    if (tooltipRaf) cancelAnimationFrame(tooltipRaf);
    tooltipRaf = requestAnimationFrame(function () {
      tooltipRaf = null;
      layoutTooltips();
    });
  }

  var dropRaf = null;
  function scheduleDropMasonry() {
    if (!dropStack) return;
    if (dropRaf) cancelAnimationFrame(dropRaf);
    dropRaf = requestAnimationFrame(function () {
      dropRaf = null;
      layoutDropMasonry();
    });
  }

  function layoutDropMasonry() {
    if (!dropStack) return;
    var items = dropStack.querySelectorAll('.ideation-ideas-dropzone__item');
    var n = items.length;
    if (!n) {
      dropStack.style.height = '112px';
      return;
    }
    var W = dropStack.clientWidth;
    if (W < 1) W = 1;
    var cols = masonryColumnCount(W);
    var colWidth = (W - MASONRY_GAP * (cols - 1)) / cols;
    var heights = [];
    for (var c = 0; c < cols; c++) heights[c] = 0;
    for (var i = 0; i < n; i++) {
      var row = items[i];
      row.style.width = colWidth + 'px';
      var col = i % cols;
      row.style.left = col * (colWidth + MASONRY_GAP) + 'px';
      row.style.top = heights[col] + 'px';
      heights[col] += row.offsetHeight + MASONRY_GAP;
    }
    var maxH = heights[0];
    for (c = 1; c < cols; c++) if (heights[c] > maxH) maxH = heights[c];
    dropStack.style.height = Math.max(112, maxH - MASONRY_GAP) + 'px';
  }

  function renderDropStack() {
    if (!dropStack) return;
    dropStack.innerHTML = '';
    var theme = getSelectedTheme();
    var dropped = theme && Array.isArray(theme.dropped) ? theme.dropped : [];
    dropped.forEach(function (entry, dropIdx) {
      var item = document.createElement('div');
      item.className = 'ideation-ideas-dropzone__item';
      var card = document.createElement('div');
      card.className = 'ideation-ideas-dropzone__card';
      card.textContent = entry && entry.text ? entry.text : '';
      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'ideation-ideas-dropzone__more';
      moreBtn.setAttribute('aria-label', 'Theme item options');
      moreBtn.innerHTML = '<i class="bi bi-three-dots-vertical" aria-hidden="true"></i>';
      moreBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openIdeaMenu(moreBtn, { mode: 'theme', dropIdx: dropIdx });
      });
      card.appendChild(moreBtn);
      item.appendChild(card);
      dropStack.appendChild(item);
    });
    if (dropPlaceholder) {
      dropPlaceholder.style.display = dropped.length ? 'none' : 'flex';
    }
    if (themeInput) {
      themeInput.value = theme ? (theme.note || '') : '';
    }
    scheduleDropMasonry();
  }

  function layoutTooltips() {
    var rootRect = root.getBoundingClientRect();
    var gap = 10;

    if (introTooltip && introTooltip.style.display !== 'none' && stack) {
      var firstIdeaInput = stack.querySelector('.ideation-idea-gen-input');
      if (firstIdeaInput) {
        var firstRect = firstIdeaInput.getBoundingClientRect();
        var introTop = firstRect.top - rootRect.top - introTooltip.offsetHeight - gap;
        introTooltip.style.left = '0px';
        introTooltip.style.top = Math.max(0, introTop) + 'px';
      }
    }

    if (
      themesTooltip &&
      themesWrap &&
      themesWrap.style.display !== 'none' &&
      !themesWrap.classList.contains('ideation-themes-wrap--hidden') &&
      themesTooltip.style.display !== 'none'
    ) {
      var themeInput = themesWrap.querySelector('[data-ideation-theme-input]');
      if (themeInput) {
        var tiRect = themeInput.getBoundingClientRect();
        var themesTop = tiRect.top - rootRect.top - themesTooltip.offsetHeight - gap;
        themesTooltip.style.left = '0px';
        themesTooltip.style.top = Math.max(0, themesTop) + 'px';
      }
    }
  }

  var masonryRaf = null;
  var masonryCallbacks = [];
  function scheduleMasonry(afterLayout) {
    if (!stack) return;
    if (typeof afterLayout === 'function') masonryCallbacks.push(afterLayout);
    if (masonryRaf) cancelAnimationFrame(masonryRaf);
    masonryRaf = requestAnimationFrame(function () {
      masonryRaf = null;
      layoutIdeaMasonry();
      if (masonryCallbacks.length) {
        var callbacks = masonryCallbacks.slice();
        masonryCallbacks = [];
        callbacks.forEach(function (cb) {
          try {
            cb();
          } catch (e) {
            /* no-op */
          }
        });
      }
    });
  }

  function layoutIdeaMasonry() {
    if (!stack) return;
    var items = stack.querySelectorAll('.ideation-idea-gen-row');
    var n = items.length;
    if (!n) {
      stack.style.height = '0px';
      return;
    }

    var W = stack.clientWidth;
    if (W < 1) W = 1;
    var cols = masonryColumnCount(W);
    var colWidth = (W - MASONRY_GAP * (cols - 1)) / cols;

    var heights = [];
    var c;
    for (c = 0; c < cols; c++) {
      heights[c] = 0;
    }

    for (var i = 0; i < n; i++) {
      var row = items[i];
      row.style.position = 'absolute';
      row.style.boxSizing = 'border-box';
      row.style.width = colWidth + 'px';

      var ta = row.querySelector('.ideation-idea-gen-input');
      autoGrowTextarea(ta);

      // Keep insertion order predictable (left -> center -> right) even when card heights vary.
      var col = i % cols;
      row.style.left = col * (colWidth + MASONRY_GAP) + 'px';
      row.style.top = heights[col] + 'px';

      heights[col] += row.offsetHeight + MASONRY_GAP;
    }

    var maxH = heights[0];
    for (c = 1; c < cols; c++) {
      if (heights[c] > maxH) maxH = heights[c];
    }
    stack.style.height = Math.max(0, maxH - MASONRY_GAP) + 'px';
  }

  function renderStack() {
    closeIdeaMenu();
    stack.innerHTML = '';
    var showRemove = state.rawIdeas.length >= 2;
    state.rawIdeas.forEach(function (value, idx) {
      var row = document.createElement('div');
      row.className = 'ideation-idea-gen-row';
      row.draggable = true;
      row.setAttribute('data-idea-idx', String(idx));
      row.addEventListener('dragstart', function (e) {
        row.classList.add('is-dragging');
        try {
          e.dataTransfer.setData('text/plain', String(idx));
          e.dataTransfer.effectAllowed = 'copyMove';
          var ghost = document.createElement('div');
          ghost.className = 'ideation-drag-ghost';
          ghost.textContent = trim(value) || PLACEHOLDER;
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 20, 20);
          setTimeout(function () {
            if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
          }, 0);
        } catch (_e) {
          /* no-op */
        }
      });
      row.addEventListener('dragend', function () {
        row.classList.remove('is-dragging');
      });

      var shell = document.createElement('div');
      shell.className = 'ideation-idea-gen-field-shell';

      var ta = document.createElement('textarea');
      ta.name = 'rawIdeas[]';
      ta.className = 'form-control ideation-idea-gen-input';
      ta.placeholder = PLACEHOLDER;
      ta.value = value;
      ta.setAttribute('rows', '1');
      ta.setAttribute('autocomplete', 'off');
      var canTypeDirectly = !!state.editable[idx];
      ta.readOnly = !canTypeDirectly;
      ta.classList.toggle('ideation-idea-gen-input--locked', !canTypeDirectly);
      ta.addEventListener('input', function () {
        state.rawIdeas[idx] = ta.value;
        scheduleMasonry();
      });

      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'ideation-idea-gen-more';
      moreBtn.setAttribute('aria-label', 'More options');
      moreBtn.innerHTML = '<i class="bi bi-three-dots-vertical" aria-hidden="true"></i>';
      moreBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (activeMenu && activeMenuCtx && activeMenuCtx.idx === idx) {
          closeIdeaMenu();
          return;
        }
        openIdeaMenu(moreBtn, {
          mode: 'idea',
          idx: idx,
          textarea: ta,
          canDelete: showRemove
        });
      });

      shell.appendChild(ta);
      shell.appendChild(moreBtn);
      row.appendChild(shell);
      stack.appendChild(row);
    });
    scheduleMasonry(function () {
      scheduleTooltipLayout();
    });
  }

  if (typeof ResizeObserver !== 'undefined' && stack) {
    var ro = new ResizeObserver(function () {
      scheduleMasonry();
      scheduleTooltipLayout();
    });
    ro.observe(stack);
  } else {
    window.addEventListener('resize', function () {
      scheduleMasonry();
      scheduleTooltipLayout();
    });
  }

  addBtn.addEventListener('click', function (e) {
    e.preventDefault();
    state.rawIdeas.push('');
    setOnlyEditable(state.rawIdeas.length - 1);
    var prevY = window.scrollY || window.pageYOffset || 0;
    renderStack();
    scheduleMasonry(function () {
      var tas = stack.querySelectorAll('.ideation-idea-gen-input');
      var last = tas[tas.length - 1];
      focusWithoutScroll(last);
      if (window.scrollY !== prevY) {
        window.scrollTo({ top: prevY, behavior: 'auto' });
      }
      scheduleTooltipLayout();
    });
  });

  if (tutorialBtn) {
    tutorialBtn.addEventListener('click', function () {
      if (introTooltip) introTooltip.style.display = 'block';
      if (state.themesUnlocked) syncThemesVisibility();
      if (themesTooltip) themesTooltip.style.display = 'block';
      scheduleTooltipLayout();
    });
  }

  if (dropInner) {
    dropInner.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropInner.classList.add('is-over');
    });
    dropInner.addEventListener('dragleave', function () {
      dropInner.classList.remove('is-over');
    });
    dropInner.addEventListener('drop', function (e) {
      e.preventDefault();
      dropInner.classList.remove('is-over');
      var idxStr = '';
      try {
        idxStr = e.dataTransfer.getData('text/plain') || '';
      } catch (_e) {
        idxStr = '';
      }
      var idx = parseInt(idxStr, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= state.rawIdeas.length) return;
      var text = trim(state.rawIdeas[idx]);
      if (!text) return;
      var id = 'idea_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      var theme = getSelectedTheme();
      if (!theme.dropped) theme.dropped = [];
      theme.dropped.push({ id: id, text: text });
      state.rawIdeas.splice(idx, 1);
      state.editable.splice(idx, 1);
      if (!state.rawIdeas.length) {
        state.rawIdeas = [''];
        state.editable = [true];
      } else if (!state.editable.some(function (x) { return !!x; })) {
        state.editable[state.rawIdeas.length - 1] = true;
      }
      renderStack();
      renderDropStack();
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', function () {
      state.selectedThemeId = themeSelect.value;
      renderDropStack();
      syncDeleteThemeButtonState();
    });
  }

  if (themeInput) {
    themeInput.addEventListener('input', function () {
      var theme = getSelectedTheme();
      theme.note = themeInput.value;
    });
  }

  if (addThemeBtn) {
    addThemeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var next = (state.themes ? state.themes.length : 0) + 1;
      var theme = {
        id: 'theme' + next,
        label: 'Theme ' + next,
        note: '',
        dropped: []
      };
      if (!state.themes) state.themes = [];
      state.themes.push(theme);
      state.selectedThemeId = theme.id;
      renderThemeSelect();
      renderDropStack();
      syncDeleteThemeButtonState();
      if (themeInput) focusWithoutScroll(themeInput);
    });
  }

  if (deleteThemeTrigger) {
    deleteThemeTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      if (deleteThemeTrigger.disabled) return;
      openDeleteThemeModal();
    });
  }

  if (deleteThemeCancel) {
    deleteThemeCancel.addEventListener('click', function () {
      closeDeleteThemeModal();
    });
  }

  if (deleteThemeConfirm) {
    deleteThemeConfirm.addEventListener('click', function () {
      deleteSelectedTheme();
      closeDeleteThemeModal();
    });
  }

  if (deleteThemeModal) {
    deleteThemeModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('delete-confirm-backdrop')) closeDeleteThemeModal();
    });
  }

  if (tooltipCloseBtns && tooltipCloseBtns.length) {
    tooltipCloseBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var tip = btn.closest('.ideation-tooltip');
        if (tip) tip.style.display = 'none';
      });
    });
  }

  document.addEventListener('click', function (e) {
    if (!activeMenu) return;
    if (activeMenu.contains(e.target)) return;
    if (e.target.closest('.ideation-idea-gen-more')) return;
    closeIdeaMenu();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    form.classList.remove('was-validated');

    var start = Date.now();
    setButtonLoading(submitBtn, true);

    var params = new URLSearchParams(new FormData(form));
    if (ideationPayloadField) {
      ideationPayloadField.value = JSON.stringify(buildIdeationPayloadForSave());
      params.set('ideationPayload', ideationPayloadField.value);
    }
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
          updateIdeaPill(!!data.ideationIdeaGenerationSubmitted);
          state.themesUnlocked = !!(state.themesUnlocked || data.ideationThemesUnlocked || data.ideationIdeaGenerationSubmitted);
          syncThemesVisibility();
          scheduleTooltipLayout();
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

  renderThemeSelect();
  renderStack();
  renderDropStack();
  syncDeleteThemeButtonState();
  syncThemesVisibility();
})();
