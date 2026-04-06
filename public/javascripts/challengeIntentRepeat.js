(function () {
  'use strict';

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
      if (i === 0) {
        ta.setAttribute('required', 'required');
      } else {
        ta.removeAttribute('required');
      }
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

  document.querySelectorAll('.pd-repeat-section').forEach(function (section) {
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
      row.querySelector('textarea').focus();
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
})();
