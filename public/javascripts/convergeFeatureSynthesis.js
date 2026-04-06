(function () {
  'use strict';
  var MIN_LOADING_MS = 2000;

  function trim(v) {
    return (v == null ? '' : String(v)).trim();
  }

  function parseJson(text) {
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {};
    }
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

  function updateConvergePill(submitted) {
    var pill = document.querySelector('[data-converge-pill="feature-synthesis"]');
    if (!pill) return;
    pill.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
    pill.classList.add(submitted ? 'groundwork-tab-dot--complete' : 'groundwork-tab-dot--current');
  }

  function readInitialState() {
    var node = document.getElementById('convergeFeatureInitialState');
    var raw = parseJson(node ? node.textContent : '{}');
    return {
      functionalRequirements: Array.isArray(raw.functionalRequirements) ? raw.functionalRequirements.map(trim).filter(Boolean) : [],
      nonFunctionalRequirements: Array.isArray(raw.nonFunctionalRequirements) ? raw.nonFunctionalRequirements.map(trim).filter(Boolean) : [],
      ideas: Array.isArray(raw.ideas)
        ? raw.ideas
            .map(function (idea) {
              var item = idea && typeof idea === 'object' ? idea : {};
              return { id: trim(item.id), text: trim(item.text) || '(No idea text)' };
            })
            .filter(function (idea) { return !!idea.id; })
        : [],
      featurePairs: Array.isArray(raw.featurePairs)
        ? raw.featurePairs.map(function (pair) {
            var item = pair && typeof pair === 'object' ? pair : {};
            return {
              requirementType: trim(item.requirementType) === 'nonFunctional' ? 'nonFunctional' : 'functional',
              requirementText: trim(item.requirementText),
              ideaId: trim(item.ideaId),
              ideaText: trim(item.ideaText)
            };
          })
        : [],
      featureCards: Array.isArray(raw.featureCards)
        ? raw.featureCards.map(function (card, idx) {
            var item = card && typeof card === 'object' ? card : {};
            return {
              featureId: trim(item.featureId) || ('feature_' + (idx + 1)),
              checked: !!item.checked,
              requirementType: trim(item.requirementType) === 'nonFunctional' ? 'nonFunctional' : 'functional',
              requirementText: trim(item.requirementText),
              ideas: Array.isArray(item.ideas)
                ? item.ideas
                    .map(function (idea) {
                      var i = idea && typeof idea === 'object' ? idea : {};
                      return { ideaId: trim(i.ideaId), ideaText: trim(i.ideaText) };
                    })
                    .filter(function (idea) { return !!idea.ideaId && !!idea.ideaText; })
                : []
            };
          }).filter(function (card) { return !!card.requirementText && card.ideas.length > 0; })
        : [],
      groupedFeatureCards: Array.isArray(raw.groupedFeatureCards)
        ? raw.groupedFeatureCards.map(function (group, gIdx) {
            var item = group && typeof group === 'object' ? group : {};
            return {
              groupId: trim(item.groupId) || ('group_' + (gIdx + 1)),
              name: trim(item.name) || ('Group ' + (gIdx + 1)),
              checked: !!item.checked,
              features: Array.isArray(item.features)
                ? item.features
                    .map(function (card, cIdx) {
                      var f = card && typeof card === 'object' ? card : {};
                      return {
                        featureId: trim(f.featureId) || ('group_feature_' + (gIdx + 1) + '_' + (cIdx + 1)),
                        checked: !!f.checked,
                        requirementType: trim(f.requirementType) === 'nonFunctional' ? 'nonFunctional' : 'functional',
                        requirementText: trim(f.requirementText),
                        ideas: Array.isArray(f.ideas)
                          ? f.ideas
                              .map(function (idea) {
                                var i = idea && typeof idea === 'object' ? idea : {};
                                return { ideaId: trim(i.ideaId), ideaText: trim(i.ideaText) };
                              })
                              .filter(function (idea) { return !!idea.ideaId && !!idea.ideaText; })
                          : []
                      };
                    })
                    .filter(function (card) { return !!card.requirementText && card.ideas.length > 0; })
                : []
            };
          }).filter(function (group) { return group.features.length > 0; })
        : [],
      definedFeatures: trim(raw.definedFeatures)
    };
  }

  var root = document.querySelector('[data-converge-feature-root]');
  if (!root) return;

  var state = readInitialState();
  var form = root.querySelector('[data-fs-form]');
  var functionalRowsWrap = root.querySelector('[data-fs-functional-rows]');
  var nonFunctionalRowsWrap = root.querySelector('[data-fs-nonfunctional-rows]');
  var ideaRowsWrap = root.querySelector('[data-fs-idea-rows]');
  var ideaEmpty = root.querySelector('[data-fs-idea-empty]');
  var hiddenPairs = root.querySelector('[data-fs-pairs-json]');
  var hiddenCards = root.querySelector('[data-fs-feature-cards-json]');
  var hiddenGroupedCards = root.querySelector('[data-fs-grouped-feature-cards-json]');
  var hiddenDefinedFeatures = root.querySelector('[data-fs-defined-features]');
  var featureGrid = root.querySelector('[data-fs-feature-grid]');
  var featureEmpty = root.querySelector('[data-fs-feature-empty]');
  var groupedGrid = root.querySelector('[data-fs-grouped-grid]');
  var groupedEmpty = root.querySelector('[data-fs-grouped-empty]');
  var createFeatureBtn = root.querySelector('[data-fs-create-feature]');
  var featureActions = root.querySelector('[data-fs-feature-actions]');
  var groupBtn = root.querySelector('[data-fs-group-btn]');
  var deleteBtn = root.querySelector('[data-fs-delete-btn]');
  var deleteFeatureModal = document.getElementById('delete-converge-feature-confirm-modal');
  var deleteFeatureCancel = document.getElementById('delete-converge-feature-confirm-cancel');
  var deleteFeatureConfirm = document.getElementById('delete-converge-feature-confirm-delete');
  var deleteGroupedModal = document.getElementById('delete-converge-group-confirm-modal');
  var deleteGroupedCancel = document.getElementById('delete-converge-group-confirm-cancel');
  var deleteGroupedConfirm = document.getElementById('delete-converge-group-confirm-delete');
  var deleteGroupedModalDesc = document.getElementById('delete-converge-group-confirm-desc');
  var groupMinSelectionModal = document.getElementById('converge-group-min-selection-modal');
  var groupMinSelectionOk = document.getElementById('converge-group-min-selection-ok');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  var savedPairs = Array.isArray(state.featurePairs) ? state.featurePairs.slice() : [];
  var featureCards = Array.isArray(state.featureCards) ? state.featureCards.slice() : [];
  var groupedFeatureCards = Array.isArray(state.groupedFeatureCards) ? state.groupedFeatureCards.slice() : [];
  var activeRequirementKey = '';
  var selectedIdeaKeys = new Set();
  var pendingGroupedDeleteAction = null;

  function ideaTextById(id) {
    var match = state.ideas.find(function (idea) { return idea.id === id; });
    return match ? match.text : '';
  }

  function keyForRequirement(type, text) {
    return type + '::' + text;
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

  function makeAccordionCard(text, kind, meta) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'converge-feature-accordion';
    btn.setAttribute('data-kind', kind);
    btn.setAttribute('aria-expanded', 'false');

    var content = document.createElement('span');
    content.className = 'converge-feature-accordion__content';

    var body = document.createElement('span');
    body.className = 'converge-feature-accordion__text';
    body.textContent = text;
    content.appendChild(body);

    var chev = document.createElement('span');
    chev.className = 'converge-feature-accordion__chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = '<i class="bi bi-chevron-down"></i>';

    btn.appendChild(content);
    btn.appendChild(chev);

    var animLock = false;
    function setExpanded(expanded, animate) {
      if (animLock) return;
      animLock = true;
      btn.classList.toggle('is-expanded', expanded);
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

      var collapsedHeight = 20; // one-line preview height
      if (!animate) {
        content.style.maxHeight = expanded ? 'none' : collapsedHeight + 'px';
        animLock = false;
        return;
      }

      if (expanded) {
        content.style.maxHeight = collapsedHeight + 'px';
        requestAnimationFrame(function () {
          content.style.maxHeight = content.scrollHeight + 'px';
        });
        var onExpandEnd = function (ev) {
          if (ev.target !== content || ev.propertyName !== 'max-height') return;
          content.style.maxHeight = 'none';
          content.removeEventListener('transitionend', onExpandEnd);
          animLock = false;
        };
        content.addEventListener('transitionend', onExpandEnd);
        return;
      }

      var currentH = content.scrollHeight;
      content.style.maxHeight = currentH + 'px';
      requestAnimationFrame(function () {
        content.style.maxHeight = collapsedHeight + 'px';
      });
      var onCollapseEnd = function (ev) {
        if (ev.target !== content || ev.propertyName !== 'max-height') return;
        content.removeEventListener('transitionend', onCollapseEnd);
        animLock = false;
      };
      content.addEventListener('transitionend', onCollapseEnd);
    }
    setExpanded(false, false);

    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') !== 'true';
      setExpanded(expanded, true);

      if (kind === 'requirement') {
        var reqKey = keyForRequirement(meta.requirementType, meta.requirementText);
        activeRequirementKey = reqKey;
        root.querySelectorAll('.converge-feature-accordion[data-kind="requirement"]').forEach(function (el) {
          el.classList.toggle('is-selected', el === btn);
        });
      } else if (kind === 'idea') {
        var ideaKey = meta.ideaId;
        if (selectedIdeaKeys.has(ideaKey)) {
          selectedIdeaKeys.delete(ideaKey);
          btn.classList.remove('is-selected');
        } else {
          selectedIdeaKeys.add(ideaKey);
          btn.classList.add('is-selected');
        }
      }
    });

    return btn;
  }

  function buildInlineAccordion(text) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'converge-feature-inline-accordion';
    btn.setAttribute('aria-expanded', 'false');

    var content = document.createElement('span');
    content.className = 'converge-feature-inline-accordion__content';

    var textEl = document.createElement('span');
    textEl.className = 'converge-feature-inline-accordion__text';
    textEl.textContent = text;
    content.appendChild(textEl);

    var chev = document.createElement('span');
    chev.className = 'converge-feature-inline-accordion__chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = '<i class="bi bi-chevron-down"></i>';

    btn.appendChild(content);
    btn.appendChild(chev);

    var animLock = false;
    var collapsedHeight = 22;
    function setExpanded(expanded, animate) {
      if (animLock) return;
      animLock = true;
      btn.classList.toggle('is-expanded', expanded);
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

      if (!animate) {
        content.style.maxHeight = expanded ? 'none' : collapsedHeight + 'px';
        animLock = false;
        return;
      }
      if (expanded) {
        content.style.maxHeight = collapsedHeight + 'px';
        requestAnimationFrame(function () {
          content.style.maxHeight = content.scrollHeight + 'px';
        });
        var onExpandEnd = function (ev) {
          if (ev.target !== content || ev.propertyName !== 'max-height') return;
          content.style.maxHeight = 'none';
          content.removeEventListener('transitionend', onExpandEnd);
          animLock = false;
        };
        content.addEventListener('transitionend', onExpandEnd);
        return;
      }
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(function () {
        content.style.maxHeight = collapsedHeight + 'px';
      });
      var onCollapseEnd = function (ev) {
        if (ev.target !== content || ev.propertyName !== 'max-height') return;
        content.removeEventListener('transitionend', onCollapseEnd);
        animLock = false;
      };
      content.addEventListener('transitionend', onCollapseEnd);
    }
    setExpanded(false, false);

    btn.addEventListener('click', function () {
      setExpanded(btn.getAttribute('aria-expanded') !== 'true', true);
      scheduleFeatureMasonry();
    });

    return btn;
  }

  function buildFeatureCard(feature, idx) {
    var card = document.createElement('article');
    card.className = 'converge-feature-card';
    card.setAttribute('data-feature-idx', String(idx));

    var checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'converge-feature-card__checkoption';
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'converge-feature-card__checkbox';
    checkbox.checked = !!feature.checked;
    checkbox.setAttribute('aria-label', 'Select feature');
    var checkboxVisual = document.createElement('span');
    checkboxVisual.className = 'converge-feature-card__checkbox-box';
    checkboxVisual.setAttribute('aria-hidden', 'true');
    checkbox.addEventListener('change', function () {
      feature.checked = checkbox.checked;
      syncFeatureActionVisibility();
    });
    var body = document.createElement('div');
    body.className = 'converge-feature-card__body';

    var reqRow = document.createElement('div');
    reqRow.className = 'converge-feature-card__item converge-feature-card__item--with-check';
    var reqTag = document.createElement('span');
    reqTag.className = 'converge-feature-card__label';
    reqTag.textContent = 'R';
    var reqAcc = buildInlineAccordion(feature.requirementText);
    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxVisual);
    reqRow.appendChild(checkboxLabel);
    reqRow.appendChild(reqTag);
    reqRow.appendChild(reqAcc);
    body.appendChild(reqRow);

    feature.ideas.forEach(function (idea) {
      var ideaRow = document.createElement('div');
      ideaRow.className = 'converge-feature-card__item converge-feature-card__item--check-spacer';
      var spacer = document.createElement('span');
      spacer.className = 'converge-feature-card__checkspacer';
      spacer.setAttribute('aria-hidden', 'true');
      var ideaTag = document.createElement('span');
      ideaTag.className = 'converge-feature-card__label';
      ideaTag.textContent = 'I';
      var ideaAcc = buildInlineAccordion(idea.ideaText);
      ideaRow.appendChild(spacer);
      ideaRow.appendChild(ideaTag);
      ideaRow.appendChild(ideaAcc);
      body.appendChild(ideaRow);
    });

    card.appendChild(body);
    return card;
  }

  function buildGroupedFeatureSection(group, idx) {
    var section = document.createElement('section');
    section.className = 'converge-grouped-feature-section';
    section.setAttribute('data-group-idx', String(idx));

    var head = document.createElement('div');
    head.className = 'converge-grouped-feature-section__head';
    var titleWrap = document.createElement('div');
    titleWrap.className = 'converge-grouped-feature-section__title-wrap';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'converge-grouped-feature-section__name-input';
    nameInput.value = trim(group.name) || ('Group ' + (idx + 1));
    nameInput.readOnly = true;
    nameInput.setAttribute('aria-label', 'Grouped feature name');
    nameInput.addEventListener('change', function () {
      var v = trim(nameInput.value);
      if (!v) v = 'Group ' + (idx + 1);
      group.name = v;
      nameInput.value = v;
    });
    nameInput.addEventListener('input', function () {
      group.name = nameInput.value;
    });
    nameInput.addEventListener('blur', function () {
      var v = trim(nameInput.value);
      if (!v) v = 'Group ' + (idx + 1);
      group.name = v;
      nameInput.value = v;
      nameInput.readOnly = true;
    });
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameInput.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        nameInput.value = trim(group.name) || ('Group ' + (idx + 1));
        nameInput.readOnly = true;
      }
    });
    titleWrap.appendChild(nameInput);

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'converge-feature-notes__action-btn converge-grouped-feature-section__edit-btn';
    editBtn.setAttribute('aria-label', 'Edit group name');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () {
      nameInput.readOnly = false;
      focusWithoutScroll(nameInput);
      placeCaretAtEnd(nameInput);
    });
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'converge-feature-notes__action-btn converge-feature-notes__action-btn--danger converge-grouped-feature-section__delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-haspopup', 'dialog');
    deleteBtn.setAttribute('aria-controls', 'delete-converge-group-confirm-modal');
    deleteBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var total = Array.isArray(group.features) ? group.features.length : 0;
      var checked = (group.features || []).filter(function (feature) { return !!feature.checked; }).length;
      if (!total) return;

      if (checked === 0 || checked === total) {
        if (deleteGroupedModalDesc) {
          deleteGroupedModalDesc.textContent = 'Are you sure you want to delete the entire group?';
        }
        pendingGroupedDeleteAction = function () {
          deleteEntireGroupById(group.groupId);
        };
        openDeleteGroupedModal();
        return;
      }

      if (deleteGroupedModalDesc) {
        deleteGroupedModalDesc.textContent = 'Are you sure you want to delete the selected feature(s) from this group?';
      }
      pendingGroupedDeleteAction = function () {
        deleteCheckedFeaturesInGroup(group.groupId);
      };
      openDeleteGroupedModal();
    });
    var actions = document.createElement('div');
    actions.className = 'converge-grouped-feature-section__actions';
    actions.appendChild(editBtn);
    var separator = document.createElement('span');
    separator.className = 'converge-feature-notes__action-separator';
    separator.textContent = '|';
    actions.appendChild(separator);
    actions.appendChild(deleteBtn);
    head.appendChild(titleWrap);
    head.appendChild(actions);

    section.appendChild(head);

    var grid = document.createElement('div');
    grid.className = 'converge-grouped-feature-section__grid';
    grid.setAttribute('data-fs-group-feature-grid', String(idx));

    group.features.forEach(function (feature) {
      var itemCard = document.createElement('article');
      itemCard.className = 'converge-feature-card converge-grouped-feature-item';
      var body = document.createElement('div');
      body.className = 'converge-feature-card__body';

      var checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'converge-feature-card__checkoption';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'converge-feature-card__checkbox';
      checkbox.checked = !!feature.checked;
      checkbox.setAttribute('aria-label', 'Select grouped feature');
      var checkboxVisual = document.createElement('span');
      checkboxVisual.className = 'converge-feature-card__checkbox-box';
      checkboxVisual.setAttribute('aria-hidden', 'true');
      checkbox.addEventListener('change', function () {
        feature.checked = checkbox.checked;
      });
      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(checkboxVisual);

      var reqRow = document.createElement('div');
      reqRow.className = 'converge-feature-card__item converge-feature-card__item--with-check';
      var reqTag = document.createElement('span');
      reqTag.className = 'converge-feature-card__label';
      reqTag.textContent = 'R';
      var reqAcc = buildInlineAccordion(feature.requirementText);
      reqRow.appendChild(checkboxLabel);
      reqRow.appendChild(reqTag);
      reqRow.appendChild(reqAcc);
      body.appendChild(reqRow);

      feature.ideas.forEach(function (idea) {
        var ideaRow = document.createElement('div');
        ideaRow.className = 'converge-feature-card__item converge-feature-card__item--check-spacer';
        var spacer = document.createElement('span');
        spacer.className = 'converge-feature-card__checkspacer';
        spacer.setAttribute('aria-hidden', 'true');
        var ideaTag = document.createElement('span');
        ideaTag.className = 'converge-feature-card__label';
        ideaTag.textContent = 'I';
        var ideaAcc = buildInlineAccordion(idea.ideaText);
        ideaRow.appendChild(spacer);
        ideaRow.appendChild(ideaTag);
        ideaRow.appendChild(ideaAcc);
        body.appendChild(ideaRow);
      });

      itemCard.appendChild(body);
      grid.appendChild(itemCard);
    });

    section.appendChild(grid);
    return section;
  }

  function lockCardHeights(grid, selector) {
    if (!grid) return;
    var cards = Array.from(grid.querySelectorAll(selector));
    cards.forEach(function (card) {
      var previousHeight = card.style.height;
      card.style.height = 'auto';
      // Lock to closed-state content height so card doesn't grow when accordions open.
      var h = card.scrollHeight;
      card.style.height = h + 'px';
      if (!h && previousHeight) {
        card.style.height = previousHeight;
      }
    });
  }

  function masonryColumns(width) {
    if (width <= 640) return 1;
    if (width <= 980) return 2;
    return 3;
  }

  var masonryRaf = null;
  function scheduleFeatureMasonry() {
    if (!featureGrid) return;
    if (masonryRaf) cancelAnimationFrame(masonryRaf);
    masonryRaf = requestAnimationFrame(function () {
      masonryRaf = null;
      layoutMasonry(featureGrid, '.converge-feature-card');
      if (groupedGrid) {
        groupedGrid.querySelectorAll('[data-fs-group-feature-grid]').forEach(function (grid) {
          layoutMasonry(grid, '.converge-grouped-feature-item');
        });
      }
    });
  }

  function layoutMasonry(grid, selector) {
    if (!grid) return;
    var cards = Array.from(grid.querySelectorAll(selector));
    if (!cards.length) {
      grid.style.height = '0px';
      return;
    }
    var W = grid.clientWidth || 1;
    var cols = masonryColumns(W);
    var gap = 12;
    var colW = (W - gap * (cols - 1)) / cols;
    var heights = Array.from({ length: cols }, function () { return 0; });

    cards.forEach(function (card, i) {
      card.style.position = 'absolute';
      card.style.width = colW + 'px';
      var col = i % cols;
      card.style.left = (col * (colW + gap)) + 'px';
      card.style.top = heights[col] + 'px';
      heights[col] += card.offsetHeight + gap;
    });

    var maxH = heights.reduce(function (a, b) { return Math.max(a, b); }, 0);
    grid.style.height = Math.max(0, maxH - gap) + 'px';
  }

  function rebuildPairsFromCards() {
    var pairs = [];
    featureCards.forEach(function (card) {
      card.ideas.forEach(function (idea) {
        pairs.push({
          requirementType: card.requirementType,
          requirementText: card.requirementText,
          ideaId: idea.ideaId,
          ideaText: idea.ideaText
        });
      });
    });
    groupedFeatureCards.forEach(function (group) {
      group.features.forEach(function (card) {
        card.ideas.forEach(function (idea) {
          pairs.push({
            requirementType: card.requirementType,
            requirementText: card.requirementText,
            ideaId: idea.ideaId,
            ideaText: idea.ideaText
          });
        });
      });
    });
    savedPairs = pairs;
  }

  function selectedFeatureCount() {
    return featureCards.reduce(function (count, card) {
      return count + (card && card.checked ? 1 : 0);
    }, 0);
  }

  function syncFeatureActionVisibility() {
    if (!featureActions) return;
    featureActions.hidden = selectedFeatureCount() < 1;
  }

  function openDeleteFeatureModal() {
    if (!deleteFeatureModal) return;
    deleteFeatureModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteFeatureModal() {
    if (!deleteFeatureModal) return;
    deleteFeatureModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function openDeleteGroupedModal() {
    if (!deleteGroupedModal) return;
    deleteGroupedModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteGroupedModal() {
    if (!deleteGroupedModal) return;
    deleteGroupedModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    pendingGroupedDeleteAction = null;
  }

  function openGroupMinSelectionModal() {
    if (!groupMinSelectionModal) return;
    groupMinSelectionModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeGroupMinSelectionModal() {
    if (!groupMinSelectionModal) return;
    groupMinSelectionModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function deleteSelectedFeatures() {
    var beforeCount = featureCards.length;
    featureCards = featureCards.filter(function (card) {
      return !card.checked;
    });
    if (featureCards.length === beforeCount) {
      syncFeatureActionVisibility();
      return;
    }
    rebuildPairsFromCards();
    renderFeatureCards();
    renderGroupedCards();
    renderRows();
  }

  function deleteEntireGroupById(groupId) {
    var restored = [];
    groupedFeatureCards = groupedFeatureCards.filter(function (group) {
      if (group.groupId !== groupId) return true;
      (group.features || []).forEach(function (feature) {
        restored.push({
          featureId: feature.featureId || ('feature_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
          checked: false,
          requirementType: feature.requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional',
          requirementText: feature.requirementText,
          ideas: Array.isArray(feature.ideas)
            ? feature.ideas.map(function (idea) {
                return { ideaId: idea.ideaId, ideaText: idea.ideaText };
              })
            : []
        });
      });
      return false;
    });
    if (restored.length) {
      featureCards = featureCards.concat(restored);
    }
    rebuildPairsFromCards();
    renderFeatureCards();
    renderGroupedCards();
    renderRows();
  }

  function deleteCheckedFeaturesInGroup(groupId) {
    var changed = false;
    var restored = [];
    groupedFeatureCards = groupedFeatureCards
      .map(function (group) {
        if (group.groupId !== groupId) return group;
        var kept = [];
        (group.features || []).forEach(function (feature) {
          if (feature.checked) {
            changed = true;
            restored.push({
              featureId: feature.featureId || ('feature_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
              checked: false,
              requirementType: feature.requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional',
              requirementText: feature.requirementText,
              ideas: Array.isArray(feature.ideas)
                ? feature.ideas.map(function (idea) {
                    return { ideaId: idea.ideaId, ideaText: idea.ideaText };
                  })
                : []
            });
            return;
          }
          kept.push(feature);
        });
        group.features = kept;
        return group;
      })
      .filter(function (group) {
        return Array.isArray(group.features) && group.features.length > 0;
      });
    if (!changed) return;
    if (restored.length) {
      featureCards = featureCards.concat(restored);
    }
    rebuildPairsFromCards();
    renderFeatureCards();
    renderGroupedCards();
    renderRows();
  }

  function buildUsedPools() {
    var usedRequirements = {
      functional: new Set(),
      nonFunctional: new Set()
    };
    var usedIdeaIds = new Set();

    function collectFromCard(card) {
      if (!card) return;
      var reqType = card.requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional';
      var reqText = trim(card.requirementText);
      if (reqText) usedRequirements[reqType].add(reqText);
      (card.ideas || []).forEach(function (idea) {
        var ideaId = trim(idea && idea.ideaId);
        if (ideaId) usedIdeaIds.add(ideaId);
      });
    }

    featureCards.forEach(collectFromCard);
    groupedFeatureCards.forEach(function (group) {
      (group.features || []).forEach(collectFromCard);
    });

    return {
      usedRequirements: usedRequirements,
      usedIdeaIds: usedIdeaIds
    };
  }

  function renderFeatureCards() {
    if (!featureGrid) return;
    featureGrid.innerHTML = '';
    if (!featureCards.length) {
      if (featureEmpty) featureEmpty.style.display = 'block';
      featureGrid.style.height = '0px';
      syncFeatureActionVisibility();
      return;
    }
    if (featureEmpty) featureEmpty.style.display = 'none';
    featureCards.forEach(function (feature, idx) {
      featureGrid.appendChild(buildFeatureCard(feature, idx));
    });
    lockCardHeights(featureGrid, '.converge-feature-card');
    scheduleFeatureMasonry();
    syncFeatureActionVisibility();
  }

  function renderGroupedCards() {
    if (!groupedGrid) return;
    groupedGrid.innerHTML = '';
    if (!groupedFeatureCards.length) {
      if (groupedEmpty) groupedEmpty.style.display = 'block';
      groupedGrid.style.height = '0px';
      return;
    }
    groupedGrid.style.height = 'auto';
    if (groupedEmpty) groupedEmpty.style.display = 'none';
    groupedFeatureCards.forEach(function (group, idx) {
      groupedGrid.appendChild(buildGroupedFeatureSection(group, idx));
    });
    groupedGrid.querySelectorAll('[data-fs-group-feature-grid]').forEach(function (grid) {
      lockCardHeights(grid, '.converge-grouped-feature-item');
    });
    scheduleFeatureMasonry();
  }

  function renderRows() {
    var usedPools = buildUsedPools();
    var availableReqKeys = new Set();
    var availableIdeaIds = new Set();
    functionalRowsWrap.innerHTML = '';
    nonFunctionalRowsWrap.innerHTML = '';
    ideaRowsWrap.innerHTML = '';

    state.functionalRequirements.forEach(function (text) {
      if (usedPools.usedRequirements.functional.has(text)) return;
      availableReqKeys.add(keyForRequirement('functional', text));
      var row = document.createElement('div');
      row.className = 'converge-feature-row';
      row.appendChild(
        makeAccordionCard(text, 'requirement', {
          requirementType: 'functional',
          requirementText: text
        })
      );
      functionalRowsWrap.appendChild(row);
    });

    state.nonFunctionalRequirements.forEach(function (text) {
      if (usedPools.usedRequirements.nonFunctional.has(text)) return;
      availableReqKeys.add(keyForRequirement('nonFunctional', text));
      var row = document.createElement('div');
      row.className = 'converge-feature-row';
      row.appendChild(
        makeAccordionCard(text, 'requirement', {
          requirementType: 'nonFunctional',
          requirementText: text
        })
      );
      nonFunctionalRowsWrap.appendChild(row);
    });

    state.ideas.forEach(function (idea) {
      if (usedPools.usedIdeaIds.has(idea.id)) return;
      availableIdeaIds.add(idea.id);
      var row = document.createElement('div');
      row.className = 'converge-feature-row';
      row.appendChild(
        makeAccordionCard(idea.text, 'idea', {
          ideaId: idea.id
        })
      );
      ideaRowsWrap.appendChild(row);
    });
    if (ideaEmpty) ideaEmpty.hidden = availableIdeaIds.size !== 0;

    if (!availableReqKeys.has(activeRequirementKey)) {
      activeRequirementKey = '';
    }
    selectedIdeaKeys = new Set(Array.from(selectedIdeaKeys).filter(function (id) {
      return availableIdeaIds.has(id);
    }));
  }

  createFeatureBtn.addEventListener('click', function () {
    if (!activeRequirementKey || selectedIdeaKeys.size === 0) return;
    var sep = activeRequirementKey.indexOf('::');
    var requirementType = sep >= 0 ? activeRequirementKey.slice(0, sep) : 'functional';
    var requirementText = sep >= 0 ? activeRequirementKey.slice(sep + 2) : '';
    if (!requirementText) return;

    var selectedIds = Array.from(selectedIdeaKeys);
    var newIdeas = selectedIds
      .map(function (ideaId) {
        var ideaText = ideaTextById(ideaId);
        if (!ideaText) return null;
        return {
          ideaId: ideaId,
          ideaText: ideaText
        };
      })
      .filter(Boolean);

    if (!newIdeas.length) return;

    featureCards.push({
      featureId: 'feature_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      checked: false,
      requirementType: requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional',
      requirementText: requirementText,
      ideas: newIdeas
    });
    activeRequirementKey = '';
    selectedIdeaKeys.clear();
    rebuildPairsFromCards();
    renderFeatureCards();
    renderRows();
  });

  if (groupBtn) {
    groupBtn.addEventListener('click', function () {
      var selected = featureCards.filter(function (card) { return !!card.checked; });
      if (selected.length < 2) {
        openGroupMinSelectionModal();
        return;
      }
      var nextNum = groupedFeatureCards.length + 1;
      groupedFeatureCards.push({
        groupId: 'group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: 'Group ' + nextNum,
        features: selected.map(function (card, idx) {
          return {
            featureId: card.featureId || ('group_item_' + (idx + 1)),
            checked: false,
            requirementType: card.requirementType,
            requirementText: card.requirementText,
            ideas: Array.isArray(card.ideas)
              ? card.ideas.map(function (idea) {
                  return { ideaId: idea.ideaId, ideaText: idea.ideaText };
                })
              : []
          };
        })
      });
      featureCards = featureCards.filter(function (card) { return !card.checked; });
      rebuildPairsFromCards();
      renderFeatureCards();
      renderGroupedCards();
      renderRows();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (selectedFeatureCount() < 1) return;
      openDeleteFeatureModal();
    });
  }

  if (deleteFeatureCancel) {
    deleteFeatureCancel.addEventListener('click', function () {
      closeDeleteFeatureModal();
    });
  }

  if (deleteFeatureConfirm) {
    deleteFeatureConfirm.addEventListener('click', function () {
      deleteSelectedFeatures();
      closeDeleteFeatureModal();
    });
  }

  if (deleteFeatureModal) {
    deleteFeatureModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('delete-confirm-backdrop')) closeDeleteFeatureModal();
    });
  }

  if (deleteGroupedCancel) {
    deleteGroupedCancel.addEventListener('click', function () {
      closeDeleteGroupedModal();
    });
  }

  if (deleteGroupedConfirm) {
    deleteGroupedConfirm.addEventListener('click', function () {
      if (typeof pendingGroupedDeleteAction === 'function') {
        pendingGroupedDeleteAction();
      }
      closeDeleteGroupedModal();
    });
  }

  if (deleteGroupedModal) {
    deleteGroupedModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('delete-confirm-backdrop')) closeDeleteGroupedModal();
    });
  }

  if (groupMinSelectionOk) {
    groupMinSelectionOk.addEventListener('click', function () {
      closeGroupMinSelectionModal();
    });
  }

  if (groupMinSelectionModal) {
    groupMinSelectionModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('delete-confirm-backdrop')) closeGroupMinSelectionModal();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    rebuildPairsFromCards();
    hiddenCards.value = JSON.stringify(featureCards);
    if (hiddenGroupedCards) hiddenGroupedCards.value = JSON.stringify(groupedFeatureCards);
    hiddenPairs.value = JSON.stringify(savedPairs);
    var definedFromCards = featureCards.map(function (card) {
      return card.requirementText + ' <- ' + card.ideas.map(function (i) { return i.ideaText; }).join(' | ');
    });
    var definedFromGroups = groupedFeatureCards.reduce(function (rows, group) {
      group.features.forEach(function (card) {
        rows.push((group.name || 'Group') + ': ' + card.requirementText + ' <- ' + card.ideas.map(function (i) { return i.ideaText; }).join(' | '));
      });
      return rows;
    }, []);
    hiddenDefinedFeatures.value = definedFromCards.concat(definedFromGroups).join('\n');

    var start = Date.now();
    setButtonLoading(submitBtn, true);

    var params = new URLSearchParams(new FormData(form));
    params.set('convergeAjax', '1');

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
          updateConvergePill(!!(ref.data && ref.data.convergeFeatureSynthesisSubmitted));
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

  renderRows();
  renderFeatureCards();
  renderGroupedCards();
  window.addEventListener('resize', scheduleFeatureMasonry);
  window.addEventListener('load', scheduleFeatureMasonry);
})();
