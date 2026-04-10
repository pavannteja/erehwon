const express = require('express');
const router = express.Router();
const campgrounds = require('../controllers/campgrounds');
const catchAsync = require('../utils/catchAsync');
const { isLoggedIn, isAuthor, validateCampground } = require('../middleware');
const multer = require('multer');
const { storage } = require('../cloudinary');
const upload = multer({ storage });

const Campground = require('../models/campgrounds');

router.route('/')
    .get(catchAsync(campgrounds.index))
    .post(isLoggedIn, upload.array('image'), validateCampground, catchAsync(campgrounds.createCampground))


router.get('/new', isLoggedIn, campgrounds.renderNewForm)

router.route('/:id')
    .get(catchAsync(campgrounds.showCampground))
    .put(isLoggedIn, isAuthor, upload.array('image'), validateCampground, catchAsync(campgrounds.updateCampground))
    .delete(isLoggedIn, isAuthor, catchAsync(campgrounds.deleteCampground));

router.get('/:id/edit', isLoggedIn, isAuthor, catchAsync(campgrounds.renderEditForm))

// Save notes route
router.post('/:id/notes', isLoggedIn, isAuthor, catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, notesPayload } = req.body;
    const wantsJson =
      String(req.body.notesAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    console.log('Saving notes for campground:', id);
    console.log('Notes content:', notes);
    
    const campground = await Campground.findById(id);
    if (!campground) {
      if (wantsJson) {
        return res.status(404).json({ ok: false, error: 'Campground not found' });
      }
      req.flash('error', 'Campground not found');
      return res.redirect('/');
    }
    
    // Backward-compatible storage:
    // - if notesPayload is a JSON array, store all note slots as JSON string
    // - otherwise store single note text in legacy format
    let notesToSave = notes || '';
    if (typeof notesPayload === 'string' && notesPayload.trim().length > 0) {
      try {
        const parsed = JSON.parse(notesPayload);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(slot => (typeof slot === 'string' ? slot : ''));
          notesToSave = JSON.stringify(normalized);
        }
      } catch (e) {
        // Keep legacy single-note save if payload parsing fails
      }
    }
    campground.notes = notesToSave;
    await campground.save();
    
    console.log('Notes saved successfully, campground notes:', campground.notes);
    if (wantsJson) {
      return res.json({ ok: true, message: 'Notes saved successfully!' });
    }
    req.flash('success', 'Notes saved successfully!');
    res.redirect(`/problems/${id}`);
  } catch (error) {
    console.error('Error saving notes:', error);
    const wantsJson =
      String(req.body.notesAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    if (wantsJson) {
      return res.status(500).json({ ok: false, error: 'Failed to save notes. Please try again.' });
    }
    req.flash('error', 'Failed to save notes: ' + error.message);
    res.redirect(`/problems/${req.params.id}`);
  }
}));

// Add images route
router.post('/:id/images', isLoggedIn, isAuthor, upload.array('image'), catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const wantsJson =
      String(req.body.imagesAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    const campground = await Campground.findById(id);
    
    if (!campground) {
      if (wantsJson) {
        return res.status(404).json({ ok: false, error: 'Problem statement not found' });
      }
      req.flash('error', 'Problem statement not found');
      return res.redirect('/');
    }
    
    // Handle new images
    if (req.files && req.files.length > 0) {
      const imgs = req.files.map(f => {
        // Check if Cloudinary (has secure_url or path is URL) or disk storage
        let url;
        if (f.secure_url || f.url || (f.path && f.path.startsWith('http'))) {
          url = f.secure_url || f.url || f.path;
        } else {
          // Disk storage - create URL path
          const path = require('path');
          const filename = path.basename(f.path);
          url = `/uploads/${filename}`;
        }
        return { url: url, filename: f.filename || f.originalname };
      });
      campground.images.push(...imgs);
      await campground.save();
      if (wantsJson) {
        return res.json({
          ok: true,
          message: `${req.files.length} image(s) uploaded successfully!`,
          images: imgs
        });
      }
      req.flash('success', `${req.files.length} image(s) uploaded successfully!`);
    } else {
      if (wantsJson) {
        return res.status(400).json({ ok: false, error: 'No images selected' });
      }
      req.flash('error', 'No images selected');
    }
    
    res.redirect(`/problems/${id}`);
  } catch (error) {
    console.error('Error uploading images:', error);
    const wantsJson =
      String(req.body.imagesAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    if (wantsJson) {
      return res.status(500).json({ ok: false, error: 'Failed to upload images. Please try again.' });
    }
    req.flash('error', 'Failed to upload images: ' + error.message);
    res.redirect(`/problems/${req.params.id}`);
  }
}));

// Delete image route
router.delete('/:id/images/:filename', isLoggedIn, isAuthor, catchAsync(async (req, res) => {
  try {
    const { id, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename || '');
    const wantsJson =
      String(req.body.imagesDeleteAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    const campground = await Campground.findById(id);
    
    if (!campground) {
      if (wantsJson) {
        return res.status(404).json({ ok: false, error: 'Problem statement not found' });
      }
      req.flash('error', 'Problem statement not found');
      return res.redirect('/');
    }
    
    // Delete from Cloudinary
    const { cloudinary } = require('../cloudinary');
    await cloudinary.uploader.destroy(decodedFilename);
    
    // Remove from campground
    await campground.updateOne({ $pull: { images: { filename: decodedFilename } } });
    if (wantsJson) {
      return res.json({ ok: true, filename: decodedFilename, message: 'Deleted successfully' });
    }
    
    req.flash('success', 'Image deleted successfully!');
    res.redirect(`/problems/${id}`);
  } catch (error) {
    console.error('Error deleting image:', error);
    const wantsJson =
      String(req.body.imagesDeleteAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    if (wantsJson) {
      return res.status(500).json({ ok: false, error: 'Failed to delete image. Please try again.' });
    }
    req.flash('error', 'Failed to delete image: ' + error.message);
    res.redirect(`/problems/${req.params.id}`);
  }
}));

module.exports = router;