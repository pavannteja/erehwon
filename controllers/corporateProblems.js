const CorporateProblem = require('../models/corporateProblem');
const Campground = require('../models/campgrounds');
const { getProblemStage } = require('../utils/stageHelper');

// Get all corporate problems (for browsing)
module.exports.index = async (req, res) => {
    try {
        const corporateProblems = await CorporateProblem.find({ isActive: true })
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });
        
        res.render('corporateProblems/index', { 
            corporateProblems,
            currentUser: req.user 
        });
    } catch (error) {
        console.error('Error fetching corporate problems:', error);
        req.flash('error', 'Error loading corporate problems');
        res.redirect('/');
    }
};

// Show form to create new corporate problem (only for problem creators)
module.exports.renderNewForm = (req, res) => {
    res.render('corporateProblems/new', { currentUser: req.user });
};

// Create new corporate problem
module.exports.createCorporateProblem = async (req, res) => {
    try {
        const corporateProblemData = { ...(req.body.corporateProblem || {}) };
        // HTML checkbox sends "on" when checked; normalize to actual boolean for Mongoose.
        corporateProblemData.isActive =
            corporateProblemData.isActive === true ||
            corporateProblemData.isActive === 'true' ||
            corporateProblemData.isActive === 'on';

        const corporateProblem = new CorporateProblem(corporateProblemData);
        corporateProblem.createdBy = req.user._id;
        await corporateProblem.save();
        req.flash('success', 'Corporate problem statement created successfully!');
        res.redirect('/corporate-problems');
    } catch (error) {
        console.error('Error creating corporate problem:', error);
        req.flash('error', 'Error creating corporate problem');
        res.redirect('/corporate-problems/new');
    }
};

// Show single corporate problem
module.exports.showCorporateProblem = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateProblem = await CorporateProblem.findById(id)
            .populate('createdBy', 'username');
        
        if (!corporateProblem) {
            req.flash('error', 'Corporate problem not found');
            return res.redirect('/corporate-problems');
        }
        
        res.render('corporateProblems/show', { 
            corporateProblem,
            currentUser: req.user 
        });
    } catch (error) {
        console.error('Error fetching corporate problem:', error);
        req.flash('error', 'Error loading corporate problem');
        res.redirect('/corporate-problems');
    }
};

// Show edit form (only for problem creators)
module.exports.renderEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateProblem = await CorporateProblem.findById(id);
        
        if (!corporateProblem) {
            req.flash('error', 'Corporate problem not found');
            return res.redirect('/corporate-problems');
        }
        
        res.render('corporateProblems/edit', { 
            corporateProblem,
            currentUser: req.user 
        });
    } catch (error) {
        console.error('Error fetching corporate problem for edit:', error);
        req.flash('error', 'Error loading corporate problem');
        res.redirect('/corporate-problems');
    }
};

// Update corporate problem
module.exports.updateCorporateProblem = async (req, res) => {
    const { id } = req.params;
    try {
        const corporateProblemData = { ...(req.body.corporateProblem || {}) };
        // Ensure checkbox value is cast safely.
        corporateProblemData.isActive =
            corporateProblemData.isActive === true ||
            corporateProblemData.isActive === 'true' ||
            corporateProblemData.isActive === 'on';

        const corporateProblem = await CorporateProblem.findByIdAndUpdate(id, corporateProblemData, { new: true });
        
        if (!corporateProblem) {
            req.flash('error', 'Corporate problem not found');
            return res.redirect('/corporate-problems');
        }
        
        req.flash('success', 'Corporate problem updated successfully!');
        res.redirect(`/corporate-problems/${id}`);
    } catch (error) {
        console.error('Error updating corporate problem:', error);
        req.flash('error', 'Error updating corporate problem');
        res.redirect(`/corporate-problems/${id}/edit`);
    }
};

// Delete corporate problem
module.exports.deleteCorporateProblem = async (req, res) => {
    try {
        const { id } = req.params;
        await CorporateProblem.findByIdAndDelete(id);
        req.flash('success', 'Corporate problem deleted successfully!');
        res.redirect('/corporate-problems');
    } catch (error) {
        console.error('Error deleting corporate problem:', error);
        req.flash('error', 'Error deleting corporate problem');
        res.redirect('/corporate-problems');
    }
};

// Adopt a corporate problem - creates a new project for the user
module.exports.adoptCorporateProblem = async (req, res) => {
    try {
        const { id } = req.params;
        const corporateProblem = await CorporateProblem.findById(id);
        
        if (!corporateProblem) {
            req.flash('error', 'Corporate problem not found');
            return res.redirect('/corporate-problems');
        }
        
        // Create a new campground (project) based on the corporate problem
        const newProject = new Campground({
            title: corporateProblem.title,
            description: corporateProblem.description,
            problem: corporateProblem.problemStatement.whatIsProblem || corporateProblem.description,
            author: req.user._id,
            problemStatementInfo: {
                problemType: 'custom',
                customProblem: {
                    whoHasProblem: corporateProblem.problemStatement.whoHasProblem || '',
                    whatIsProblem: corporateProblem.problemStatement.whatIsProblem || corporateProblem.description,
                    expectedBenefit: corporateProblem.problemStatement.expectedBenefit || ''
                }
            },
            // Mark that this was adopted from a corporate problem
            adoptedFromCorporateProblem: corporateProblem._id
        });
        
        await newProject.save();
        req.flash('success', 'Corporate problem adopted! You can now start working on it.');
        res.redirect(`/problems/${newProject._id}`);
    } catch (error) {
        console.error('Error adopting corporate problem:', error);
        req.flash('error', 'Error adopting corporate problem');
        res.redirect('/corporate-problems');
    }
};

