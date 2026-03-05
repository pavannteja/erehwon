const mongoose = require('mongoose');
const Review = require('./review')
const Schema = mongoose.Schema;

const ImageSchema = new Schema ({
    url: String,
    filename: String
});

ImageSchema.virtual('thumbnail').get(function(){
   return this.url.replace('/upload', '/upload/w_200');
});

const opts = { toJSON: { virtuals: true }, strictPopulate: false };

const campgroundSchema = new Schema ({
    title: String,
    images:[ImageSchema],
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: false
        },
        coordinates: {
            type: [Number],
            required: false
        }
    },
    problem: String,
    description: String,
    location: String,
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    ideationSession: {
        type: Schema.Types.ObjectId,
        ref: 'ProblemStatement'
    },
    solution: {
        type: Schema.Types.ObjectId,
        ref: 'Solution'
    },
    prototype: {
        type: Schema.Types.ObjectId,
        ref: 'Prototype'
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Review'
        }
    ],
    // Team and form data from Excite and Enrol
    teamInfo: {
        schoolName: String,
        className: String,
        groupMembers: String,
        groupName: String,
        enrolledProgram: {
            type: Schema.Types.ObjectId,
            ref: 'Program'
        },
        sdgGoal: String,
        innovationProcessSteps: String,
        problemDiscoveryMethod: String,
        communityChallenges: String,
        fiveYearProblem: String,
        technologyApplicationReason: String
    },
    // Problem statement data
    problemStatementInfo: {
        selectedPredefinedProblem: {
            type: Schema.Types.ObjectId,
            ref: 'PredefinedProblem'
        },
        recommendedStakeholders: [String],
        problemType: { type: String, enum: ['predefined', 'custom'] },
        customProblem: {
            whoHasProblem: String,
            whatIsProblem: String,
            expectedBenefit: String
        }
    },
    // Reference to form data
    formDataId: {
        type: Schema.Types.ObjectId,
        ref: 'ProblemFormData'
    },
    // Notes field
    notes: {
        type: String,
        default: ''
    },
    // Analysis outputs (used by later process stages)
    analysisData: {
        functionalRequirements: [String],
        nonFunctionalRequirements: [String]
    },
    // Converge ideas outputs
    convergeIdeasData: {
        shortlistedIdeaIds: [{
            type: Schema.Types.ObjectId,
            ref: 'Idea'
        }],
        requirementIdeaMap: [{
            requirementType: { type: String, enum: ['functional', 'nonFunctional'] },
            requirementText: String,
            ideaIds: [{
                type: Schema.Types.ObjectId,
                ref: 'Idea'
            }]
        }],
        finalChosenIdeaId: {
            type: Schema.Types.ObjectId,
            ref: 'Idea'
        },
        finalChosenIdeaText: String,
        definedFeatures: [String]
    },
    // Reference to corporate problem if adopted
    adoptedFromCorporateProblem: {
        type: Schema.Types.ObjectId,
        ref: 'CorporateProblem'
    }
}, opts);

campgroundSchema.virtual('properties.popUpMarkup').get(function(){
    return `
    <strong><a href ="/campgrounds/${this._id}">${this.title}</a><strong>
    <p>${this.description}</p>`;
 });

campgroundSchema.post('findOneAndDelete', async function (doc){
if (doc){
    await Review.deleteMany({
        _id:{
            $in: doc.reviews
        }
    })
}
})
const Campground = mongoose.model('Campground', campgroundSchema);
module.exports = Campground;