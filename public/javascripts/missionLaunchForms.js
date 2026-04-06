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
    el.classList.remove('mission-launch-saved-toast--hide');
    el.classList.add('mission-launch-saved-toast--show');
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      el.classList.remove('mission-launch-saved-toast--show');
      el.classList.add('mission-launch-saved-toast--hide');
    }, 5000);
  }

  function updatePills(data, page) {
    var gw = document.querySelector('[data-pill="groundwork"]');
    var tm = document.querySelector('[data-pill="team"]');
    if (!gw || !tm) return;

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

    setDot(gw, !!data.missionLaunchGroundworkSubmitted, page, 'groundwork');
    setDot(tm, !!data.missionLaunchTeamSubmitted, page, 'team');
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('groundwork-submit-btn--loading', loading);
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  document.querySelectorAll('form.mission-launch-ajax-form').forEach(function (form) {
    form.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Allow draft/partial saves. Completion state is decided by backend,
        // but save UX (spinner, toast, scroll) should always run.
        form.classList.remove('was-validated');

        var page = form.getAttribute('data-mission-page') || 'groundwork';
        var btn = form.querySelector('button[type="submit"]');
        var action = form.getAttribute('action');
        var start = Date.now();

        setButtonLoading(btn, true);

        var body = new URLSearchParams(new FormData(form));

        fetch(action, {
          method: 'POST',
          body: body,
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
          .then(function (res) {
            return res.text().then(function (text) {
              var data = null;
              try {
                data = text ? JSON.parse(text) : null;
              } catch (err) {
                data = null;
              }
              return { res: res, data: data };
            });
          })
          .then(function (_ref) {
            var res = _ref.res;
            var data = _ref.data;

            if (!res.ok || !data || !data.ok) {
              var msg =
                data && data.error
                  ? data.error
                  : 'Could not save. Please try again.';
              window.alert(msg);
              return;
            }

            var elapsed = Date.now() - start;
            var waitMore = Math.max(0, MIN_LOADING_MS - elapsed);
            return new Promise(function (r) {
              setTimeout(r, waitMore);
            }).then(function () {
              updatePills(data, page);
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
})();
