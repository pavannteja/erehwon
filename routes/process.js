const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const Campground = require('../models/campgrounds');
const { Idea } = require('../models/schemas');

const STAGE_CONFIG = {
  'excite-enrol': {
    name: 'Excite & Enrol',
    icon: 'fas fa-users',
    subtitle: 'Start with enrollment, orientation, and readiness checks.',
    actions: (problemId) => [
      {
        title: 'Individual Enrollment Form',
        description: 'Fill the existing Excite & Enrol form for this project.',
        icon: 'fas fa-user',
        href: `/excite-and-enrol?campgroundId=${problemId}`,
        badge: 'Existing'
      },
      {
        title: 'Team Enrollment Form',
        description: 'Use the same enrollment flow in team mode.',
        icon: 'fas fa-user-friends',
        href: `/excite-and-enrol?campgroundId=${problemId}&enrollmentType=team`,
        badge: 'Existing'
      },
      {
        title: 'Pre Test',
        description: 'Capture baseline readiness before starting the journey.',
        icon: 'fas fa-clipboard-check',
        href: `/process/${problemId}/excite-enrol/pre-test`,
        badge: 'New Section'
      }
    ]
  },
  'problem-discovery': {
    name: 'Problem Discovery',
    icon: 'fas fa-search',
    subtitle: 'Choose and refine the problem with structured discovery.',
    actions: (problemId) => [
      {
        step: 1,
        title: 'Select Problem Statement',
        description: 'Use the existing predefined problem flow.',
        icon: 'fas fa-list-check',
        href: `/problem-statement/page2?campgroundId=${problemId}`,
        badge: 'Existing'
      },
      {
        step: 2,
        title: 'Map Stakeholders',
        description: 'Identify key stakeholders affected by or influencing this problem.',
        icon: 'fas fa-people-group',
        href: `/process/${problemId}/problem-discovery/map-stakeholders`,
        badge: 'New Section'
      },
      {
        step: 3,
        title: 'Interview Plan / Questions',
        description: 'Prepare interview goals, participant list, and core questions.',
        icon: 'fas fa-clipboard-question',
        href: `/process/${problemId}/problem-discovery/interview-plan-questions`,
        badge: 'New Section'
      },
      {
        step: 4,
        title: 'Dialogue Notes',
        description: 'Capture interview/dialogue observations and key learnings.',
        icon: 'fas fa-file-lines',
        href: `/process/${problemId}/problem-discovery/dialogue-notes`,
        badge: 'New Section'
      }
    ]
  },
  analysis: {
    name: 'Analysis',
    icon: 'fas fa-chart-line',
    subtitle: 'Analyze findings from discovery before entering ideation.',
    actions: (problemId) => [
      {
        step: 1,
        title: 'User Dialogue Insights',
        description: 'Capture and synthesize key insights from user dialogues.',
        icon: 'fas fa-comments',
        href: `/process/${problemId}/analysis/user-dialogue-insights`,
        badge: 'New Section'
      },
      {
        step: 2,
        title: "Features and Goals Must Have's",
        description: 'Define must-have features and goals that the solution should satisfy.',
        icon: 'fas fa-list-check',
        href: `/process/${problemId}/analysis/features-goals-must-haves`,
        badge: 'New Section'
      },
      {
        step: 3,
        title: 'Must Have Definition - Functional and Non Functional Requirements',
        description: 'Document functional and non-functional requirements clearly.',
        icon: 'fas fa-clipboard-list',
        href: `/process/${problemId}/analysis/must-have-definition-functional-non-functional`,
        badge: 'New Section'
      }
    ]
  },
  ideation: {
    name: 'Creative Ideation',
    icon: 'fas fa-lightbulb',
    subtitle: 'Generate, organize, and evaluate ideas.',
    actions: (problemId) => [
      {
        step: 1,
        title: 'Gear 1',
        description: 'Open the existing ideation board for this project.',
        icon: 'fas fa-brain',
        href: `/ideation/${problemId}`,
        badge: 'Existing'
      },
      {
        step: 2,
        title: 'Secondary Research',
        description: 'Capture and organize secondary research insights.',
        icon: 'fas fa-book-open',
        href: `/process/${problemId}/ideation/secondary-research`,
        badge: 'New Section'
      },
      {
        step: 3,
        title: 'STOTA Report',
        description: 'Create and review your STOTA report findings.',
        icon: 'fas fa-file-lines',
        href: `/process/${problemId}/ideation/stota-report`,
        badge: 'New Section'
      },
      {
        step: 4,
        title: 'Gear 2 - Input from STOTA Report',
        description: 'Generate idea inputs directly from STOTA outputs.',
        icon: 'fas fa-gears',
        href: `/process/${problemId}/ideation/gear-2-stota-input`,
        badge: 'New Section'
      },
      {
        step: 5,
        title: 'Gear 3 - Market Research (ChatGPT UI)',
        description: 'Use a ChatGPT-style workspace for market research.',
        icon: 'fas fa-comments-dollar',
        href: `/process/${problemId}/ideation/gear-3-market-research`,
        badge: 'New Section'
      }
    ]
  },
  'converge-ideas': {
    name: 'Converge Ideas',
    icon: 'fas fa-filter',
    subtitle: 'Narrow down ideas and choose the strongest direction.',
    actions: (problemId) => [
      {
        step: 1,
        title: 'Idea Shortlisting',
        description: 'Score and shortlist promising concepts.',
        icon: 'fas fa-list-check',
        href: `/process/${problemId}/converge-ideas/idea-shortlisting`,
        badge: 'New Section'
      },
      {
        step: 2,
        title: 'Map Ideas to Functional and Non Functional Requirements',
        description: 'Drag shortlisted ideas into requirement buckets.',
        icon: 'fas fa-table-columns',
        href: `/process/${problemId}/converge-ideas/map-ideas-to-functional-and-non-functional-requirements`,
        badge: 'New Section'
      },
      {
        step: 3,
        title: 'Finalise Chose Idea, Define Features',
        description: 'Finalize selected idea and define must-have features.',
        icon: 'fas fa-circle-check',
        href: `/process/${problemId}/converge-ideas/finalise-chose-idea-define-features`,
        badge: 'New Section'
      }
    ]
  },
  'conceptual-solution': {
    name: 'Conceptual Solution',
    icon: 'fas fa-tasks',
    subtitle: 'Define the chosen concept and validate implementation direction.',
    actions: (problemId) => [
      {
        step: 1,
        title: 'STOTA Differentiation',
        description: 'Define how your solution differentiates through STOTA.',
        icon: 'fas fa-arrows-split-up-and-left',
        href: `/process/${problemId}/conceptual-solution/stota-differentiation`,
        badge: 'New Section'
      },
      {
        step: 2,
        title: 'Value Proposition',
        description: 'Articulate value delivered to target users and stakeholders.',
        icon: 'fas fa-gem',
        href: `/process/${problemId}/conceptual-solution/value-proposition`,
        badge: 'New Section'
      },
      {
        step: 3,
        title: 'Final Functional + Non-Functional Requirements',
        description: 'Finalize functional and non-functional requirements for the selected idea.',
        icon: 'fas fa-clipboard-check',
        href: `/process/${problemId}/conceptual-solution/final-functional-non-functional-requirements`,
        badge: 'New Section'
      },
      {
        step: 4,
        title: 'Solution Architecture',
        description: 'Design the high-level architecture for implementation.',
        icon: 'fas fa-diagram-project',
        href: `/process/${problemId}/conceptual-solution/solution-architecture`,
        badge: 'New Section'
      },
      {
        step: 5,
        title: 'Business Proposition',
        description: 'Define business proposition, model, and expected outcomes.',
        icon: 'fas fa-briefcase',
        href: `/process/${problemId}/conceptual-solution/business-proposition`,
        badge: 'New Section'
      },
      {
        step: 6,
        title: 'Prototyping Roadmap',
        description: 'Create a roadmap for prototyping and validation milestones.',
        icon: 'fas fa-road',
        href: `/process/${problemId}/conceptual-solution/prototyping-roadmap`,
        badge: 'New Section'
      }
    ]
  },
  prototyping: {
    name: 'Prototyping',
    icon: 'fas fa-tools',
    subtitle: 'Build artifacts, test, and iterate.',
    actions: (problemId) => [
      {
        step: 1,
        title: 'Upload Prototype V2',
        description: 'Upload and iterate version V2 of the prototype.',
        icon: 'fas fa-upload',
        href: `/process/${problemId}/prototyping/upload-prototype-v2`,
        badge: 'New Section'
      },
      {
        step: 2,
        title: 'Budget Planning',
        description: 'Define budget assumptions and prototype costs.',
        icon: 'fas fa-sack-dollar',
        href: `/process/${problemId}/prototyping/budget-planning`,
        badge: 'New Section'
      },
      {
        step: 3,
        title: 'Upload Prototype V3',
        description: 'Upload and review version V3 of the prototype.',
        icon: 'fas fa-cloud-arrow-up',
        href: `/process/${problemId}/prototyping/upload-prototype-v3`,
        badge: 'New Section'
      },
      {
        step: 4,
        title: 'Upload Prototype V1',
        description: 'Use existing prototype workspace for V1 baseline.',
        icon: 'fas fa-cubes',
        href: `/prototyping/${problemId}`,
        badge: 'Existing'
      }
    ]
  }
};

