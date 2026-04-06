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

  function updatePdPills(data, activePage) {
    var ch = document.querySelector('[data-pd-pill="challenge"]');
    var rs = document.querySelector('[data-pd-pill="research"]');
    var st = document.querySelector('[data-pd-pill="stakeholders"]');

    function setDot(el, submitted, page, step) {
      if (!el) return;
      el.classList.remove('groundwork-tab-dot--current', 'groundwork-tab-dot--complete', 'groundwork-tab-dot--pending');
      if (submitted) {
        el.classList.add('groundwork-tab-dot--complete');
      } else if (page === step) {
        el.classList.add('groundwork-tab-dot--current');
      } else {
        el.classList.add('groundwork-tab-dot--pending');
      }
    }

    setDot(ch, !!data.problemDiscoveryChallengeIntentSubmitted, activePage, 'challenge');
    setDot(rs, !!data.problemDiscoveryProblemResearchSubmitted, activePage, 'research');
    setDot(st, !!data.problemDiscoveryStakeholderMappingSubmitted, activePage, 'stakeholders');
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('groundwork-submit-btn--loading', loading);
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function parseJsonResponse(res, text) {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }

  document.querySelectorAll('form.problem-discovery-ajax-form').forEach(function (form) {
    form.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Allow draft/partial saves. Completion state is decided by backend,
        // but save UX (spinner, toast, scroll) should always run.
        form.classList.remove('was-validated');

        var page = form.getAttribute('data-pd-page') || 'challenge';
        var btn = form.querySelector('button[type="submit"]');
        var action = form.getAttribute('action');
        var start = Date.now();
        var multipart = form.getAttribute('enctype') === 'multipart/form-data';

        setButtonLoading(btn, true);

        var fetchOpts = {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        };

        if (multipart) {
          var fd = new FormData(form);
          fd.append('problemDiscoveryAjax', '1');
          fetchOpts.body = fd;
        } else {
          var params = new URLSearchParams(new FormData(form));
          params.set('problemDiscoveryAjax', '1');
          fetchOpts.body = params;
          fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        fetch(action, fetchOpts)
          .then(function (res) {
            return res.text().then(function (text) {
              return { res: res, data: parseJsonResponse(res, text) };
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
              var toastMessage =
                page === 'challenge' ? 'Submitted for Approval!' : 'Saved Successfully!';
              updatePdPills(data, page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(function () {
                showSavedToast(toastMessage);
              }, 150);
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
})();
