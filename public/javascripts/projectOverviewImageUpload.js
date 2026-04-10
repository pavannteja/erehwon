(function () {
    var MAX = 5 * 1024 * 1024;
    var MIN_LOADING_MS = 2000;
    var form = document.getElementById('po-image-upload-form');
    if (!form || form.dataset.ajaxUploadBound === '1') return;

    var input = document.getElementById('po-image-input');
    var dropzone = document.getElementById('poProblemImageDropzone');
    var browseBtn = document.getElementById('poProblemBrowseBtn');
    var fileError = document.getElementById('poProblemFileError');
    var dropzoneFileName = document.getElementById('poDropzoneFileName');
    var submitBtn = form.querySelector('button[type="submit"]');
    var imagesSection = document.querySelector('section[aria-labelledby="po-images-heading"]');
    var deleteModal = document.getElementById('po-image-delete-confirm-modal');
    var deleteCancel = document.getElementById('po-image-delete-confirm-cancel');
    var deleteConfirm = document.getElementById('po-image-delete-confirm-delete');
    var pendingDeleteForm = null;
    var appendedDeleteFormCount = 0;
    if (!input || !dropzone) return;

    form.dataset.ajaxUploadBound = '1';

    function ensureToastEl() {
        var el = document.getElementById('mission-launch-saved-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mission-launch-saved-toast';
            el.className = 'mission-launch-saved-toast';
            el.setAttribute('role', 'status');
            el.textContent = 'Uploaded successfully!';
            document.body.appendChild(el);
        }
        return el;
    }

    function showSavedToast(message) {
        var el = ensureToastEl();
        el.textContent = message || 'Uploaded successfully!';
        el.classList.remove('mission-launch-saved-toast--hide');
        el.classList.add('mission-launch-saved-toast--show');
        if (el._hideTimer) clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(function () {
            el.classList.remove('mission-launch-saved-toast--show');
            el.classList.add('mission-launch-saved-toast--hide');
        }, 5000);
    }

    function parseJsonResponse(text) {
        try {
            return text ? JSON.parse(text) : null;
        } catch (e) {
            return null;
        }
    }

    function submitImageDelete(deleteForm) {
        if (!deleteForm) return Promise.resolve(false);
        var payload = new URLSearchParams();
        payload.set('imagesDeleteAjax', '1');
        return fetch(deleteForm.getAttribute('action'), {
            method: 'POST',
            body: payload,
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
                if (!ref.res.ok || !ref.data || !ref.data.ok) {
                    var msg = ref.data && ref.data.error ? ref.data.error : 'Could not delete image. Please try again.';
                    window.alert(msg);
                    return false;
                }
                var tile = deleteForm.closest('.po-image-tile');
                if (tile) tile.remove();
                closeDeleteModal();
                showSavedToast('Deleted Successfully!');
                return true;
            })
            .catch(function () {
                window.alert('Network error. Please try again.');
                return false;
            });
    }

    function setButtonLoading(loading) {
        if (!submitBtn) return;
        submitBtn.disabled = loading;
        submitBtn.classList.toggle('groundwork-submit-btn--loading', loading);
        submitBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function setDeleteButtonLoading(loading) {
        if (!deleteConfirm) return;
        deleteConfirm.disabled = loading;
        deleteConfirm.classList.toggle('delete-confirm-delete--loading', loading);
        deleteConfirm.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function validateFiles(files) {
        var invalid = [];
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var t = (f.type || '').toLowerCase();
            var ok = t === 'image/jpeg' || t === 'image/png' || /\.(jpe?g|png)$/i.test(f.name);
            if (!ok) invalid.push(f.name + ' unsupported format');
            else if (f.size > MAX) invalid.push(f.name + ' exceeds 5MB');
        }
        return invalid;
    }

    function updateDropzonePreview(files) {
        if (!files || files.length === 0) {
            dropzone.classList.remove('has-file');
            if (dropzoneFileName) dropzoneFileName.textContent = '';
            return;
        }
        dropzone.classList.add('has-file');
        if (dropzoneFileName) {
            dropzoneFileName.textContent = files.length === 1 ? files[0].name : files.length + ' files selected';
        }
    }

    function setFiles(files) {
        var errors = validateFiles(files);
        if (errors.length) {
            input.value = '';
            updateDropzonePreview([]);
            if (fileError) fileError.textContent = errors.join(' | ');
            return false;
        }
        var dt = new DataTransfer();
        files.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
        updateDropzonePreview(Array.from(input.files));
        if (fileError) fileError.textContent = '';
        return true;
    }

    function ensureImagesGrid() {
        if (!imagesSection) return null;
        var grid = imagesSection.querySelector('.po-images-grid');
        if (grid) return grid;
        grid = document.createElement('div');
        grid.className = 'po-images-grid';
        imagesSection.appendChild(grid);
        return grid;
    }

    function openDeleteModalForForm(targetForm) {
        if (!deleteModal || !targetForm) return;
        pendingDeleteForm = targetForm;
        deleteModal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeDeleteModal() {
        if (!deleteModal) return;
        deleteModal.setAttribute('hidden', '');
        document.body.style.overflow = '';
        pendingDeleteForm = null;
    }

    function bindDeleteModalHandlers() {
        if (!deleteModal || deleteModal.dataset.bound === '1') return;
        deleteModal.dataset.bound = '1';

        if (imagesSection) {
            imagesSection.addEventListener('click', function (event) {
                var trigger = event.target.closest('.po-image-delete-trigger');
                if (!trigger) return;
                event.preventDefault();
                var formId = trigger.getAttribute('data-form-id');
                if (!formId) return;
                var targetForm = document.getElementById(formId);
                openDeleteModalForForm(targetForm);
            });
        }

        if (deleteCancel) {
            deleteCancel.addEventListener('click', function () {
                closeDeleteModal();
            });
        }

        if (deleteConfirm) {
            deleteConfirm.addEventListener('click', function () {
                if (!pendingDeleteForm) return;
                var targetForm = pendingDeleteForm;
                setDeleteButtonLoading(true);
                submitImageDelete(targetForm).finally(function () {
                    setDeleteButtonLoading(false);
                });
            });
        }

        deleteModal.addEventListener('click', function (event) {
            if (event.target.classList.contains('delete-confirm-backdrop')) closeDeleteModal();
        });
    }

    bindDeleteModalHandlers();

    function appendUploadedImages(images) {
        if (!Array.isArray(images) || !images.length) return;
        var grid = ensureImagesGrid();
        var uploadAction = form.getAttribute('action') || '';

        for (var i = 0; i < images.length; i++) {
            var imgData = images[i] || {};
            var url = String(imgData.url || '');
            var filename = String(imgData.filename || 'Image');
            if (!url) continue;

            if (grid) {
                var tile = document.createElement('div');
                tile.className = 'po-image-tile';

                var imageLink = document.createElement('a');
                imageLink.className = 'po-image-link';
                imageLink.href = url;
                imageLink.target = '_blank';
                imageLink.rel = 'noopener noreferrer';
                imageLink.setAttribute('aria-label', 'Open full image');

                var img = document.createElement('img');
                img.src = url;
                img.alt = 'Problem image';
                imageLink.appendChild(img);
                tile.appendChild(imageLink);

                var deleteForm = document.createElement('form');
                deleteForm.className = 'po-image-delete';
                deleteForm.method = 'POST';
                appendedDeleteFormCount += 1;
                var dynamicFormId = 'po-image-delete-form-dyn-' + appendedDeleteFormCount;
                deleteForm.id = dynamicFormId;
                deleteForm.action = uploadAction + '/' + encodeURIComponent(filename) + '?_method=DELETE';
                deleteForm.innerHTML = '<button type="button" class="po-delete-icon-btn po-image-delete-trigger" data-form-id="' + dynamicFormId + '" aria-haspopup="dialog" aria-controls="po-image-delete-confirm-modal" aria-label="Delete image"><img src="/images/delete-icon.png" alt="" class="ideation-delete-btn__icon" width="14" height="14" aria-hidden="true"></button>';
                tile.appendChild(deleteForm);

                grid.appendChild(tile);
            }
        }
    }

    input.addEventListener('change', function () {
        setFiles(Array.from(input.files));
    });

    if (browseBtn) browseBtn.addEventListener('click', function () { input.click(); });

    ['dragenter', 'dragover'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'drop'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('is-dragover');
        });
    });

    dropzone.addEventListener('drop', function (e) {
        var dropped = Array.from(e.dataTransfer.files || []);
        if (dropped.length) setFiles(dropped);
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        var files = Array.from(input.files || []);
        if (!files.length) {
            if (fileError) fileError.textContent = 'No images selected';
            return false;
        }
        if (!setFiles(files)) return false;

        var start = Date.now();
        setButtonLoading(true);
        var data = new FormData(form);
        data.set('imagesAjax', '1');

        fetch(form.getAttribute('action'), {
            method: 'POST',
            body: data,
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        })
            .then(function (res) {
                return res.text().then(function (text) {
                    return { res: res, data: parseJsonResponse(text) };
                });
            })
            .then(function (ref) {
                var res = ref.res;
                var payload = ref.data;
                if (!res.ok || !payload || !payload.ok) {
                    var msg = payload && payload.error ? payload.error : 'Could not upload images. Please try again.';
                    window.alert(msg);
                    return;
                }
                var elapsed = Date.now() - start;
                var waitMore = Math.max(0, MIN_LOADING_MS - elapsed);
                return new Promise(function (resolve) {
                    setTimeout(resolve, waitMore);
                }).then(function () {
                    appendUploadedImages(payload.images);
                    input.value = '';
                    updateDropzonePreview([]);
                    if (fileError) fileError.textContent = '';
                    showSavedToast('Uploaded successfully!');
                });
            })
            .catch(function () {
                window.alert('Network error. Please try again.');
            })
            .finally(function () {
                setButtonLoading(false);
            });

        return false;
    }, true);
})();