async function loadProblemForUser(req, res, next) {
  const { problemId } = req.params;
  const problem = await Campground.findById(problemId);
  if (!problem) {
    req.flash('error', 'Project not found.');
    return res.redirect('/dashboard');
  }

  if (
    problem.author &&
    problem.author.toString() !== req.user._id.toString() &&
    !req.user.isAdmin
  ) {
    req.flash('error', 'You do not have permission to access this project.');
    return res.redirect('/dashboard');
  }

  req.problem = problem;
  next();
}

router
  .route('/process/:problemId/analysis/must-have-definition-functional-non-functional')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const analysisData = req.problem.analysisData || { functionalRequirements: [], nonFunctionalRequirements: [] };
    res.render('process/analysis-requirements', {
      currentUser: req.user,
      problem: req.problem,
      analysisData
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    const functionalRequirements = (req.body.functionalRequirementsText || '')
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);
    const nonFunctionalRequirements = (req.body.nonFunctionalRequirementsText || '')
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);

    req.problem.analysisData = {
      functionalRequirements,
      nonFunctionalRequirements
    };
    await req.problem.save();
    req.flash('success', 'Functional and non-functional requirements saved.');
    res.redirect(`/process/${req.problem._id}/analysis`);
  });

router
  .route('/process/:problemId/converge-ideas/idea-shortlisting')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const ideas = await Idea.find({ problemId: req.problem._id }).sort({ createdAt: 1 }).lean();
    const selectedIds = (req.problem.convergeIdeasData?.shortlistedIdeaIds || []).map((id) => String(id));
    res.render('process/converge-ideas-shortlisting', {
      currentUser: req.user,
      problem: req.problem,
      ideas,
      selectedIds
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    const selectedIdeaIds = Array.isArray(req.body.selectedIdeaIds)
      ? req.body.selectedIdeaIds
      : (req.body.selectedIdeaIds ? [req.body.selectedIdeaIds] : []);

    req.problem.convergeIdeasData = req.problem.convergeIdeasData || {};
    req.problem.convergeIdeasData.shortlistedIdeaIds = selectedIdeaIds;
    await req.problem.save();
    req.flash('success', 'Idea shortlist saved.');
    res.redirect(`/process/${req.problem._id}/converge-ideas`);
  });

