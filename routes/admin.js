const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { isLoggedIn } = require('../middleware');
const { Program, School, SchoolProgram, PredefinedProblem } = require('../models/schemas');
const User = require('../models/user');
const CorporateProblem = require('../models/corporateProblem');
const Campground = require('../models/campgrounds');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'problems-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.xlsx', '.xls', '.numbers'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) or Numbers files (.numbers) are allowed! If using Numbers, please export as Excel first.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  console.log('=== ADMIN CHECK ===');
  console.log('User:', req.user ? req.user.username : 'Not logged in');
  console.log('isAdmin:', req.user ? req.user.isAdmin : 'N/A');
  
  if (!req.user) {
    console.log('No user found - redirecting to login');
    req.flash('error', 'You must be logged in to access this page.');
    return res.redirect('/login');
  }
  
  // Refresh user from database to ensure isAdmin is current
  User.findById(req.user._id).then(user => {
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/login');
    }
    
    console.log('User from DB - isAdmin:', user.isAdmin);
    
    if (!user.isAdmin) {
      console.log('User is not admin - redirecting to dashboard');
      req.flash('error', 'You do not have permission to access this page. Contact an administrator to grant you admin access.');
      return res.redirect('/dashboard');
    }
    
    // Update req.user with fresh data
    req.user = user;
    next();
  }).catch(error => {
    console.error('Error checking admin status:', error);
    req.flash('error', 'Error checking permissions.');
    res.redirect('/dashboard');
  });
};

