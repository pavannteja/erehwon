const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const catchAsync = require('../utils/catchAsync');
const { Prototype } = require('../models/schemas');
const Campground = require('../models/campgrounds');
const multer = require('multer');
const { prototypeStorage } = require('../cloudinary');
const path = require('path');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf', 'video/mp4']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.mp4']);

const upload = multer({
  storage: prototypeStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const validType = ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext);
    if (!validType) {
      return cb(new Error('Only JPEG, PNG, PDF, and MP4 files are allowed.'));
    }
    cb(null, true);
  }
});

function expectsJson(req) {
  const accept = String(req.get('accept') || '').toLowerCase();
  return accept.includes('application/json') || (req.body && String(req.body.prototypeAjax) === '1');
}

// GET route to render prototyping page
router.get('/prototyping/:problemId', isLoggedIn, catchAsync(async (req, res) => {
  const { problemId } = req.params;
  
  // Verify the problem belongs to the user
  const campground = await Campground.findById(problemId);
  if (!campground) {
    req.flash('error', 'Problem statement not found');
    return res.redirect('/');
  }
  
  if (campground.author.toString() !== req.user._id.toString()) {
    req.flash('error', 'You do not have permission to access this problem');
    return res.redirect('/');
  }
  
  // Check if prototype already exists - check both campground.prototype reference AND by problemId
  let prototype = null;
  if (campground.prototype) {
    prototype = await Prototype.findById(campground.prototype);
    // Verify it belongs to the user
    if (prototype && prototype.user.toString() !== req.user._id.toString()) {
      prototype = null;
    }
  }
  
  // If no prototype found via reference, try finding by problemId
  if (!prototype) {
    prototype = await Prototype.findOne({ 
      problemId: problemId,
      user: req.user._id 
    }).sort({ createdAt: -1 }); // Get the most recent one
    
    // If found, link it to the campground
    if (prototype && !campground.prototype) {
      campground.prototype = prototype._id;
      await campground.save();
      console.log('Linked existing prototype to campground');
    }
  }
  
  // Ensure files array exists and is initialized
  if (prototype && (!prototype.files || !Array.isArray(prototype.files))) {
    prototype.files = [];
    await prototype.save();
  }

  // Ensure additionalLinks array exists and is initialized
  if (prototype && (!prototype.additionalLinks || !Array.isArray(prototype.additionalLinks))) {
    prototype.additionalLinks = [];
    await prototype.save();
  }
  
  // Debug: Log prototype data
  if (prototype) {
    console.log('=== PROTOTYPE GET ===');
    console.log('Prototype ID:', prototype._id);
    console.log('Prototype files count:', prototype.files ? prototype.files.length : 0);
    console.log('Prototype files:', JSON.stringify(prototype.files, null, 2));
    // Ensure files array exists
    if (!prototype.files) {
      prototype.files = [];
      console.warn('Prototype files array was missing, initializing empty array');
    }
  } else {
    console.log('=== PROTOTYPE GET ===');
    console.log('No prototype found for problem:', problemId);
  }
  
  // Convert prototype to plain object to ensure all data is available in template
  let prototypeData = null;
  if (prototype) {
    prototypeData = prototype.toObject ? prototype.toObject() : JSON.parse(JSON.stringify(prototype));
    // Ensure files array is properly set
    if (!prototypeData.files) {
      prototypeData.files = [];
    }
    // Debug: Log what we're sending to template
    console.log('=== SENDING TO TEMPLATE ===');
    console.log('Prototype data type:', typeof prototypeData);
    console.log('Prototype files:', prototypeData.files);
    console.log('Prototype files length:', prototypeData.files ? prototypeData.files.length : 0);
    console.log('Prototype files is array:', Array.isArray(prototypeData.files));
  }
  
  res.render('prototyping', {
    currentUser: req.user,
    bodyClass: 'mission-launch-body',
    suppressGlobalFlash: true,
    problemId: problemId,
    problem: campground,
    prototype: prototypeData
  });
}));