router
  .route('/process/:problemId/converge-ideas/map-ideas-to-functional-and-non-functional-requirements')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const shortlistIds = req.problem.convergeIdeasData?.shortlistedIdeaIds || [];
    const shortlistedIdeas = await Idea.find({ _id: { $in: shortlistIds } }).sort({ createdAt: 1 }).lean();

    const functionalRequirements = req.problem.analysisData?.functionalRequirements || [];
    const nonFunctionalRequirements = req.problem.analysisData?.nonFunctionalRequirements || [];
    const existingMap = req.problem.convergeIdeasData?.requirementIdeaMap || [];

    res.render('process/converge-ideas-mapping', {
      currentUser: req.user,
      problem: req.problem,
      shortlistedIdeas,
      functionalRequirements,
      nonFunctionalRequirements,
      existingMap
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    let parsedMap = [];
    try {
      parsedMap = JSON.parse(req.body.requirementIdeaMap || '[]');
      if (!Array.isArray(parsedMap)) parsedMap = [];
    } catch (e) {
      parsedMap = [];
    }

    req.problem.convergeIdeasData = req.problem.convergeIdeasData || {};
    req.problem.convergeIdeasData.requirementIdeaMap = parsedMap;
    await req.problem.save();
    req.flash('success', 'Requirement-to-idea mapping saved.');
    res.redirect(`/process/${req.problem._id}/converge-ideas`);
  });