// Admin Dashboard
router.get('/admin/dashboard', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const programs = await Program.find().sort({ name: 1 });
    const schools = await School.find().sort({ name: 1 });
    const schoolPrograms = await SchoolProgram.find()
      .populate('school')
      .populate('program')
      .sort({ enrolledAt: -1 });
    
    // Get problem statements summary by SDG
    const problemSummary = await PredefinedProblem.aggregate([
      {
        $group: {
          _id: '$sdgGoal',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const totalProblems = await PredefinedProblem.countDocuments();
    
    // Get all users and problem creators
    const allUsers = await User.find().sort({ username: 1 });
    const problemCreators = allUsers.filter(u => u.isProblemCreator);

    // Corporate problems + adopting teams/projects (for admin visibility)
    const corporateProblems = await CorporateProblem.find()
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .lean();

    const adoptedProjects = await Campground.find({
      adoptedFromCorporateProblem: { $exists: true, $ne: null }
    })
      .select('title adoptedFromCorporateProblem author teamInfo createdAt')
      .populate({
        path: 'author',
        select: 'username email isTeam teamMembers schoolName programName',
        populate: {
          path: 'teamMembers',
          select: 'username email'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    const adoptedByProblemId = new Map();
    for (const project of adoptedProjects) {
      const problemId = String(project.adoptedFromCorporateProblem);
      if (!adoptedByProblemId.has(problemId)) {
        adoptedByProblemId.set(problemId, []);
      }
      adoptedByProblemId.get(problemId).push(project);
    }

    const corporateProblemAdoptions = corporateProblems.map(problem => {
      const relatedProjects = adoptedByProblemId.get(String(problem._id)) || [];
      const adopterProjects = relatedProjects.filter(project => !!project.author);
      return {
        ...problem,
        adoptedProjects: adopterProjects,
        adoptedCount: adopterProjects.length
      };
    });

    res.render('admin/dashboard', {
      currentUser: req.user,
      programs,
      schools,
      schoolPrograms,
      problemSummary,
      totalProblems,
      allUsers,
      problemCreators,
      corporateProblemAdoptions
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    req.flash('error', 'Error loading admin dashboard.');
    res.redirect('/dashboard');
  }
});

// ========== PROGRAM ROUTES ==========

// Get all programs (API)
router.get('/admin/api/programs', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const programs = await Program.find().sort({ name: 1 });
    res.json(programs);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// Create new program
router.post('/admin/programs', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    const program = new Program({
      name,
      description
    });
    await program.save();
    req.flash('success', `Program "${name}" created successfully!`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error creating program:', error);
    if (error.code === 11000) {
      req.flash('error', 'A program with this name already exists.');
    } else {
      req.flash('error', 'Failed to create program.');
    }
    res.redirect('/admin/dashboard');
  }
});

// Update program - handle both PUT (via method-override) and POST
const updateProgram = async (req, res) => {
  try {
    console.log('Update program route hit:', req.method, req.path, req.params.id);
    console.log('Request body:', req.body);
    const { name, description, isActive } = req.body;
    const program = await Program.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        isActive: isActive === 'on' || isActive === true,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );
    if (!program) {
      req.flash('error', 'Program not found.');
      return res.redirect('/admin/dashboard');
    }
    req.flash('success', 'Program updated successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error updating program:', error);
    req.flash('error', 'Failed to update program.');
    res.redirect('/admin/dashboard');
  }
};

router.put('/admin/programs/:id', isLoggedIn, isAdmin, updateProgram);
router.post('/admin/programs/:id', isLoggedIn, isAdmin, (req, res, next) => {
  // Check if _method is PUT, if so handle as PUT
  if (req.body._method === 'PUT') {
    return updateProgram(req, res, next);
  }
  next(); // Otherwise continue to next route
});

// Delete program
router.delete('/admin/programs/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    // Check if any schools are enrolled in this program
    const enrollments = await SchoolProgram.find({ program: program._id });
    if (enrollments.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete program. ${enrollments.length} school(s) are enrolled in this program.` 
      });
    }
    
    await Program.findByIdAndDelete(req.params.id);
    req.flash('success', 'Program deleted successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error deleting program:', error);
    req.flash('error', 'Failed to delete program.');
    res.redirect('/admin/dashboard');
  }
});

// ========== SCHOOL ROUTES ==========

// Get all schools (API)
router.get('/admin/api/schools', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const schools = await School.find().sort({ name: 1 });
    res.json(schools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// Create new school
router.post('/admin/schools', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, address, city, state, country } = req.body;
    const school = new School({
      name,
      address,
      city,
      state,
      country: country || 'India'
    });
    await school.save();
    req.flash('success', `School "${name}" created successfully!`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error creating school:', error);
    if (error.code === 11000) {
      req.flash('error', 'A school with this name already exists.');
    } else {
      req.flash('error', 'Failed to create school.');
    }
    res.redirect('/admin/dashboard');
  }
});

// Update school
router.put('/admin/schools/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, address, city, state, country, isActive } = req.body;
    const school = await School.findByIdAndUpdate(
      req.params.id,
      {
        name,
        address,
        city,
        state,
        country: country || 'India',
        isActive: isActive === 'on' || isActive === true,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    req.flash('success', 'School updated successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error updating school:', error);
    req.flash('error', 'Failed to update school.');
    res.redirect('/admin/dashboard');
  }
});

// Delete school
router.delete('/admin/schools/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    // Delete all enrollments for this school
    await SchoolProgram.deleteMany({ school: school._id });
    
    await School.findByIdAndDelete(req.params.id);
    req.flash('success', 'School deleted successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error deleting school:', error);
    req.flash('error', 'Failed to delete school.');
    res.redirect('/admin/dashboard');
  }
});

// ========== SCHOOL-PROGRAM ENROLLMENT ROUTES ==========

// Enroll school in program
router.post('/admin/school-programs', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { schoolId, programId, numberOfStudents } = req.body;
    
    // Check if enrollment already exists
    const existing = await SchoolProgram.findOne({ 
      school: schoolId, 
      program: programId 
    });
    
    if (existing) {
      req.flash('error', 'This school is already enrolled in this program.');
      return res.redirect('/admin/dashboard');
    }
    
    const schoolProgram = new SchoolProgram({
      school: schoolId,
      program: programId,
      numberOfStudents: parseInt(numberOfStudents) || 0
    });
    await schoolProgram.save();
    
    req.flash('success', 'School enrolled in program successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error enrolling school in program:', error);
    if (error.code === 11000) {
      req.flash('error', 'This school is already enrolled in this program.');
    } else {
      req.flash('error', 'Failed to enroll school in program.');
    }
    res.redirect('/admin/dashboard');
  }
});

// Update school-program enrollment (number of students)
router.put('/admin/school-programs/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { numberOfStudents, isActive } = req.body;
    const schoolProgram = await SchoolProgram.findByIdAndUpdate(
      req.params.id,
      {
        numberOfStudents: parseInt(numberOfStudents) || 0,
        isActive: isActive === 'on' || isActive === true,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!schoolProgram) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    req.flash('success', 'Enrollment updated successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error updating enrollment:', error);
    req.flash('error', 'Failed to update enrollment.');
    res.redirect('/admin/dashboard');
  }
});

// Remove school from program
router.delete('/admin/school-programs/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    await SchoolProgram.findByIdAndDelete(req.params.id);
    req.flash('success', 'School removed from program successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error removing school from program:', error);
    req.flash('error', 'Failed to remove school from program.');
    res.redirect('/admin/dashboard');
  }
});

// Upload Excel file with problem statements
router.post('/admin/upload-problems', isLoggedIn, isAdmin, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'Please select an Excel file to upload.');
      return res.redirect('/admin/dashboard');
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    console.log('Processing file:', filePath);
    console.log('File extension:', fileExt);
    console.log('Original filename:', req.file.originalname);
    
    // If it's a Numbers file, provide helpful error
    if (fileExt === '.numbers') {
      req.flash('error', 'Numbers files (.numbers) are not directly supported. Please export your Numbers file as Excel (.xlsx) format first: In Numbers, go to File → Export To → Excel');
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up Numbers file:', cleanupError);
      }
      return res.redirect('/admin/dashboard');
    }

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // First, try to find the actual header row (skip Numbers export metadata)
    // Numbers exports often have a metadata row at the top
    let headerRowIndex = 0;
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    console.log('Sheet range:', range);
    console.log('Checking rows 0-10 for headers...');
    
    // Check first few rows to find the header row
    for (let row = 0; row <= Math.min(10, range.e.r); row++) {
      const cellA = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })]; // Column A
      const cellB = worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })]; // Column B
      const cellC = worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })]; // Column C
      
      const valueA = cellA ? (cellA.v || '').toString() : '';
      const valueB = cellB ? (cellB.v || '').toString() : '';
      const valueC = cellC ? (cellC.v || '').toString() : '';
      
      console.log(`Row ${row}: A="${valueA}", B="${valueB}", C="${valueC}"`);
      
      if (cellA && cellB) {
        const valueALower = valueA.toLowerCase();
        const valueBLower = valueB.toLowerCase();
        
        // Skip Numbers export metadata row
        if (valueALower.includes('exported from numbers') || valueALower.includes('this document was exported')) {
          console.log(`Skipping Numbers metadata row at index: ${row}`);
          headerRowIndex = row + 1;
          continue;
        }
        
        // Check if this row looks like headers (contains "sdg" and "problem" or "statement")
        if ((valueALower.includes('sdg') || valueALower.includes('goal')) && 
            (valueBLower.includes('problem') || valueBLower.includes('statement'))) {
          headerRowIndex = row;
          console.log(`✓ Found header row at index: ${row}`);
          break;
        }
      }
    }
    
    console.log(`Using header row index: ${headerRowIndex}`);
    
    // Read data starting from the detected header row
    // Use sheet_to_json with header option
    let data;
    if (headerRowIndex === 0) {
      // If header is in first row, use default behavior
      data = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', 
        raw: false
      });
    } else {
      // If header is not in first row, we need to manually read
      // First, read the header row - find all non-empty columns
      const headerRow = [];
      const maxCols = Math.min(range.e.c, 20); // Limit to 20 columns
      
      for (let col = 0; col <= maxCols; col++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: col })];
        const value = cell ? (cell.v || '').toString().trim() : '';
        if (value && !value.toLowerCase().includes('exported from numbers')) {
          headerRow.push(value);
        } else {
          // Use column letter as fallback for empty headers
          const colLetter = XLSX.utils.encode_col(col);
          headerRow.push(`Column_${colLetter}`);
        }
      }
      
      console.log('Header row values:', headerRow);
      console.log('Number of header columns:', headerRow.length);
      
      // Now read data rows
      data = [];
      for (let row = headerRowIndex + 1; row <= range.e.r; row++) {
        const rowData = {};
        let hasData = false;
        for (let col = 0; col < headerRow.length && col <= maxCols; col++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
          const value = cell ? (cell.v || '').toString().trim() : '';
          if (value) hasData = true;
          rowData[headerRow[col]] = value;
        }
        if (hasData) {
          data.push(rowData);
        }
      }
      
      console.log('Manually read data rows:', data.length);
    }
    
    // Fallback: if no data found, try reading without header detection
    if (data.length === 0 || Object.keys(data[0] || {}).length === 0) {
      console.log('Fallback: Trying to read file without header detection...');
      const fallbackData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', 
        raw: false,
        header: 1 // Use first row as headers
      });
      
      if (fallbackData.length > 1) {
        // First row is headers, rest is data
        const fallbackHeaders = fallbackData[0] || [];
        console.log('Fallback headers:', fallbackHeaders);
        
        data = [];
        for (let i = 1; i < fallbackData.length; i++) {
          const rowData = {};
          let hasData = false;
          fallbackHeaders.forEach((header, idx) => {
            const value = (fallbackData[i][idx] || '').toString().trim();
            if (value) hasData = true;
            rowData[header || `Column_${idx}`] = value;
          });
          if (hasData) {
            data.push(rowData);
          }
        }
        console.log('Fallback data rows:', data.length);
      }
    }

    console.log('Data rows found:', data.length);
    if (data.length > 0) {
      console.log('First data row keys:', Object.keys(data[0]));
    }

    if (data.length === 0) {
      req.flash('error', 'Excel file is empty or has no data. Make sure your headers are in the first row.');
      return res.redirect('/admin/dashboard');
    }

    // Find column names - get all headers from first row
    const headers = Object.keys(data[0]);
    console.log('All detected headers:', headers);
    
    // Filter out empty or metadata columns
    const validHeaders = headers.filter(h => {
      const header = h.toString().trim();
      return header && 
             !header.toLowerCase().startsWith('__empty') && 
             !header.toLowerCase().includes('exported from numbers') &&
             !header.toLowerCase().includes('this document was exported') &&
             header.length > 0;
    });
    
    console.log('Valid headers (after filtering):', validHeaders);
    
    // If validHeaders is empty, try using all headers (less filtering)
    const headersToUse = validHeaders.length > 0 ? validHeaders : headers.filter(h => {
      const header = h.toString().trim();
      return header && header.length > 0 && !header.toLowerCase().startsWith('__empty');
    });
    
    console.log('Headers to use for detection:', headersToUse);
    
    // More flexible column detection - trim and normalize
    const normalizeHeader = (h) => h.toString().trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Use headersToUse for column detection
    const sdgColumn = headersToUse.find(h => {
      const normalized = normalizeHeader(h);
      return (normalized.includes('sdg') && normalized.includes('goal')) ||
             normalized === 'sdg goal' ||
             normalized.startsWith('sdg') ||
             normalized.includes('goal');
    });
    
    const problemColumn = headersToUse.find(h => {
      const normalized = normalizeHeader(h);
      return (normalized.includes('problem') && normalized.includes('statement')) ||
             normalized === 'problem statement' ||
             normalized.includes('problem') ||
             normalized.includes('statement');
    });
    
    // Find stakeholder columns (can be 3 separate columns or one combined)
    const stakeholderColumns = headersToUse.filter(h => {
      const normalized = normalizeHeader(h);
      return normalized.includes('stakeholder') || normalized.includes('recommended');
    });
    
    // Also check for specific column names like "Stakeholder 1", "Stakeholder 2", etc.
    const stakeholder1Column = headersToUse.find(h => {
      const normalized = normalizeHeader(h);
      return normalized.includes('stakeholder') && (normalized.includes('1') || normalized.endsWith('1'));
    });
    const stakeholder2Column = headersToUse.find(h => {
      const normalized = normalizeHeader(h);
      return normalized.includes('stakeholder') && (normalized.includes('2') || normalized.endsWith('2'));
    });
    const stakeholder3Column = headersToUse.find(h => {
      const normalized = normalizeHeader(h);
      return normalized.includes('stakeholder') && (normalized.includes('3') || normalized.endsWith('3'));
    });

    console.log('Column detection results:');
    console.log('  SDG Column:', sdgColumn);
    console.log('  Problem Column:', problemColumn);
    console.log('  Stakeholder 1:', stakeholder1Column);
    console.log('  Stakeholder 2:', stakeholder2Column);
    console.log('  Stakeholder 3:', stakeholder3Column);
    console.log('  All headers:', headers);
    console.log('  Headers to use:', headersToUse);

    if (!sdgColumn || !problemColumn) {
      // Try alternative: read first data row to see what columns have data
      let sampleRow = null;
      if (data.length > 0) {
        sampleRow = data[0];
        console.log('Sample data row:', sampleRow);
      }
      
      const errorMsg = `Excel file must have columns: SDG Goal and Problem Statement. 
      
Found columns: ${headersToUse.length > 0 ? headersToUse.join(', ') : 'None detected'}
All detected headers: ${headers.join(', ')}

Please check:
1. Your Excel file has headers in the first row (or first data row after Numbers metadata)
2. Headers are named: "SDG Goal" (or contains "SDG" and "Goal") and "Problem Statement" (or contains "Problem" and "Statement")
3. If exported from Numbers, delete the metadata row before exporting`;
      
      console.error('Column detection failed:', errorMsg);
      req.flash('error', errorMsg);
      return res.redirect('/admin/dashboard');
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const sdgGoal = row[sdgColumn] ? row[sdgColumn].toString().trim() : '';
      const problemStatement = row[problemColumn] ? row[problemColumn].toString().trim() : '';

      // Skip empty rows
      if (!sdgGoal || !problemStatement || sdgGoal === '' || problemStatement === '') {
        skipped++;
        if (i < 5) { // Log first few skipped rows for debugging
          console.log(`Skipping row ${i + 2}: sdgGoal="${sdgGoal}", problemStatement="${problemStatement}"`);
        }
        continue;
      }

      // Parse stakeholders - check for 3 separate columns first, then fall back to single column
      let recommendedStakeholders = [];
      
      // Method 1: Check for 3 separate stakeholder columns
      if (stakeholder1Column || stakeholder2Column || stakeholder3Column) {
        const s1 = stakeholder1Column ? row[stakeholder1Column]?.toString().trim() : '';
        const s2 = stakeholder2Column ? row[stakeholder2Column]?.toString().trim() : '';
        const s3 = stakeholder3Column ? row[stakeholder3Column]?.toString().trim() : '';
        
        if (s1) recommendedStakeholders.push(s1);
        if (s2) recommendedStakeholders.push(s2);
        if (s3) recommendedStakeholders.push(s3);
      }
      // Method 2: Check for single stakeholder column (comma-separated or single value)
      else if (stakeholderColumns.length > 0) {
        const stakeholdersStr = row[stakeholderColumns[0]]?.toString().trim() || '';
        if (stakeholdersStr) {
          recommendedStakeholders = stakeholdersStr
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
      }

      try {
        // Check if already exists
        const existing = await PredefinedProblem.findOne({
          sdgGoal: sdgGoal,
          problemStatement: problemStatement
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create new problem
        const problem = new PredefinedProblem({
          sdgGoal: sdgGoal,
          problemStatement: problemStatement,
          recommendedStakeholders: recommendedStakeholders
        });

        await problem.save();
        imported++;
      } catch (error) {
        errors++;
        console.error(`Error importing row ${i + 2}:`, error.message);
      }
    }

    // Clean up uploaded file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Uploaded file cleaned up:', filePath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }

    req.flash('success', `Successfully imported ${imported} problem statement(s). ${skipped} skipped, ${errors} errors.`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error uploading problems:', error);
    
    // Clean up uploaded file even on error
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Uploaded file cleaned up after error:', req.file.path);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file after error:', cleanupError);
    }
    
    req.flash('error', 'Error processing Excel file: ' + error.message);
    res.redirect('/admin/dashboard');
  }
});

// Get all problem statements (API)
router.get('/admin/problems', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const problems = await PredefinedProblem.find().sort({ sdgGoal: 1, createdAt: -1 });
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// Delete a problem statement
router.delete('/admin/problems/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    await PredefinedProblem.findByIdAndDelete(req.params.id);
    req.flash('success', 'Problem statement deleted successfully!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    req.flash('error', 'Error deleting problem statement.');
    res.redirect('/admin/dashboard');
  }
});

// ========== PROBLEM CREATOR MANAGEMENT ==========

// Get all users with problem creator status
router.get('/admin/problem-creators', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ username: 1 });
    const problemCreators = users.filter(u => u.isProblemCreator);
    res.json({ users, problemCreators });
  } catch (error) {
    console.error('Error fetching problem creators:', error);
    res.status(500).json({ error: 'Failed to fetch problem creators' });
  }
});

// Make a user a problem creator
router.post('/admin/users/:userId/make-problem-creator', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { isProblemCreator: true }, { new: true });
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/dashboard');
    }
    req.flash('success', `User "${user.username}" is now a problem creator!`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error making user problem creator:', error);
    req.flash('error', 'Error updating user permissions.');
    res.redirect('/admin/dashboard');
  }
});

// Remove problem creator status
router.post('/admin/users/:userId/remove-problem-creator', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { isProblemCreator: false }, { new: true });
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/dashboard');
    }
    req.flash('success', `Problem creator status removed from "${user.username}".`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error removing problem creator status:', error);
    req.flash('error', 'Error updating user permissions.');
    res.redirect('/admin/dashboard');
  }
});

module.exports = router;