// POST route to save/update prototype
router.post('/prototyping/:problemId', isLoggedIn, (req, res, next) => {
  upload.array('prototypeFiles')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        if (expectsJson(req)) {
          return res.status(400).json({ ok: false, error: 'Each file must be 5MB or smaller.' });
        }
        req.flash('error', 'Each file must be 5MB or smaller.');
        return res.redirect(`/prototyping/${req.params.problemId}`);
      }
      if (expectsJson(req)) {
        return res.status(400).json({ ok: false, error: 'File upload failed: ' + err.message });
      }
      req.flash('error', 'File upload failed: ' + err.message);
      return res.redirect(`/prototyping/${req.params.problemId}`);
    }
    next();
  });
}, catchAsync(async (req, res) => {
  try {
    const { problemId } = req.params;
    const ajax = expectsJson(req);
    const { title, description, notes } = req.body;
    const additionalLinks = Array.isArray(req.body.additionalLinks)
      ? req.body.additionalLinks
      : (req.body.additionalLinks ? [req.body.additionalLinks] : []);
    const sanitizedAdditionalLinks = additionalLinks
      .map(link => String(link || '').trim())
      .filter(link => link.length > 0);
    
    console.log('=== PROTOTYPE SAVE ===');
    console.log('Problem ID:', problemId);
    console.log('Request body:', req.body);
    console.log('Files uploaded:', req.files ? req.files.length : 0);
    console.log('Files:', req.files);
    console.log('File details:', req.files ? req.files.map(f => ({ path: f.path, filename: f.filename, originalname: f.originalname, mimetype: f.mimetype, resource_type: f.resource_type })) : 'No files');
    
    // Verify the problem belongs to the user
    const campground = await Campground.findById(problemId);
    if (!campground) {
      if (ajax) return res.status(404).json({ ok: false, error: 'Problem statement not found' });
      req.flash('error', 'Problem statement not found');
      return res.redirect('/');
    }
    
    if (campground.author.toString() !== req.user._id.toString()) {
      if (ajax) return res.status(403).json({ ok: false, error: 'You do not have permission to access this problem' });
      req.flash('error', 'You do not have permission to access this problem');
      return res.redirect('/');
    }
    
    // Prepare file data
    const files = req.files ? req.files.map(file => {
      console.log('Processing file:', {
        path: file.path,
        url: file.url,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        resource_type: file.resource_type,
        public_id: file.public_id
      });
      
      // Determine file type from Cloudinary resource_type or mimetype
      let fileType = 'document'; // default
      
      // Check Cloudinary resource_type first
      if (file.resource_type) {
        if (file.resource_type === 'image') {
          fileType = 'image';
        } else if (file.resource_type === 'video') {
          fileType = 'video';
        } else if (file.resource_type === 'raw') {
          fileType = 'document';
        }
      } else if (file.mimetype) {
        // Fallback to mimetype parsing
        const mimeType = file.mimetype.split('/')[0];
        if (mimeType === 'image') {
          fileType = 'image';
        } else if (mimeType === 'video') {
          fileType = 'video';
        } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document') || file.mimetype.includes('text') || file.mimetype.includes('zip') || file.mimetype.includes('rar') || file.mimetype.includes('7z')) {
          fileType = 'document';
        }
      }
      
      // Determine if this is Cloudinary (has secure_url or path is a URL) or disk storage
      let fileUrl;
      const fileName = file.originalname || file.filename || file.public_id || 'file';
      
      // CloudinaryStorage returns the URL in the 'path' property
      // Check if it's a Cloudinary URL (starts with http/https) or a local file path
      if (file.secure_url) {
        fileUrl = file.secure_url;
      } else if (file.url) {
        fileUrl = file.url;
      } else if (file.path) {
        // Check if path is a URL (Cloudinary) or local path (disk storage)
        if (file.path.startsWith('http://') || file.path.startsWith('https://')) {
          fileUrl = file.path;
        } else {
          // Disk storage - path is local, need to create URL path
          const filename = path.basename(file.path);
          fileUrl = `/uploads/${filename}`;
        }
      } else {
        // Fallback - shouldn't happen but handle it
        console.error('File object missing URL information:', file);
        fileUrl = '/uploads/unknown';
      }
      
      return {
        url: fileUrl,
        filename: fileName,
        fileType: fileType,
        uploadedAt: new Date()
      };
    }) : [];
    
    console.log('Processed files:', JSON.stringify(files, null, 2));
    
    // Ensure title is provided (required field) - use default if empty
    const prototypeTitle = (title && title.trim() !== '') ? title.trim() : 'Prototype';
  
  let prototype;
  if (campground.prototype) {
    // Update existing prototype
    prototype = await Prototype.findById(campground.prototype);
    if (prototype) {
      prototype.title = prototypeTitle;
      prototype.description = description !== undefined ? description : prototype.description;
      prototype.notes = notes !== undefined ? notes : prototype.notes;
        prototype.additionalLinks = sanitizedAdditionalLinks;
      if (files.length > 0) {
        console.log('Adding files to existing prototype. Current files:', prototype.files ? prototype.files.length : 0);
        // Ensure files array exists
        if (!prototype.files || !Array.isArray(prototype.files)) {
          prototype.files = [];
        }
        prototype.files.push(...files);
        // Mark files array as modified to ensure Mongoose saves it
        prototype.markModified('files');
        console.log('After adding files. Total files:', prototype.files.length);
      }
      prototype.updatedAt = Date.now();
      await prototype.save();
      console.log('Prototype updated:', prototype._id);
      console.log('Prototype files after save:', JSON.stringify(prototype.files, null, 2));
    } else {
      // Prototype reference exists but prototype was deleted, create new one
      prototype = new Prototype({
        title: prototypeTitle,
        description: description || '',
        additionalLinks: sanitizedAdditionalLinks,
        notes: notes || '',
        files: files,
        user: req.user._id,
        username: req.user.username,
        problemId: problemId
      });
      await prototype.save();
      console.log('New prototype created (replacement):', prototype._id);
      campground.prototype = prototype._id;
      await campground.save();
    }
  } else {
    // Create new prototype
    prototype = new Prototype({
      title: prototypeTitle,
      description: description || '',
      additionalLinks: sanitizedAdditionalLinks,
      notes: notes || '',
      files: files,
      user: req.user._id,
      username: req.user.username,
      problemId: problemId
    });
    await prototype.save();
    console.log('New prototype created:', prototype._id);
    
    // Link prototype to campground - ensure it's saved using updateOne
    if (!campground.prototype || campground.prototype.toString() !== prototype._id.toString()) {
      const updateResult = await Campground.updateOne(
        { _id: problemId },
        { $set: { prototype: prototype._id } }
      );
      console.log('Campground updated with prototype reference:', prototype._id, 'Modified:', updateResult.modifiedCount);
      
      // Verify the link was saved
      const verifyCamp = await Campground.findById(problemId);
      console.log('Verification - campground.prototype after save:', verifyCamp.prototype);
    }
  }
  
    // Ensure campground has prototype reference using updateOne
    const updatedCampground = await Campground.findById(problemId);
    if (!updatedCampground.prototype || updatedCampground.prototype.toString() !== prototype._id.toString()) {
      const updateResult = await Campground.updateOne(
        { _id: problemId },
        { $set: { prototype: prototype._id } }
      );
      console.log('Ensured campground has prototype reference, modified:', updateResult.modifiedCount);
    }
    
    // Reload prototype to ensure we have the latest data
    prototype = await Prototype.findById(prototype._id);
    console.log('Prototype saved successfully:', prototype._id);
    console.log('Final prototype files count:', prototype.files ? prototype.files.length : 0);
    console.log('Final prototype files:', JSON.stringify(prototype.files, null, 2));
    
    // Ensure files array is properly initialized and saved
    if (!prototype.files || !Array.isArray(prototype.files)) {
      console.warn('Prototype files array was not properly initialized, fixing...');
      prototype.files = files.length > 0 ? files : [];
      prototype.markModified('files');
      await prototype.save();
      // Reload again after fix
      prototype = await Prototype.findById(prototype._id);
    }
    if (ajax) {
      return res.json({
        ok: true,
        message: 'Saved Successfully!',
        files: Array.isArray(prototype.files) ? prototype.files : []
      });
    }

    req.flash('success', files.length > 0 ? `Prototype saved successfully with ${files.length} file(s)!` : 'Prototype saved successfully!');
    res.redirect(`/prototyping/${problemId}`);
  } catch (error) {
    console.error('=== PROTOTYPE SAVE ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request params:', req.params);
    console.error('Request body:', req.body);
    console.error('Files:', req.files);
    if (expectsJson(req)) {
      return res.status(500).json({ ok: false, error: 'Failed to save prototype: ' + (error.message || 'Unknown error') });
    }
    req.flash('error', 'Failed to save prototype: ' + (error.message || 'Unknown error'));
    res.redirect(`/prototyping/${req.params.problemId}`);
  }
}));

// DELETE route to remove a prototype file
router.delete('/prototyping/:problemId/file/:fileIndex', isLoggedIn, catchAsync(async (req, res) => {
  const { problemId, fileIndex } = req.params;
  
  const campground = await Campground.findById(problemId);
  if (!campground || !campground.prototype) {
    return res.status(404).json({ error: 'Prototype not found' });
  }
  
  if (campground.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const prototype = await Prototype.findById(campground.prototype);
  if (!prototype || prototype.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  const index = parseInt(fileIndex);
  if (index >= 0 && index < prototype.files.length) {
    prototype.files.splice(index, 1);
    await prototype.save();
    return res.json({ success: true });
  }
  
  return res.status(400).json({ error: 'Invalid file index' });
}));

module.exports = router;