router
  .route('/process/:problemId/converge-ideas/finalise-chose-idea-define-features')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const shortlistIds = req.problem.convergeIdeasData?.shortlistedIdeaIds || [];
    const shortlistedIdeas = await Idea.find({ _id: { $in: shortlistIds } }).sort({ createdAt: 1 }).lean();
    const convergeData = req.problem.convergeIdeasData || {};

    res.render('process/converge-ideas-finalise', {
      currentUser: req.user,
      problem: req.problem,
      shortlistedIdeas,
      convergeData
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    const { finalChosenIdeaId, finalChosenIdeaText, definedFeaturesText } = req.body;
    const definedFeatures = (definedFeaturesText || '')
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    req.problem.convergeIdeasData = req.problem.convergeIdeasData || {};
    req.problem.convergeIdeasData.finalChosenIdeaId = finalChosenIdeaId || null;
    req.problem.convergeIdeasData.finalChosenIdeaText = finalChosenIdeaText || '';
    req.problem.convergeIdeasData.definedFeatures = definedFeatures;
    await req.problem.save();
    req.flash('success', 'Final idea and features saved.');
    res.redirect(`/process/${req.problem._id}/converge-ideas`);
  });

router.get('/process/:problemId/:stage', isLoggedIn, loadProblemForUser, (req, res) => {
  const { problemId, stage } = req.params;
  const stageConfig = STAGE_CONFIG[stage];

  if (!stageConfig) {
    req.flash('error', 'Invalid process stage.');
    return res.redirect(`/problems/${problemId}`);
  }

  res.render('process/hub', {
    currentUser: req.user,
    problem: req.problem,
    stageKey: stage,
    stage: {
      ...stageConfig,
      actions: stageConfig.actions(problemId)
    }
  });
});

router.get('/process/:problemId/:stage/:subsection', isLoggedIn, loadProblemForUser, (req, res) => {
  const { problemId, stage, subsection } = req.params;
  const stageConfig = STAGE_CONFIG[stage];
  if (!stageConfig) {
    req.flash('error', 'Invalid process stage.');
    return res.redirect(`/problems/${problemId}`);
  }

  res.render('process/subsection', {
    currentUser: req.user,
    problem: req.problem,
    stageKey: stage,
    stageName: stageConfig.name,
    subsectionName: subsection
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  });
});

module.exports = router;
