const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new Schema({
    email: {
        type: String, 
        required: true,
        unique: true
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true
    },
    displayName: {
        type: String
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    profilePicture: {
        type: String
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isProblemCreator: {
        type: Boolean,
        default: false
    },
    // When true, this account represents a team login,
    // not an individual student. Teams can have their
    // own dashboard and own projects.
    isTeam: {
        type: Boolean,
        default: false
    },
    // Members (individual user accounts) that belong to this team
    teamMembers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Owner (individual user) who created this team
    teamOwner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    // Teams this individual belongs to
    teams: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    // School & program membership for individuals/teams
    school: {
        type: Schema.Types.ObjectId,
        ref: 'School'
    },
    program: {
        type: Schema.Types.ObjectId,
        ref: 'Program'
    },
    // Convenience fields for grouping/filtering teams and users
    schoolName: String,
    programName: String
});

UserSchema.plugin(passportLocalMongoose, {
    usernameUnique: true
});

module.exports = mongoose.model('User', UserSchema);
