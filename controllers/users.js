const User = require('../models/user');
const Campground = require('../models/campgrounds');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/email');
const { getProblemStage } = require('../utils/stageHelper');
const { Idea, Program, School } = require('../models/schemas');

module.exports.renderRegister = (req, res) => {
    res.locals.bodyClass = 'register-page-body';
    res.render('users/register');
}

// Helper: load projects with stage info for a given author
async function loadUserProjectsWithStage(authorId) {
    const campgrounds = await Campground.find({ author: authorId })
        .populate('author')
        .populate('reviews')
        .populate('teamInfo.enrolledProgram')
        .populate('problemStatementInfo.selectedPredefinedProblem')
        .populate('solution')
        .populate('prototype')
        .lean()
        .sort({ createdAt: -1 });

    const campgroundsWithStage = await Promise.all(
        campgrounds.map(async (campground) => {
            let ideaCount = 0;
            try {
                ideaCount = await Idea.countDocuments({ problemId: campground._id });
            } catch (err) {
                ideaCount = 0;
            }

            let campForStage = campground;
            if (campground.prototype) {
                if (typeof campground.prototype === 'object' && campground.prototype._id) {
                    if (!campground.prototype.files || !Array.isArray(campground.prototype.files) || campground.prototype.files.length === 0) {
                        const { Prototype } = require('../models/schemas');
                        const proto = await Prototype.findById(campground.prototype._id);
                        if (proto) {
                            campForStage = { ...campground };
                            campForStage.prototype = proto.toObject ? proto.toObject() : proto;
                        }
                    }
                } else {
                    const { Prototype } = require('../models/schemas');
                    const proto = await Prototype.findById(campground.prototype);
                    if (proto) {
                        campForStage = { ...campground };
                        campForStage.prototype = proto.toObject ? proto.toObject() : proto;
                    }
                }
            }
            const stageInfo = getProblemStage(campForStage, ideaCount);
            const campObj = { ...campground };
            campObj.currentStage = stageInfo.name;
            campObj.stageNumber = stageInfo.stage;
            campObj.progress = stageInfo.progress;
            campObj.ideaCount = ideaCount;
            campObj.stageProgress = stageInfo.stageProgress;
            return campObj;
        })
    );

    return campgroundsWithStage;
}

module.exports.renderDashboard = async (req, res) => {
    try {
        console.log('Rendering dashboard for user:', req.user._id);

        // If this is a team account, render a different dashboard
        if (req.user.isTeam) {
            const teamProjects = await loadUserProjectsWithStage(req.user._id);

            // Load member details for display
            const members = await User.find({ _id: { $in: req.user.teamMembers || [] } })
                .select('username email schoolName programName')
                .lean();

            return res.render('users/team-dashboard', {
                currentUser: req.user,
                projects: teamProjects,
                members
            });
        }

        // Individual dashboard (existing behaviour)
        const campgroundsWithStage = await loadUserProjectsWithStage(req.user._id);

        console.log('Found campgrounds:', campgroundsWithStage.length);
        res.render('users/dashboard', { campgrounds: campgroundsWithStage, currentUser: req.user });
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/campgrounds');
    }
}

module.exports.register = async(req, res) => {
    try{
        const {email, username, password} = req.body;
        const user = new User ({email, username});
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if(err) return next(err);
            res.redirect('/');
        })
    }catch(e){
        req.flash('error', e.message);
        res.redirect('register');
    }
}

module.exports.renderLogin = (req, res) => {
    res.locals.bodyClass = 'login-page-body';
    res.render('users/login');
}

module.exports.login = (req, res) => {
    delete req.session.returnTo;
    res.redirect('/');
}

module.exports.logout = (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
}

// Google OAuth callback
module.exports.googleCallback = (req, res) => {
    delete req.session.returnTo;
    res.redirect('/');
}

// Forgot password - render form
module.exports.renderForgotPassword = (req, res) => {
    res.render('users/forgot-password');
}

// Forgot password - send reset email
module.exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot-password');
        }
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();
        
        // Send email (build base URL from the current request to avoid BASE_URL issues)
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await sendPasswordResetEmail(user.email, resetToken, baseUrl);
        
        if (result && result.success) {
            let message = 'Password reset email sent! Check your inbox.';
            if (result.previewUrl) {
                message += ` Preview: ${result.previewUrl}`;
                console.log('Password reset email preview URL:', result.previewUrl);
            }
            req.flash('success', message);
        } else {
            // As a dev convenience, show the direct link if email couldn't be sent
            const fallbackUrl = `${baseUrl}/reset-password/${resetToken}`;
            console.error('Password reset email error:', result && result.error);
            req.flash('error', `Email could not be sent. Use this link to reset now: ${fallbackUrl}`);
        }
        
        res.redirect('/forgot-password');
    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/forgot-password');
    }
}

// Reset password - render form
module.exports.renderResetPassword = async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }
        
        res.render('users/reset-password', { token: req.params.token });
    } catch (error) {
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/forgot-password');
    }
}

