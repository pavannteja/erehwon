(function () {
  'use strict';

  function syncTripletRemove(stack) {
    var rows = stack.querySelectorAll('.pd-pr-triplet-row');
    var show = rows.length >= 2;
    rows.forEach(function (row) {
      var btn = row.querySelector('.pd-pr-triplet-remove');
      if (!btn) return;
      btn.style.display = show ? 'flex' : 'none';
      btn.disabled = !show;
    });
  }

  function syncTripletFirstRequired(stack, optionalCat) {
    var rows = stack.querySelectorAll('.pd-pr-triplet-row');
    rows.forEach(function (row, ri) {
      row.querySelectorAll('textarea.form-control').forEach(function (ta, ii) {
        if (!optionalCat && ri === 0 && ii < 3) {
          ta.setAttribute('required', 'required');
        } else {
          ta.removeAttribute('required');
        }
      });
    });
  }

  function createTripletRow(base, phDf, phSl, phWm) {
    var row = document.createElement('div');
    row.className = 'pd-pr-triplet-row mb-2';
    var shell = document.createElement('div');
    shell.className = 'pd-pr-triplet-shell';
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'pd-repeat-remove pd-pr-triplet-remove';
    rm.setAttribute('aria-label', 'Remove this row');
    var rmImg = document.createElement('img');
    rmImg.src = '/images/challenge-intent-close.png';
    rmImg.alt = '';
    rmImg.className = 'pd-repeat-remove__icon';
    rmImg.width = 13;
    rmImg.height = 13;
    rmImg.setAttribute('aria-hidden', 'true');
    rm.appendChild(rmImg);

    var strip = document.createElement('div');
    strip.className = 'pd-repeat-remove-strip';
    strip.appendChild(rm);

    var innerRow = document.createElement('div');
    innerRow.className = 'row g-2';

    function col(mobileLabel, nameSuffix, ph) {
      var c = document.createElement('div');
      c.className = 'col-md-4';
      var ml = document.createElement('span');
      ml.className = 'form-label pd-pr-row-label pd-pr-mobile-col d-md-none';
      ml.textContent = mobileLabel;
      var ta = document.createElement('textarea');
      ta.className = 'form-control';
      ta.setAttribute('name', base + '_' + nameSuffix + '[]');
      ta.setAttribute('rows', '4');
      ta.setAttribute('placeholder', ph);
      c.appendChild(ml);
      c.appendChild(ta);
      return c;
    }

    innerRow.appendChild(col('Data Found', 'dataFound', phDf));
    innerRow.appendChild(col('Source Link', 'sourceLink', phSl));
    innerRow.appendChild(col('Why This Matters?', 'whyMatters', phWm));

    shell.appendChild(strip);
    shell.appendChild(innerRow);
    row.appendChild(shell);
    return row;
  }

  document.querySelectorAll('.pd-pr-category').forEach(function (cat) {
    var base = cat.getAttribute('data-base');
    var phDf = cat.getAttribute('data-ph-df') || '';
    var phSl = cat.getAttribute('data-ph-sl') || '';
    var phWm = cat.getAttribute('data-ph-wm') || '';
    var optionalCat = cat.getAttribute('data-optional') === '1';
    var stack = cat.querySelector('.pd-pr-triplet-stack');
    var addBtn = cat.querySelector('.pd-add-field');
    if (!stack || !addBtn || !base) return;

    syncTripletRemove(stack);
    syncTripletFirstRequired(stack, optionalCat);

    addBtn.addEventListener('click', function () {
      var row = createTripletRow(base, phDf, phSl, phWm);
      stack.appendChild(row);
      syncTripletRemove(stack);
      syncTripletFirstRequired(stack, optionalCat);
      var firstTa = row.querySelector('textarea.form-control');
      if (firstTa) firstTa.focus();
    });

    stack.addEventListener('click', function (e) {
      var btn = e.target.closest('.pd-pr-triplet-remove');
      if (!btn || !stack.contains(btn) || btn.disabled) return;
      var row = btn.closest('.pd-pr-triplet-row');
      if (!row || !stack.contains(row)) return;
      row.remove();
      syncTripletRemove(stack);
      syncTripletFirstRequired(stack, optionalCat);
    });
  });

  function syncProjRemove(stack) {
    var rows = stack.querySelectorAll('.pd-repeat-row');
    var show = rows.length >= 2;
    rows.forEach(function (row) {
      var btn = row.querySelector('.pd-repeat-remove');
      if (!btn) return;
      btn.style.display = show ? 'flex' : 'none';
      btn.disabled = !show;
    });
  }

  function syncProjFirstRequired(stack) {
    var tas = stack.querySelectorAll('textarea.form-control');
    tas.forEach(function (ta, i) {
      if (i === 0) {
        ta.setAttribute('required', 'required');
      } else {
        ta.removeAttribute('required');
      }
    });
  }

  function createProjRow(fieldName, placeholder) {
    var row = document.createElement('div');
    row.className = 'pd-repeat-row mb-2';
    var shell = document.createElement('div');
    shell.className = 'pd-repeat-row-shell pd-repeat-row-shell--close-inside';
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'pd-repeat-remove';
    rm.setAttribute('aria-label', 'Remove this entry');
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
    ta.setAttribute('name', fieldName + '[]');
    ta.setAttribute('rows', '4');
    ta.setAttribute('placeholder', placeholder);
    shell.appendChild(rm);
    shell.appendChild(ta);
    row.appendChild(shell);
    return row;
  }

  document.querySelectorAll('.pd-pr-proj-repeat').forEach(function (section) {
    var field = section.getAttribute('data-field');
    var placeholder = section.getAttribute('data-placeholder') || '';
    var stack = section.querySelector('.pd-repeat-stack');
    var addBtn = section.querySelector('.pd-add-field');
    if (!stack || !addBtn || !field) return;

    syncProjRemove(stack);
    syncProjFirstRequired(stack);

    addBtn.addEventListener('click', function () {
      var row = createProjRow(field, placeholder);
      stack.appendChild(row);
      syncProjRemove(stack);
      syncProjFirstRequired(stack);
      var ta = row.querySelector('textarea.form-control');
      if (ta) ta.focus();
    });

    stack.addEventListener('click', function (e) {
      var btn = e.target.closest('.pd-repeat-remove');
      if (!btn || !stack.contains(btn) || btn.disabled) return;
      var row = btn.closest('.pd-repeat-row');
      if (!row || !stack.contains(row)) return;
      row.remove();
      syncProjRemove(stack);
      syncProjFirstRequired(stack);
    });
  });
})();
