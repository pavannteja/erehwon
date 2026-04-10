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
        technologyApplicationReason: String,
        highImpactMissionWhy: String,
        missionEndKnownFor: String
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
    analysisInsightRecords: {
        intervieweeName: [String],
        intervieweeRole: [String],
        problemImpact: [String],
        functionalDifficulty: [String],
        economicPressure: [String],
        emotionalConcern: [String],
        currentWorkaround: [String],
        unsaidButImplied: [String],
        stakeholderQuote: [String],
        surprise: [String],
        otherInsights: [String],
        reflection: [String]
    },
    analysisSynthesisPrioritisation: {
        insightTheme: [String],
        themeType: [String],
        evidenceCount: [Number],
        severity: [Number],
        frequency: [Number],
        problemDraft: [String],
        impactLevel: [String],
        feasibility: [String],
        alignmentWithTeamSkills: [String],
        priorityRank: [Number],
        functionalRequirement: [String],
        nonFunctionalRequirement: [String],
        criticalImpactReflection: [String],
        eliminationReason: [String]
    },
    analysisProblemStatement: {
        solveHelp: { type: String, default: '' },
        targetUser: { type: String, default: '' },
        towardOutcome: { type: String, default: '' },
        checklistExactProblem: { type: Boolean, default: false },
        checklistExactUser: { type: Boolean, default: false },
        checklistMeasurable: { type: Boolean, default: false },
        digitalCommitment: [String]
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
            ideaIds: [String]
        }],
        featurePairs: [{
            requirementType: { type: String, enum: ['functional', 'nonFunctional'] },
            requirementText: String,
            ideaId: String,
            ideaText: String
        }],
        featureCards: [{
            featureId: String,
            checked: { type: Boolean, default: false },
            requirementType: { type: String, enum: ['functional', 'nonFunctional'] },
            requirementText: String,
            ideas: [{
                ideaId: String,
                ideaText: String
            }]
        }],
        groupedFeatureCards: [{
            groupId: String,
            name: String,
            checked: { type: Boolean, default: false },
            features: [{
                featureId: String,
                checked: { type: Boolean, default: false },
                requirementType: { type: String, enum: ['functional', 'nonFunctional'] },
                requirementText: String,
                ideas: [{
                    ideaId: String,
                    ideaText: String
                }]
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
    },
    // Dashboard-created custom project metadata
    isStudentLedProject: {
        type: Boolean,
        default: false
    },
    customProjectSkills: {
        type: [String],
        default: undefined
    },
    customProjectObjective: {
        type: String,
        default: ''
    },
    // Phase 1 Mission Launch: pill state (green only after successful Submit on that step)
    missionLaunchGroundworkSubmitted: {
        type: Boolean,
        default: false
    },
    missionLaunchTeamSubmitted: {
        type: Boolean,
        default: false
    },
    // Phase 2 Problem Discovery hub – green card / tab pill only when that sub-step’s fields are fully valid
    problemDiscoveryChallengeIntentSubmitted: {
        type: Boolean,
        default: false
    },
    problemDiscoveryProblemResearchSubmitted: {
        type: Boolean,
        default: false
    },
    problemDiscoveryStakeholderMappingSubmitted: {
        type: Boolean,
        default: false
    },
    // Phase 3 Analysis hub – card gradient state per sub-step
    analysisInsightRecordsSubmitted: {
        type: Boolean,
        default: false
    },
    analysisSynthesisPrioritisationSubmitted: {
        type: Boolean,
        default: false
    },
    analysisProblemStatementSubmitted: {
        type: Boolean,
        default: false
    },
    // Phase 4 Ideation hub – card gradient state per sub-step
    ideationIdeaGenerationSubmitted: {
        type: Boolean,
        default: false
    },
    ideationIdeaGeneration: {
        rawIdeas: { type: [String], default: undefined },
        themesUnlocked: { type: Boolean, default: false },
        selectedThemeId: { type: String, default: 'theme1' },
        themes: [
            {
                id: { type: String, default: '' },
                label: { type: String, default: '' },
                note: { type: String, default: '' },
                dropped: [
                    {
                        id: { type: String, default: '' },
                        text: { type: String, default: '' }
                    }
                ]
            }
        ]
    },
    ideationSotaReportSubmitted: {
        type: Boolean,
        default: false
    },
    ideationSotaReport: {
        selectedSolutionKey: { type: String, default: 'solutionA' },
        solutions: [
            {
                key: String,
                label: String,
                technologyUsed: [String],
                accuracy: [String],
                latency: [String],
                cost: [String],
                powerUse: [String],
                scalability: [String]
            }
        ],
        yourSolution: {
            technologyUsed: [String],
            accuracy: [String],
            latency: [String],
            cost: [String],
            powerUse: [String],
            scalability: [String]
        }
    },
    // Phase 6 Solution hub – card gradient state per sub-step
    conceptualSolutionBlueprintSubmitted: {
        type: Boolean,
        default: false
    },
    conceptualSolutionMarketLogicSubmitted: {
        type: Boolean,
        default: false
    },
    conceptualSolutionExecutionRoadmapSubmitted: {
        type: Boolean,
        default: false
    },
    conceptualSolutionData: {
        blueprint: {
            keyFeatures: [String],
            keyFeatureFileNames: [String],
            usp: { type: String, default: '' },
            uspFileNames: [String],
            customerJourney: [String]
        },
        marketLogic: {
            competitors: [String],
            competitorAdvantage: [String],
            ourEdge: [String],
            whoPays: [String],
            revenueModel: [String],
            pricingStrategy: [String]
        },
        executionRoadmap: {
            targetUsersForTesting: [String],
            keyFeaturesToBeBuilt: [String],
            developmentPlanSteps: [String],
            developmentPlanCompletionDates: [String],
            financeComponents: [String],
            financeComponentCosts: [String],
            prototypeCost: { type: String, default: '' },
            marketLaunchPrice: { type: String, default: '' },
            unitMargin: { type: String, default: '' }
        }
    },
    // Problem Research (Problem Discovery step 2)
    problemDiscoveryProblemResearch: {
        scale: [{ dataFound: String, sourceLink: String, whyMatters: String }],
        economic: [{ dataFound: String, sourceLink: String, whyMatters: String }],
        operational: [{ dataFound: String, sourceLink: String, whyMatters: String }],
        human: [{ dataFound: String, sourceLink: String, whyMatters: String }],
        environmental: [{ dataFound: String, sourceLink: String, whyMatters: String }],
        futureRisk: [{ dataFound: String, sourceLink: String, whyMatters: String }],
        projectedCostReduction: [String],
        projectedTimeSavings: [String],
        projectedEfficiencyIncrease: [String],
        projectedSafetyImprovement: [String],
        projectedSustainabilityImprovement: [String],
        projectedOthers: [String],
        reflection: String,
        researchFileNames: [String]
    },
    // Stakeholder Mapping (Problem Discovery step 3)
    problemDiscoveryStakeholderMapping: {
        directUser: [
            { personRole: String, whyMatter: String, contactPlanned: Boolean, contactContacted: Boolean, contactMet: Boolean }
        ],
        indirectUser: [
            { personRole: String, whyMatter: String, contactPlanned: Boolean, contactContacted: Boolean, contactMet: Boolean }
        ],
        decisionMaker: [
            { personRole: String, whyMatter: String, contactPlanned: Boolean, contactContacted: Boolean, contactMet: Boolean }
        ],
        domainExpert: [
            { personRole: String, whyMatter: String, contactPlanned: Boolean, contactContacted: Boolean, contactMet: Boolean }
        ],
        regulator: [
            { personRole: String, whyMatter: String, contactPlanned: Boolean, contactContacted: Boolean, contactMet: Boolean }
        ],
        solutionProvider: [
            { personRole: String, whyMatter: String, contactPlanned: Boolean, contactContacted: Boolean, contactMet: Boolean }
        ],
        interactionLog: [
            {
                entryType: String,
                organization: String,
                objective: String,
                interactionDate: String,
                takeaways: String
            }
        ]
    },
    // Challenge & Intent (Problem Discovery step 1)
    problemDiscoveryChallengeIntent: {
        challengeChosen: { type: String, default: '' },
        industrySector: { type: String, default: '' },
        whyMattersToday: { type: [String], default: undefined },
        existingSolutions: { type: [String], default: undefined },
        whatsMissing: { type: [String], default: undefined },
        motivation: { type: [String], default: undefined }
    },
    // Groundwork step (briefing): separate from teamInfo so Team page edits stay independent
    missionLaunchGroundworkInfo: {
        schoolName: String,
        className: String,
        enrolledProgram: {
            type: Schema.Types.ObjectId,
            ref: 'Program'
        },
        sdgGoal: String,
        innovationProcessSteps: String,
        groupName: String,
        groupMembers: String,
        highImpactMissionWhy: String,
        missionEndKnownFor: String,
        problemDiscoveryMethod: String,
        communityChallenges: String,
        fiveYearProblem: String,
        technologyApplicationReason: String
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