// Reset password - update password
module.exports.resetPassword = async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }
        
        if (req.body.password !== req.body.confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect(`/reset-password/${req.params.token}`);
        }
        
        await user.setPassword(req.body.password);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        
        req.flash('success', 'Password has been reset successfully!');
        res.redirect('/login');
    } catch (error) {
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/forgot-password');
    }
}

// ===== TEAM CREATION FEATURE =====

// Show page where an individual can choose school/program and
// see other individuals from that combination to create a team.
module.exports.renderCreateTeam = async (req, res) => {
    try {
        // Only individual users can create teams
        if (req.user.isTeam) {
            req.flash('error', 'Teams cannot create other teams.');
            return res.redirect('/dashboard');
        }

        const schools = await School.find({ isActive: true }).sort({ name: 1 }).lean();
        const programs = await Program.find({ isActive: true }).sort({ name: 1 }).lean();

        const { school: selectedSchoolId, program: selectedProgramId } = req.query;

        let candidates = [];
        let selectedSchool = null;
        let selectedProgram = null;

        if (selectedSchoolId && selectedProgramId) {
            selectedSchool = schools.find(s => String(s._id) === String(selectedSchoolId)) || null;
            selectedProgram = programs.find(p => String(p._id) === String(selectedProgramId)) || null;

            // Find candidate users that:
            // - are not teams
            // - are not already in any team
            // - are not the current user
            // - (optionally) already associated with this school & program
            const baseFilter = {
                isTeam: false,
                _id: { $ne: req.user._id },
                $or: [{ teams: { $exists: false } }, { teams: { $size: 0 } }]
            };

            const possibleUsers = await User.find(baseFilter)
                .select('username email school program schoolName programName')
                .lean();

            candidates = possibleUsers.filter(u => {
                // If user already has school/program set, require match
                if (u.school || u.program) {
                    const schoolMatch = !u.school || String(u.school) === String(selectedSchoolId);
                    const programMatch = !u.program || String(u.program) === String(selectedProgramId);
                    return schoolMatch && programMatch;
                }
                // If not set, allow them as candidate for this combination
                return true;
            });
        }

        res.render('users/create-team', {
            currentUser: req.user,
            schools,
            programs,
            selectedSchoolId: selectedSchoolId || '',
            selectedProgramId: selectedProgramId || '',
            selectedSchool,
            selectedProgram,
            candidates
        });
    } catch (error) {
        console.error('Error rendering create team page:', error);
        req.flash('error', 'Error loading team creation page.');
        res.redirect('/dashboard');
    }
};

// Handle POST to actually create the team account.
module.exports.createTeam = async (req, res) => {
    try {
        if (req.user.isTeam) {
            req.flash('error', 'Teams cannot create other teams.');
            return res.redirect('/dashboard');
        }

        const { teamName, teamPassword, members = [], schoolId, programId } = req.body;

        if (!teamName || !teamPassword) {
            req.flash('error', 'Team name and password are required.');
            return res.redirect('/teams/new');
        }

        // Ensure current user is always part of the team
        const memberIds = Array.isArray(members) ? members.slice() : (members ? [members] : []);
        if (!memberIds.includes(String(req.user._id))) {
            memberIds.push(String(req.user._id));
        }

        // Deduplicate member ids
        const uniqueMemberIds = [...new Set(memberIds)];

        if (!schoolId || !programId) {
            req.flash('error', 'Please select a school and a program.');
            return res.redirect('/teams/new');
        }

        const schoolDoc = await School.findById(schoolId);
        const programDoc = await Program.findById(programId);

        // Generate a unique team username based on owner username
        let baseUsername = `${req.user.username}_team`;
        let candidateUsername = baseUsername;
        let suffix = 1;
        // eslint-disable-next-line no-constant-condition
        while (await User.findOne({ username: candidateUsername })) {
            suffix += 1;
            candidateUsername = `${baseUsername}${suffix}`;
        }

        // Create the team user account
        const teamUser = new User({
            email: `${candidateUsername}@team.local`, // not used for login, just required by schema
            username: candidateUsername,
            displayName: teamName,
            isTeam: true,
            teamMembers: uniqueMemberIds,
            teamOwner: req.user._id,
            school: schoolDoc ? schoolDoc._id : undefined,
            program: programDoc ? programDoc._id : undefined,
            schoolName: schoolDoc ? schoolDoc.name : undefined,
            programName: programDoc ? programDoc.name : undefined
        });

        const registeredTeam = await User.register(teamUser, teamPassword);

        // Mark team membership and school/program on individual user records
        await User.updateMany(
            { _id: { $in: uniqueMemberIds } },
            {
                $addToSet: { teams: registeredTeam._id },
                $set: {
                    school: schoolDoc ? schoolDoc._id : undefined,
                    program: programDoc ? programDoc._id : undefined,
                    schoolName: schoolDoc ? schoolDoc.name : undefined,
                    programName: programDoc ? programDoc.name : undefined
                }
            }
        );

        req.flash(
            'success',
            `Team "${teamName}" created successfully! You can now log in as the team using username "${registeredTeam.username}".`
        );
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error creating team:', error);
        req.flash('error', error.message || 'Error creating team.');
        res.redirect('/teams/new');
    }
};
