const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const User = require('../models/user');
const passport = require('passport');
const { storeReturnTo, isLoggedIn } = require('../middleware');
const users = require('../controllers/users');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/email');

// Google OAuth routes
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
    users.googleCallback
);

// Regular auth routes
router.get('/register', users.renderRegister);
router.post('/register', catchAsync(users.register));

router.get('/login', users.renderLogin);
router.post(
    '/login',
    storeReturnTo,
    passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }),
    users.login
);

// Dashboard (individual or team, decided in controller)
router.get('/dashboard', isLoggedIn, catchAsync(users.renderDashboard));
router.get('/dashboard/new-project', isLoggedIn, users.renderNewProjectForm);
router.post('/dashboard/new-project', isLoggedIn, catchAsync(users.createNewProject));
router.get('/dashboard/projects/:id/edit', isLoggedIn, catchAsync(users.renderEditCustomProjectForm));
router.post('/dashboard/projects/:id/edit', isLoggedIn, catchAsync(users.updateCustomProject));

// Team creation routes (individual users only)
router.get('/teams/new', isLoggedIn, catchAsync(users.renderCreateTeam));
router.post('/teams', isLoggedIn, catchAsync(users.createTeam));

// Forgot password routes
router.get('/forgot-password', users.renderForgotPassword);
router.post('/forgot-password', catchAsync(users.forgotPassword));

router.get('/reset-password/:token', users.renderResetPassword);
router.post('/reset-password/:token', catchAsync(users.resetPassword));

router.get('/logout', users.logout);

module.exports = router;
