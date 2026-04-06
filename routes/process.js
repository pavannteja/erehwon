const express = require('express');
const multer = require('multer');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const Campground = require('../models/campgrounds');
const { Idea } = require('../models/schemas');

const prResearchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 }
});
const solutionBlueprintUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 }
});

function isProblemDiscoveryAjax(req) {
  return req.body && String(req.body.problemDiscoveryAjax) === '1';
}

function isAnalysisAjax(req) {
  return req.body && String(req.body.analysisAjax) === '1';
}

function isIdeationAjax(req) {
  return req.body && String(req.body.ideationAjax) === '1';
}

function isConvergeAjax(req) {
  return req.body && String(req.body.convergeAjax) === '1';
}

function isConceptualSolutionAjax(req) {
  return req.body && String(req.body.solutionAjax) === '1';
}

function conceptualSolutionSaveJson(problem) {
  return {
    ok: true,
    conceptualSolutionBlueprintSubmitted: !!problem.conceptualSolutionBlueprintSubmitted,
    conceptualSolutionMarketLogicSubmitted: !!problem.conceptualSolutionMarketLogicSubmitted,
    conceptualSolutionExecutionRoadmapSubmitted: !!problem.conceptualSolutionExecutionRoadmapSubmitted
  };
}

/** Single paragraph from Phase 3 → Problem Statement (solveHelp / targetUser / towardOutcome). */
function problemStatementParagraphFromAnalysis(cg) {
  if (!cg) return '';
  const ps = cg.analysisProblemStatement || {};
  const sh = trimStr(ps.solveHelp);
  const tu = trimStr(ps.targetUser);
  const to = trimStr(ps.towardOutcome);
  if (!sh && !tu && !to) return '';
  const oneLine = (s) => trimStr(String(s).replace(/\s+/g, ' '));
  const a = oneLine(sh);
  const b = oneLine(tu);
  const c = oneLine(to);
  let out = 'We will solve/help';
  if (a) out += ` ${a}`;
  if (b) out += ` for ${b}`;
  if (c) out += ` toward ${c}`;
  out += '.';
  return out;
}

function problemStatementParagraphsForIdeation(cg) {
  const fromAnalysis = problemStatementParagraphFromAnalysis(cg);
  if (fromAnalysis) return [fromAnalysis];

  if (!cg) {
    return [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
    ];
  }
  const desc = trimStr(cg.description);
  if (desc) return [desc];
  const prob = trimStr(cg.problem);
  if (prob) return [prob];
  return [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
  ];
}

function ideationRawIdeasFromBody(body) {
  return bodyFieldArray(body, 'rawIdeas').map(trimStr);
}

function ideationIdeaGenerationIsComplete(rawLines) {
  const filled = (rawLines || []).filter((s) => !!trimStr(s));
  return filled.length >= 5;
}

function ideationHasDroppedIdeas(themes) {
  return (
    Array.isArray(themes) &&
    themes.some((theme) => {
      const hasDropped = Array.isArray(theme.dropped) && theme.dropped.length >= 1;
      const hasThemeText = !!trimStr(theme.note);
      return hasDropped && hasThemeText;
    })
  );
}

function defaultIdeationTheme(index) {
  const n = index + 1;
  return {
    id: `theme${n}`,
    label: `Theme ${n}`,
    note: '',
    dropped: []
  };
}

function normalizeIdeationThemes(rawThemes) {
  if (!Array.isArray(rawThemes) || !rawThemes.length) {
    return [defaultIdeationTheme(0)];
  }
  const out = rawThemes
    .map((raw, idx) => {
      const theme = raw && typeof raw === 'object' ? raw : {};
      const fallback = defaultIdeationTheme(idx);
      const dropped = Array.isArray(theme.dropped)
        ? theme.dropped
            .map((entry, j) => {
              const item = entry && typeof entry === 'object' ? entry : {};
              const id = trimStr(item.id) || `idea_${idx + 1}_${j + 1}`;
              const text = trimStr(item.text);
              if (!text) return null;
              return { id, text };
            })
            .filter(Boolean)
        : [];
      return {
        id: trimStr(theme.id) || fallback.id,
        label: trimStr(theme.label) || fallback.label,
        note: trimStr(theme.note),
        dropped
      };
    })
    .filter((t) => !!t.id);
  return out.length ? out : [defaultIdeationTheme(0)];
}

function normalizeIdeationIdeaGenerationPayload(raw, fallbackRawIdeas) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawIdeas = (Array.isArray(src.rawIdeas) ? src.rawIdeas : fallbackRawIdeas || []).map(trimStr);
  const themes = normalizeIdeationThemes(src.themes);
  const picked = trimStr(src.selectedThemeId);
  const selectedThemeId = themes.some((t) => t.id === picked) ? picked : themes[0].id;
  const themesUnlocked = !!src.themesUnlocked;
  return { rawIdeas, themes, selectedThemeId, themesUnlocked };
}

const SOTA_METRIC_KEYS = ['technologyUsed', 'accuracy', 'latency', 'cost', 'powerUse', 'scalability'];

function problemDiscoverySaveJson(problem) {
  return {
    ok: true,
    problemDiscoveryChallengeIntentSubmitted: !!problem.problemDiscoveryChallengeIntentSubmitted,
    problemDiscoveryProblemResearchSubmitted: !!problem.problemDiscoveryProblemResearchSubmitted,
    problemDiscoveryStakeholderMappingSubmitted: !!problem.problemDiscoveryStakeholderMappingSubmitted
  };
}

function cleanSotaMetricLines(values) {
  if (!Array.isArray(values)) return [];
  return values.map((v) => trimStr(v)).filter(Boolean);
}

function blankSotaMetricMap() {
  return {
    technologyUsed: [],
    accuracy: [],
    latency: [],
    cost: [],
    powerUse: [],
    scalability: []
  };
}

function makeDefaultSotaSolution(key, label) {
  return {
    key,
    label,
    ...blankSotaMetricMap()
  };
}

function defaultSotaLabel(index) {
  if (index >= 0 && index < 26) {
    return `Solution ${String.fromCharCode(65 + index)}`;
  }
  return `Solution ${index + 1}`;
}

function normalizeSotaSolutions(rawSolutions) {
  if (!Array.isArray(rawSolutions)) return [];
  return rawSolutions
    .map((raw, idx) => {
      const key = trimStr(raw && raw.key) || `solution${idx + 1}`;
      const label = trimStr(raw && raw.label) || defaultSotaLabel(idx);
      const out = { key, label, ...blankSotaMetricMap() };
      for (const metric of SOTA_METRIC_KEYS) {
        out[metric] = cleanSotaMetricLines(raw && raw[metric]);
      }
      return out;
    })
    .filter((row) => !!row.key);
}

function normalizeSotaYourSolution(raw) {
  const out = blankSotaMetricMap();
  for (const metric of SOTA_METRIC_KEYS) {
    out[metric] = cleanSotaMetricLines(raw && raw[metric]);
  }
  return out;
}

function normalizeSotaPayload(raw) {
  const normalized = raw && typeof raw === 'object' ? raw : {};
  let solutions = normalizeSotaSolutions(normalized.solutions);
  if (!solutions.length) {
    solutions = [makeDefaultSotaSolution('solutionA', 'Solution A')];
  }
  const selectedRaw = trimStr(normalized.selectedSolutionKey);
  const selectedSolutionKey = solutions.some((s) => s.key === selectedRaw)
    ? selectedRaw
    : solutions[0].key;
  return {
    selectedSolutionKey,
    solutions,
    yourSolution: normalizeSotaYourSolution(normalized.yourSolution)
  };
}

function sotaMetricIsComplete(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every((v) => !!trimStr(v));
}

function sotaSolutionIsComplete(solution) {
  if (!solution || typeof solution !== 'object') return false;
  return SOTA_METRIC_KEYS.every((metric) => sotaMetricIsComplete(solution[metric]));
}

function sotaReportIsComplete(payload) {
  if (!payload || !Array.isArray(payload.solutions) || payload.solutions.length === 0) return false;
  return payload.solutions.every(sotaSolutionIsComplete) && sotaSolutionIsComplete(payload.yourSolution);
}

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
        href: `/excite-and-enrol/briefing?campgroundId=${problemId}`,
        badge: 'Existing'
      },
      {
        title: 'Team Enrollment Form',
        description: 'Use the same enrollment flow in team mode.',
        icon: 'fas fa-user-friends',
        href: `/excite-and-enrol/team?campgroundId=${problemId}`,
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
        title: 'SOTA Report',
        description: 'Create and review your STOTA report findings.',
        icon: 'fas fa-file-lines',
        href: `/process/${problemId}/ideation/sota-report`,
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

function trimStr(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/** When a Problem Discovery sub-page saves, POST here with step=challenge|research|stakeholders (and ajax=1 for JSON). */
router.post(
  '/process/:problemId/problem-discovery/complete-step',
  isLoggedIn,
  loadProblemForUser,
  async (req, res) => {
    const json = req.body && String(req.body.ajax) === '1';
    try {
      const step = trimStr(req.body.step);
      const flags = {
        challenge: 'problemDiscoveryChallengeIntentSubmitted',
        research: 'problemDiscoveryProblemResearchSubmitted',
        stakeholders: 'problemDiscoveryStakeholderMappingSubmitted'
      };
      if (!flags[step]) {
        if (json) return res.status(400).json({ ok: false, error: 'Invalid step.' });
        req.flash('error', 'Invalid step.');
        return res.redirect(`/process/${req.problem._id}/problem-discovery`);
      }
      req.problem[flags[step]] = problemDiscoveryStepIsComplete(req.problem, step);
      await req.problem.save();
      if (json) {
        return res.json({
          ok: true,
          problemDiscoveryChallengeIntentSubmitted: !!req.problem.problemDiscoveryChallengeIntentSubmitted,
          problemDiscoveryProblemResearchSubmitted: !!req.problem.problemDiscoveryProblemResearchSubmitted,
          problemDiscoveryStakeholderMappingSubmitted: !!req.problem.problemDiscoveryStakeholderMappingSubmitted
        });
      }
      req.flash('success', 'Progress saved.');
      return res.redirect(`/process/${req.problem._id}/problem-discovery`);
    } catch (err) {
      console.error('Problem discovery complete-step:', err);
      if (json) return res.status(500).json({ ok: false, error: 'Could not save progress.' });
      req.flash('error', 'Could not save progress.');
      return res.redirect(`/process/${req.problem._id}/problem-discovery`);
    }
  }
);

router.post(
  '/process/:problemId/conceptual-solution/complete-step',
  isLoggedIn,
  loadProblemForUser,
  async (req, res) => {
    try {
      const step = trimStr(req.body.step);
      const flags = {
        blueprint: 'conceptualSolutionBlueprintSubmitted',
        marketLogic: 'conceptualSolutionMarketLogicSubmitted',
        executionRoadmap: 'conceptualSolutionExecutionRoadmapSubmitted'
      };
      const field = flags[step];
      if (!field) {
        if (isConceptualSolutionAjax(req)) {
          return res.status(400).json({ ok: false, error: 'Invalid step.' });
        }
        req.flash('error', 'Invalid step.');
        return res.redirect(`/process/${req.problem._id}/conceptual-solution`);
      }

      const completeRaw = trimStr(req.body.complete);
      const complete = completeRaw === '1' || completeRaw === 'true';
      req.problem[field] = complete;
      await req.problem.save();

      if (isConceptualSolutionAjax(req)) {
        return res.json({
          ok: true,
          conceptualSolutionBlueprintSubmitted: !!req.problem.conceptualSolutionBlueprintSubmitted,
          conceptualSolutionMarketLogicSubmitted: !!req.problem.conceptualSolutionMarketLogicSubmitted,
          conceptualSolutionExecutionRoadmapSubmitted: !!req.problem.conceptualSolutionExecutionRoadmapSubmitted
        });
      }

      req.flash('success', 'Progress saved.');
      return res.redirect(`/process/${req.problem._id}/conceptual-solution`);
    } catch (err) {
      console.error('conceptual-solution complete-step:', err);
      if (isConceptualSolutionAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save progress.' });
      }
      req.flash('error', 'Could not save progress.');
      return res.redirect(`/process/${req.problem._id}/conceptual-solution`);
    }
  }
);

router
  .route('/process/:problemId/conceptual-solution/blueprint')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    return res.render('process/solutionBlueprint', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      title: 'The Blueprint – Erehwon'
    });
  })
  .post(
    isLoggedIn,
    loadProblemForUser,
    solutionBlueprintUpload.fields([
      { name: 'keyFeatureFiles', maxCount: 10 },
      { name: 'uspFiles', maxCount: 10 }
    ]),
    async (req, res) => {
      try {
        const keyFeatures = parsePostedLines(req.body, 'keyFeatures');
        const customerJourney = parsePostedLines(req.body, 'customerJourney');
        const usp = trimStr(req.body.usp);

        const currentBlueprint =
          req.problem.conceptualSolutionData &&
          req.problem.conceptualSolutionData.blueprint
            ? req.problem.conceptualSolutionData.blueprint
            : {};

        const keyFeatureUploads = Array.isArray(req.files && req.files.keyFeatureFiles)
          ? req.files.keyFeatureFiles.map((f) => trimStr(f.originalname)).filter(Boolean)
          : [];
        const uspUploads = Array.isArray(req.files && req.files.uspFiles)
          ? req.files.uspFiles.map((f) => trimStr(f.originalname)).filter(Boolean)
          : [];

        const keyFeatureFileNames = keyFeatureUploads.length
          ? (currentBlueprint.keyFeatureFileNames || []).concat(keyFeatureUploads)
          : (currentBlueprint.keyFeatureFileNames || []);
        const uspFileNames = uspUploads.length
          ? (currentBlueprint.uspFileNames || []).concat(uspUploads)
          : (currentBlueprint.uspFileNames || []);

        req.problem.conceptualSolutionData = req.problem.conceptualSolutionData || {};
        req.problem.conceptualSolutionData.blueprint = {
          keyFeatures,
          keyFeatureFileNames,
          usp,
          uspFileNames,
          customerJourney
        };

        req.problem.conceptualSolutionBlueprintSubmitted =
          keyFeatures.length > 0 && customerJourney.length > 0 && !!usp;

        await req.problem.save();

        if (isConceptualSolutionAjax(req)) {
          return res.json(conceptualSolutionSaveJson(req.problem));
        }

        req.flash('success', 'Blueprint saved.');
        return res.redirect(`/process/${req.problem._id}/conceptual-solution/blueprint`);
      } catch (err) {
        console.error('conceptual-solution blueprint save:', err);
        if (isConceptualSolutionAjax(req)) {
          return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
        }
        req.flash('error', 'Could not save. Please try again.');
        return res.redirect(`/process/${req.problem._id}/conceptual-solution/blueprint`);
      }
    }
  );

router
  .route('/process/:problemId/conceptual-solution/market-logic')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    return res.render('process/solutionMarketLogic', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      title: 'Market Logic – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      const competitors = parsePostedLines(req.body, 'competitors');
      const competitorAdvantage = parsePostedLines(req.body, 'competitorAdvantage');
      const ourEdge = parsePostedLines(req.body, 'ourEdge');
      const whoPays = parsePostedLines(req.body, 'whoPays');
      const revenueModel = parsePostedLines(req.body, 'revenueModel');
      const pricingStrategy = parsePostedLines(req.body, 'pricingStrategy');

      req.problem.conceptualSolutionData = req.problem.conceptualSolutionData || {};
      req.problem.conceptualSolutionData.marketLogic = {
        competitors,
        competitorAdvantage,
        ourEdge,
        whoPays,
        revenueModel,
        pricingStrategy
      };

      req.problem.conceptualSolutionMarketLogicSubmitted =
        competitors.length > 0 &&
        competitorAdvantage.length > 0 &&
        ourEdge.length > 0 &&
        whoPays.length > 0 &&
        revenueModel.length > 0 &&
        pricingStrategy.length > 0;

      await req.problem.save();

      if (isConceptualSolutionAjax(req)) {
        return res.json(conceptualSolutionSaveJson(req.problem));
      }

      req.flash('success', 'Market Logic saved.');
      return res.redirect(`/process/${req.problem._id}/conceptual-solution/market-logic`);
    } catch (err) {
      console.error('conceptual-solution market-logic save:', err);
      if (isConceptualSolutionAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/conceptual-solution/market-logic`);
    }
  });

router
  .route('/process/:problemId/conceptual-solution/execution-roadmap')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    return res.render('process/solutionExecutionRoadmap', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      title: 'Execution Roadmap – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      const targetUsersForTesting = parsePostedLines(req.body, 'targetUsersForTesting');
      const keyFeaturesToBeBuilt = parsePostedLines(req.body, 'keyFeaturesToBeBuilt');
      const developmentPlanSteps = parsePostedLines(req.body, 'developmentPlanSteps');
      const developmentPlanCompletionDates = bodyFieldArray(req.body, 'developmentPlanCompletionDates')
        .map((d) => trimStr(d))
        .filter(Boolean);
      const financeComponents = parsePostedLines(req.body, 'financeComponents');
      const financeComponentCosts = parsePostedLines(req.body, 'financeComponentCosts');
      const prototypeCost = trimStr(req.body.prototypeCost);
      const marketLaunchPrice = trimStr(req.body.marketLaunchPrice);
      const unitMargin = trimStr(req.body.unitMargin);

      req.problem.conceptualSolutionData = req.problem.conceptualSolutionData || {};
      req.problem.conceptualSolutionData.executionRoadmap = {
        targetUsersForTesting,
        keyFeaturesToBeBuilt,
        developmentPlanSteps,
        developmentPlanCompletionDates,
        financeComponents,
        financeComponentCosts,
        prototypeCost,
        marketLaunchPrice,
        unitMargin
      };

      req.problem.conceptualSolutionExecutionRoadmapSubmitted =
        targetUsersForTesting.length > 0 &&
        keyFeaturesToBeBuilt.length > 0 &&
        developmentPlanSteps.length > 0 &&
        developmentPlanCompletionDates.length > 0 &&
        financeComponents.length > 0 &&
        financeComponentCosts.length > 0 &&
        !!prototypeCost &&
        !!marketLaunchPrice &&
        !!unitMargin;

      await req.problem.save();

      if (isConceptualSolutionAjax(req)) {
        return res.json(conceptualSolutionSaveJson(req.problem));
      }

      req.flash('success', 'Execution Roadmap saved.');
      return res.redirect(`/process/${req.problem._id}/conceptual-solution/execution-roadmap`);
    } catch (err) {
      console.error('conceptual-solution execution-roadmap save:', err);
      if (isConceptualSolutionAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/conceptual-solution/execution-roadmap`);
    }
  });

router
  .route('/process/:problemId/analysis/insight-records')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const ir = req.problem.analysisInsightRecords || {};
    res.render('process/analysisInsightRecords', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      intervieweeNameLines: linesForForm(ir.intervieweeName),
      intervieweeRoleLines: linesForForm(ir.intervieweeRole),
      problemImpactLines: linesForForm(ir.problemImpact),
      functionalDifficultyLines: linesForForm(ir.functionalDifficulty),
      economicPressureLines: linesForForm(ir.economicPressure),
      emotionalConcernLines: linesForForm(ir.emotionalConcern),
      currentWorkaroundLines: linesForForm(ir.currentWorkaround),
      unsaidButImpliedLines: linesForForm(ir.unsaidButImplied),
      stakeholderQuoteLines: linesForForm(ir.stakeholderQuote),
      surpriseLines: linesForForm(ir.surprise),
      otherInsightsLines: linesForForm(ir.otherInsights),
      reflectionLines: linesForForm(ir.reflection),
      insightSubmitted: !!req.problem.analysisInsightRecordsSubmitted,
      synthesisSubmitted: !!req.problem.analysisSynthesisPrioritisationSubmitted,
      statementSubmitted: !!req.problem.analysisProblemStatementSubmitted,
      title: 'Insight Records – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      const payload = {
        intervieweeName: parsePostedLines(req.body, 'intervieweeName'),
        intervieweeRole: parsePostedLines(req.body, 'intervieweeRole'),
        problemImpact: parsePostedLines(req.body, 'problemImpact'),
        functionalDifficulty: parsePostedLines(req.body, 'functionalDifficulty'),
        economicPressure: parsePostedLines(req.body, 'economicPressure'),
        emotionalConcern: parsePostedLines(req.body, 'emotionalConcern'),
        currentWorkaround: parsePostedLines(req.body, 'currentWorkaround'),
        unsaidButImplied: parsePostedLines(req.body, 'unsaidButImplied'),
        stakeholderQuote: parsePostedLines(req.body, 'stakeholderQuote'),
        surprise: parsePostedLines(req.body, 'surprise'),
        otherInsights: parsePostedLines(req.body, 'otherInsights'),
        reflection: parsePostedLines(req.body, 'reflection')
      };

      const bodyArrays = {
        intervieweeName: bodyFieldArray(req.body, 'intervieweeName').map(trimStr),
        intervieweeRole: bodyFieldArray(req.body, 'intervieweeRole').map(trimStr),
        problemImpact: bodyFieldArray(req.body, 'problemImpact').map(trimStr),
        functionalDifficulty: bodyFieldArray(req.body, 'functionalDifficulty').map(trimStr),
        economicPressure: bodyFieldArray(req.body, 'economicPressure').map(trimStr),
        emotionalConcern: bodyFieldArray(req.body, 'emotionalConcern').map(trimStr),
        currentWorkaround: bodyFieldArray(req.body, 'currentWorkaround').map(trimStr),
        unsaidButImplied: bodyFieldArray(req.body, 'unsaidButImplied').map(trimStr),
        stakeholderQuote: bodyFieldArray(req.body, 'stakeholderQuote').map(trimStr),
        surprise: bodyFieldArray(req.body, 'surprise').map(trimStr),
        otherInsights: bodyFieldArray(req.body, 'otherInsights').map(trimStr),
        reflection: bodyFieldArray(req.body, 'reflection').map(trimStr)
      };

      const allTextboxesFilled = Object.values(bodyArrays).every((arr) => arr.length > 0 && arr.every(Boolean));

      req.problem.analysisInsightRecords = payload;
      req.problem.analysisInsightRecordsSubmitted = allTextboxesFilled;
      await req.problem.save();

      if (isAnalysisAjax(req)) {
        return res.json({
          ok: true,
          analysisInsightRecordsSubmitted: !!req.problem.analysisInsightRecordsSubmitted,
          analysisSynthesisPrioritisationSubmitted: !!req.problem.analysisSynthesisPrioritisationSubmitted,
          analysisProblemStatementSubmitted: !!req.problem.analysisProblemStatementSubmitted
        });
      }

      req.flash('success', 'Insight Records saved.');
      return res.redirect(`/process/${req.problem._id}/analysis`);
    } catch (err) {
      console.error('analysis insight-records save:', err);
      if (isAnalysisAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/analysis/insight-records`);
    }
  });

router
  .route('/process/:problemId/analysis/synthesis-prioritisation')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const sp = req.problem.analysisSynthesisPrioritisation || {};
    function numArrayForForm(arr, fallback) {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return [String(fallback)];
      return arr.map((v) => String(v == null ? fallback : v));
    }
    res.render('process/analysisSynthesisPrioritisation', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      insightThemeLines: linesForForm(sp.insightTheme),
      themeTypeLines: linesForForm(sp.themeType),
      evidenceCountLines: numArrayForForm(sp.evidenceCount, 0),
      severityLines: numArrayForForm(sp.severity, 0),
      frequencyLines: numArrayForForm(sp.frequency, 0),
      problemDraftLines: linesForForm(sp.problemDraft),
      impactLevelLines: linesForForm(sp.impactLevel),
      feasibilityLines: linesForForm(sp.feasibility),
      alignmentLines: linesForForm(sp.alignmentWithTeamSkills),
      priorityRankLines: numArrayForForm(sp.priorityRank, 0),
      functionalReqLines: linesForForm(sp.functionalRequirement),
      nonFunctionalReqLines: linesForForm(sp.nonFunctionalRequirement),
      criticalImpactLines: linesForForm(sp.criticalImpactReflection),
      eliminationReasonLines: linesForForm(sp.eliminationReason),
      insightSubmitted: !!req.problem.analysisInsightRecordsSubmitted,
      synthesisSubmitted: !!req.problem.analysisSynthesisPrioritisationSubmitted,
      statementSubmitted: !!req.problem.analysisProblemStatementSubmitted,
      title: 'Synthesis & Prioritisation – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      function parseNumArray(field) {
        return bodyFieldArray(req.body, field).map((v) => {
          const n = parseInt(trimStr(v), 10);
          return Number.isFinite(n) ? n : 0;
        });
      }
      function parseTextArray(field) {
        return bodyFieldArray(req.body, field).map((v) => trimStr(v));
      }

      const draftRows = (() => {
        const draft = parseTextArray('problemDraft');
        const impact = parseTextArray('impactLevel');
        const feasibility = parseTextArray('feasibility');
        const alignment = parseTextArray('alignmentWithTeamSkills');
        const priority = parseNumArray('priorityRank');
        const n = Math.max(draft.length, impact.length, feasibility.length, alignment.length, priority.length);
        const rows = [];
        for (let i = 0; i < n; i++) {
          rows.push({
            draft: draft[i] || '',
            impact: impact[i] || '',
            feasibility: feasibility[i] || '',
            alignment: alignment[i] || '',
            priority: Number.isFinite(priority[i]) ? priority[i] : 0,
            idx: i
          });
        }
        rows.sort((a, b) => {
          const aUnset = a.priority <= 0;
          const bUnset = b.priority <= 0;
          if (aUnset && bUnset) return a.idx - b.idx;
          if (aUnset) return 1;
          if (bUnset) return -1;
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.idx - b.idx;
        });
        return rows;
      })();

      const payload = {
        insightTheme: parsePostedLines(req.body, 'insightTheme'),
        themeType: parsePostedLines(req.body, 'themeType'),
        evidenceCount: parseNumArray('evidenceCount'),
        severity: parseNumArray('severity'),
        frequency: parseNumArray('frequency'),
        problemDraft: draftRows.map((r) => r.draft),
        impactLevel: draftRows.map((r) => r.impact),
        feasibility: draftRows.map((r) => r.feasibility),
        alignmentWithTeamSkills: draftRows.map((r) => r.alignment),
        priorityRank: draftRows.map((r) => r.priority),
        functionalRequirement: parsePostedLines(req.body, 'functionalRequirement'),
        nonFunctionalRequirement: parsePostedLines(req.body, 'nonFunctionalRequirement'),
        criticalImpactReflection: parsePostedLines(req.body, 'criticalImpactReflection'),
        eliminationReason: parsePostedLines(req.body, 'eliminationReason')
      };

      function filled(arr) {
        return arr && Array.isArray(arr) && arr.length > 0 && arr.every((v) => !!trimStr(v));
      }
      const allTextboxesFilled =
        filled(bodyFieldArray(req.body, 'insightTheme')) &&
        filled(bodyFieldArray(req.body, 'themeType')) &&
        parseNumArray('evidenceCount').every((n) => n > 0) &&
        parseNumArray('severity').every((n) => n > 0) &&
        parseNumArray('frequency').every((n) => n > 0) &&
        filled(bodyFieldArray(req.body, 'problemDraft')) &&
        filled(bodyFieldArray(req.body, 'impactLevel')) &&
        filled(bodyFieldArray(req.body, 'feasibility')) &&
        filled(bodyFieldArray(req.body, 'alignmentWithTeamSkills')) &&
        parseNumArray('priorityRank').every((n) => n > 0) &&
        filled(bodyFieldArray(req.body, 'functionalRequirement')) &&
        filled(bodyFieldArray(req.body, 'nonFunctionalRequirement')) &&
        filled(bodyFieldArray(req.body, 'criticalImpactReflection')) &&
        filled(bodyFieldArray(req.body, 'eliminationReason'));

      req.problem.analysisSynthesisPrioritisation = payload;
      req.problem.analysisSynthesisPrioritisationSubmitted = allTextboxesFilled;
      await req.problem.save();

      if (isAnalysisAjax(req)) {
        return res.json({
          ok: true,
          analysisInsightRecordsSubmitted: !!req.problem.analysisInsightRecordsSubmitted,
          analysisSynthesisPrioritisationSubmitted: !!req.problem.analysisSynthesisPrioritisationSubmitted,
          analysisProblemStatementSubmitted: !!req.problem.analysisProblemStatementSubmitted
        });
      }
      req.flash('success', 'Synthesis & Prioritisation saved.');
      return res.redirect(`/process/${req.problem._id}/analysis`);
    } catch (err) {
      console.error('analysis synthesis-prioritisation save:', err);
      if (isAnalysisAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/analysis/synthesis-prioritisation`);
    }
  });

router
  .route('/process/:problemId/analysis/problem-statement')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const ps = req.problem.analysisProblemStatement || {};
    const commitmentLines = (ps.digitalCommitment && Array.isArray(ps.digitalCommitment) && ps.digitalCommitment.length)
      ? linesForForm(ps.digitalCommitment)
      : ['', '', ''];

    res.render('process/analysisProblemStatement', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      solveHelpLine: ps.solveHelp || '',
      targetUserLine: ps.targetUser || '',
      towardOutcomeLine: ps.towardOutcome || '',
      checklistExactProblem: !!ps.checklistExactProblem,
      checklistExactUser: !!ps.checklistExactUser,
      checklistMeasurable: !!ps.checklistMeasurable,
      digitalCommitmentLines: commitmentLines,
      insightSubmitted: !!req.problem.analysisInsightRecordsSubmitted,
      synthesisSubmitted: !!req.problem.analysisSynthesisPrioritisationSubmitted,
      statementSubmitted: !!req.problem.analysisProblemStatementSubmitted,
      title: 'Problem Statement – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      const payload = {
        solveHelp: trimStr(req.body.solveHelp),
        targetUser: trimStr(req.body.targetUser),
        towardOutcome: trimStr(req.body.towardOutcome),
        checklistExactProblem: !!req.body.checklistExactProblem,
        checklistExactUser: !!req.body.checklistExactUser,
        checklistMeasurable: !!req.body.checklistMeasurable,
        digitalCommitment: parsePostedLines(req.body, 'digitalCommitment')
      };

      const allTextboxesFilled =
        !!payload.solveHelp &&
        !!payload.targetUser &&
        !!payload.towardOutcome &&
        payload.checklistExactProblem &&
        payload.checklistExactUser &&
        payload.checklistMeasurable &&
        allFilled(bodyFieldArray(req.body, 'digitalCommitment'));

      req.problem.analysisProblemStatement = payload;
      req.problem.analysisProblemStatementSubmitted = allTextboxesFilled;
      await req.problem.save();

      if (isAnalysisAjax(req)) {
        return res.json({
          ok: true,
          analysisInsightRecordsSubmitted: !!req.problem.analysisInsightRecordsSubmitted,
          analysisSynthesisPrioritisationSubmitted: !!req.problem.analysisSynthesisPrioritisationSubmitted,
          analysisProblemStatementSubmitted: !!req.problem.analysisProblemStatementSubmitted
        });
      }
      req.flash('success', 'Problem Statement saved.');
      return res.redirect(`/process/${req.problem._id}/analysis`);
    } catch (err) {
      console.error('analysis problem-statement save:', err);
      if (isAnalysisAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/analysis/problem-statement`);
    }
  });

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
  .route('/process/:problemId/ideation/idea-generation')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const stored = req.problem.ideationIdeaGeneration || {};
    const normalized = normalizeIdeationIdeaGenerationPayload(stored, stored.rawIdeas);
    const rawIdeaLines =
      normalized.rawIdeas && Array.isArray(normalized.rawIdeas) && normalized.rawIdeas.length > 0
        ? linesForForm(normalized.rawIdeas)
        : [''];
    const previousUnlocked = !!stored.themesUnlocked;
    const submittedFromThemes = ideationHasDroppedIdeas(normalized.themes);
    const ideaGenState = {
      rawIdeas: rawIdeaLines,
      themes: normalized.themes,
      selectedThemeId: normalized.selectedThemeId,
      themesUnlocked: previousUnlocked
    };
    const ideaGenStateJson = JSON.stringify(ideaGenState).replace(/</g, '\\u003c');
    res.render('process/ideationIdeaGeneration', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      problemStatementParagraphs: problemStatementParagraphsForIdeation(req.problem),
      ideaGenSubmitted: submittedFromThemes,
      ideationThemesUnlocked: previousUnlocked,
      sotaSubmitted: !!req.problem.ideationSotaReportSubmitted,
      ideaGenStateJson,
      title: 'Idea Generation – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      let posted = {};
      try {
        posted = JSON.parse(trimStr(req.body.ideationPayload || '{}'));
      } catch (e) {
        posted = {};
      }
      const fallbackRawIdeas = ideationRawIdeasFromBody(req.body);
      const payload = normalizeIdeationIdeaGenerationPayload(posted, fallbackRawIdeas);
      const rawIdeas = payload.rawIdeas;
      const unlockByIdeas = ideationIdeaGenerationIsComplete(rawIdeas);
      const submitted = ideationHasDroppedIdeas(payload.themes);
      const previousUnlocked = !!req.problem.ideationIdeaGeneration?.themesUnlocked;
      const themesUnlocked = previousUnlocked || unlockByIdeas;
      req.problem.ideationIdeaGeneration = {
        rawIdeas,
        themesUnlocked,
        selectedThemeId: payload.selectedThemeId,
        themes: payload.themes
      };
      req.problem.ideationIdeaGenerationSubmitted = submitted;
      await req.problem.save();

      if (isIdeationAjax(req)) {
        return res.json({
          ok: true,
          ideationIdeaGenerationSubmitted: !!req.problem.ideationIdeaGenerationSubmitted,
          ideationThemesUnlocked: themesUnlocked
        });
      }
      req.flash('success', 'Idea generation saved.');
      return res.redirect(`/process/${req.problem._id}/ideation/idea-generation`);
    } catch (err) {
      console.error('ideation idea-generation save:', err);
      if (isIdeationAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      return res.redirect(`/process/${req.problem._id}/ideation/idea-generation`);
    }
  });

router
  .route('/process/:problemId/ideation/sota-report')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const sotaState = normalizeSotaPayload(req.problem.ideationSotaReport || {});
    const sotaStateJson = JSON.stringify(sotaState).replace(/</g, '\\u003c');
    res.render('process/ideationSotaReport', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      sotaSubmitted: !!req.problem.ideationSotaReportSubmitted,
      sotaState,
      sotaStateJson,
      title: 'SOTA Report – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      let posted = {};
      try {
        posted = JSON.parse(trimStr(req.body.sotaPayload || '{}'));
      } catch (e) {
        posted = {};
      }

      const payload = normalizeSotaPayload(posted);
      req.problem.ideationSotaReport = payload;
      req.problem.ideationSotaReportSubmitted = sotaReportIsComplete(payload);
      await req.problem.save();

      if (isIdeationAjax(req)) {
        return res.json({
          ok: true,
          ideationSotaReportSubmitted: !!req.problem.ideationSotaReportSubmitted
        });
      }

      return res.redirect(`/process/${req.problem._id}/ideation/sota-report`);
    } catch (err) {
      console.error('ideation sota-report save:', err);
      if (isIdeationAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      return res.redirect(`/process/${req.problem._id}/ideation/sota-report`);
    }
  });

router
  .route('/process/:problemId/converge-ideas/feature-synthesis')
  .get(isLoggedIn, loadProblemForUser, async (req, res) => {
    const synthesisData = req.problem.analysisSynthesisPrioritisation || {};
    const functionalRequirements = Array.isArray(synthesisData.functionalRequirement)
      ? synthesisData.functionalRequirement.map(trimStr).filter(Boolean)
      : [];
    const nonFunctionalRequirements = Array.isArray(synthesisData.nonFunctionalRequirement)
      ? synthesisData.nonFunctionalRequirement.map(trimStr).filter(Boolean)
      : [];

    const mappedIdeas = [];
    const ideationData = req.problem.ideationIdeaGeneration || {};
    const rawIdeas = Array.isArray(ideationData.rawIdeas) ? ideationData.rawIdeas : [];
    rawIdeas.forEach((ideaText, idx) => {
      const text = trimStr(ideaText);
      if (!text) return;
      mappedIdeas.push({
        id: `raw_idea_${idx + 1}`,
        text
      });
    });

    const themes = Array.isArray(ideationData.themes) ? ideationData.themes : [];
    themes.forEach((theme, themeIdx) => {
      const dropped = Array.isArray(theme?.dropped) ? theme.dropped : [];
      dropped.forEach((entry, idx) => {
        const text = trimStr(entry?.text);
        if (!text) return;
        const id = trimStr(entry?.id) || `theme_idea_${themeIdx + 1}_${idx + 1}`;
        mappedIdeas.push({ id, text });
      });
    });

    const convergeData = req.problem.convergeIdeasData || {};
    const featurePairs = Array.isArray(convergeData.featurePairs) ? convergeData.featurePairs : [];
    const featureCards = Array.isArray(convergeData.featureCards) ? convergeData.featureCards : [];
    const groupedFeatureCards = Array.isArray(convergeData.groupedFeatureCards) ? convergeData.groupedFeatureCards : [];
    const convergeFeatureSynthesisSubmitted = featureCards.length > 0 || groupedFeatureCards.length > 0;

    res.render('process/convergeFeatureSynthesis', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      ideas: mappedIdeas,
      functionalRequirements,
      nonFunctionalRequirements,
      convergeData,
      featurePairs,
      featureCards,
      groupedFeatureCards,
      convergeFeatureSynthesisSubmitted,
      title: 'Feature Synthesis – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      let cards = [];
      try {
        cards = JSON.parse(trimStr(req.body.featureCardsJson || '[]'));
        if (!Array.isArray(cards)) cards = [];
      } catch (e) {
        cards = [];
      }

      let groupedCards = [];
      try {
        groupedCards = JSON.parse(trimStr(req.body.groupedFeatureCardsJson || '[]'));
        if (!Array.isArray(groupedCards)) groupedCards = [];
      } catch (e) {
        groupedCards = [];
      }

      let pairs = [];
      try {
        pairs = JSON.parse(trimStr(req.body.featurePairsJson || '[]'));
        if (!Array.isArray(pairs)) pairs = [];
      } catch (e) {
        pairs = [];
      }

      const cleanCards = cards
        .map((card, idx) => {
          const item = card && typeof card === 'object' ? card : {};
          const requirementType = trimStr(item.requirementType);
          const requirementText = trimStr(item.requirementText);
          const ideas = Array.isArray(item.ideas)
            ? item.ideas
                .map((idea, j) => {
                  const x = idea && typeof idea === 'object' ? idea : {};
                  const ideaId = trimStr(x.ideaId);
                  const ideaText = trimStr(x.ideaText);
                  if (!ideaId || !ideaText) return null;
                  return { ideaId, ideaText };
                })
                .filter(Boolean)
            : [];
          if (!requirementText || ideas.length === 0) return null;
          return {
            featureId: trimStr(item.featureId) || `feature_${idx + 1}`,
            checked: !!item.checked,
            requirementType: requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional',
            requirementText,
            ideas
          };
        })
        .filter(Boolean);

      const cleanGroupedCards = groupedCards
        .map((group, gIdx) => {
          const item = group && typeof group === 'object' ? group : {};
          const features = Array.isArray(item.features)
            ? item.features
                .map((feature, fIdx) => {
                  const card = feature && typeof feature === 'object' ? feature : {};
                  const requirementType = trimStr(card.requirementType);
                  const requirementText = trimStr(card.requirementText);
                  const ideas = Array.isArray(card.ideas)
                    ? card.ideas
                        .map((idea) => {
                          const i = idea && typeof idea === 'object' ? idea : {};
                          const ideaId = trimStr(i.ideaId);
                          const ideaText = trimStr(i.ideaText);
                          if (!ideaId || !ideaText) return null;
                          return { ideaId, ideaText };
                        })
                        .filter(Boolean)
                    : [];
                  if (!requirementText || ideas.length === 0) return null;
                  return {
                    featureId: trimStr(card.featureId) || `group_${gIdx + 1}_feature_${fIdx + 1}`,
                    checked: !!card.checked,
                    requirementType: requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional',
                    requirementText,
                    ideas
                  };
                })
                .filter(Boolean)
            : [];
          if (!features.length) return null;
          return {
            groupId: trimStr(item.groupId) || `group_${gIdx + 1}`,
            name: trimStr(item.name) || `Group ${gIdx + 1}`,
            checked: !!item.checked,
            features
          };
        })
        .filter(Boolean);

      const cleanPairs = pairs
        .map((row) => {
          const item = row && typeof row === 'object' ? row : {};
          const requirementType = trimStr(item.requirementType);
          const requirementText = trimStr(item.requirementText);
          const ideaId = trimStr(item.ideaId);
          const ideaText = trimStr(item.ideaText);
          if (!requirementText || !ideaId) return null;
          return {
            requirementType: requirementType === 'nonFunctional' ? 'nonFunctional' : 'functional',
            requirementText,
            ideaId,
            ideaText
          };
        })
        .filter(Boolean);

      // If feature cards are present, derive pair map from cards to keep data consistent.
      if (cleanCards.length || cleanGroupedCards.length) {
        cleanPairs.length = 0;
        cleanCards.forEach((card) => {
          card.ideas.forEach((idea) => {
            cleanPairs.push({
              requirementType: card.requirementType,
              requirementText: card.requirementText,
              ideaId: idea.ideaId,
              ideaText: idea.ideaText
            });
          });
        });
        cleanGroupedCards.forEach((group) => {
          group.features.forEach((card) => {
            card.ideas.forEach((idea) => {
              cleanPairs.push({
                requirementType: card.requirementType,
                requirementText: card.requirementText,
                ideaId: idea.ideaId,
                ideaText: idea.ideaText
              });
            });
          });
        });
      }

      const groupedMap = cleanPairs.reduce((acc, row) => {
        const key = `${row.requirementType}::${row.requirementText}`;
        if (!acc[key]) {
          acc[key] = {
            requirementType: row.requirementType,
            requirementText: row.requirementText,
            ideaIds: []
          };
        }
        if (!acc[key].ideaIds.includes(row.ideaId)) {
          acc[key].ideaIds.push(row.ideaId);
        }
        return acc;
      }, {});

      const requirementIdeaMap = Object.values(groupedMap);
      const definedFeaturesFromCards = cleanCards.map((card) => {
        const ideaText = card.ideas.map((idea) => idea.ideaText).join(' | ');
        return `${card.requirementText} <- ${ideaText}`;
      });
      const definedFeaturesFromGroups = cleanGroupedCards.reduce((rows, group) => {
        group.features.forEach((card) => {
          const ideaText = card.ideas.map((idea) => idea.ideaText).join(' | ');
          rows.push(`${group.name}: ${card.requirementText} <- ${ideaText}`);
        });
        return rows;
      }, []);
      const definedFeaturesFromText = trimStr(req.body.definedFeaturesText)
        .split('\n')
        .map((line) => trimStr(line))
        .filter(Boolean);
      const definedFeaturesComputed = definedFeaturesFromCards.concat(definedFeaturesFromGroups);
      const definedFeatures = definedFeaturesComputed.length
        ? definedFeaturesComputed
        : definedFeaturesFromText;

      const firstIdea = cleanPairs[0] || null;
      req.problem.convergeIdeasData = req.problem.convergeIdeasData || {};
      req.problem.convergeIdeasData.requirementIdeaMap = requirementIdeaMap;
      req.problem.convergeIdeasData.definedFeatures = definedFeatures;
      req.problem.convergeIdeasData.featurePairs = cleanPairs;
      req.problem.convergeIdeasData.featureCards = cleanCards;
      req.problem.convergeIdeasData.groupedFeatureCards = cleanGroupedCards;
      if (firstIdea) {
        req.problem.convergeIdeasData.finalChosenIdeaText = firstIdea.ideaText || '';
        if (/^[a-fA-F0-9]{24}$/.test(firstIdea.ideaId)) {
          req.problem.convergeIdeasData.finalChosenIdeaId = firstIdea.ideaId;
        }
      }
      await req.problem.save();
      const convergeFeatureSynthesisSubmitted = cleanCards.length > 0 || cleanGroupedCards.length > 0;

      if (isConvergeAjax(req)) {
        return res.json({ ok: true, convergeFeatureSynthesisSubmitted });
      }
      return res.redirect(`/process/${req.problem._id}/converge-ideas/feature-synthesis`);
    } catch (err) {
      console.error('converge feature-synthesis save:', err);
      if (isConvergeAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/converge-ideas/feature-synthesis`);
    }
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

function linesForForm(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return [''];
  return arr.map((s) => (s == null ? '' : String(s)));
}

function parsePostedLines(body, fieldName) {
  const bracket = `${fieldName}[]`;
  let v = body[bracket];
  if (v === undefined || v === null) v = body[fieldName];
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => trimStr(x)).filter(Boolean);
}

function bodyFieldArray(body, fieldName) {
  const bracket = `${fieldName}[]`;
  let v = body[bracket];
  if (v === undefined || v === null) v = body[fieldName];
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseTripletCategory(body, base) {
  const df = bodyFieldArray(body, `${base}_dataFound`).map(trimStr);
  const sl = bodyFieldArray(body, `${base}_sourceLink`).map(trimStr);
  const wm = bodyFieldArray(body, `${base}_whyMatters`).map(trimStr);
  const maxLen = Math.max(df.length, sl.length, wm.length);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const r = {
      dataFound: df[i] || '',
      sourceLink: sl[i] || '',
      whyMatters: wm[i] || ''
    };
    if (r.dataFound || r.sourceLink || r.whyMatters) rows.push(r);
  }
  return rows;
}

function tripletCategoryComplete(rows) {
  return rows.some((r) => r.dataFound && r.sourceLink && r.whyMatters);
}

function tripletCategoryPartial(rows) {
  return rows.some((r) => {
    const any = !!(r.dataFound || r.sourceLink || r.whyMatters);
    const full = !!(r.dataFound && r.sourceLink && r.whyMatters);
    return any && !full;
  });
}

function allFilled(values) {
  if (!values || !Array.isArray(values) || values.length === 0) return false;
  return values.every((v) => !!trimStr(v));
}

function tripletTextboxesAllFilledFromBody(body, base) {
  const df = bodyFieldArray(body, `${base}_dataFound`).map(trimStr);
  const sl = bodyFieldArray(body, `${base}_sourceLink`).map(trimStr);
  const wm = bodyFieldArray(body, `${base}_whyMatters`).map(trimStr);
  const n = Math.max(df.length, sl.length, wm.length);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    if (!df[i] || !sl[i] || !wm[i]) return false;
  }
  return true;
}

function stakeholderTextboxesAllFilledFromBody(body, base) {
  const personRole = bodyFieldArray(body, `${base}_personRole`).map(trimStr);
  const whyMatter = bodyFieldArray(body, `${base}_whyMatter`).map(trimStr);
  const n = Math.max(personRole.length, whyMatter.length);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    if (!personRole[i] || !whyMatter[i]) return false;
  }
  return true;
}

function stakeholderTextboxesAllFilledOptionalFromBody(body, base) {
  const personRole = bodyFieldArray(body, `${base}_personRole`).map(trimStr);
  const whyMatter = bodyFieldArray(body, `${base}_whyMatter`).map(trimStr);
  const n = Math.max(personRole.length, whyMatter.length);

  // Optional category: if left completely blank, treat as complete.
  if (n === 0) return true;
  const anyFilled = personRole.some(Boolean) || whyMatter.some(Boolean);
  if (!anyFilled) return true;

  for (let i = 0; i < n; i++) {
    if (!personRole[i] || !whyMatter[i]) return false;
  }
  return true;
}

function interactionTextboxesAllFilledFromBody(body, prefix) {
  const org = bodyFieldArray(body, `${prefix}_organization`).map(trimStr);
  const obj = bodyFieldArray(body, `${prefix}_objective`).map(trimStr);
  const take = bodyFieldArray(body, `${prefix}_takeaways`).map(trimStr);
  const n = Math.max(org.length, obj.length, take.length);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    if (!org[i] || !obj[i] || !take[i]) return false;
  }
  return true;
}

function challengeIntentTextboxesAllFilled(body) {
  return (
    !!trimStr(body.challengeChosen) &&
    !!trimStr(body.industrySector) &&
    allFilled(bodyFieldArray(body, 'whyMattersToday').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'existingSolutions').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'whatsMissing').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'motivation').map(trimStr))
  );
}

function problemResearchTextboxesAllFilled(body) {
  return (
    tripletTextboxesAllFilledFromBody(body, 'pr_scale') &&
    tripletTextboxesAllFilledFromBody(body, 'pr_economic') &&
    tripletTextboxesAllFilledFromBody(body, 'pr_operational') &&
    tripletTextboxesAllFilledFromBody(body, 'pr_human') &&
    tripletTextboxesAllFilledFromBody(body, 'pr_environmental') &&
    tripletTextboxesAllFilledFromBody(body, 'pr_futureRisk') &&
    allFilled(bodyFieldArray(body, 'pr_proj_costReduction').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'pr_proj_timeSavings').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'pr_proj_efficiency').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'pr_proj_safety').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'pr_proj_sustainability').map(trimStr)) &&
    allFilled(bodyFieldArray(body, 'pr_proj_others').map(trimStr)) &&
    !!trimStr(body.reflection)
  );
}

function stakeholderMappingTextboxesAllFilled(body) {
  return (
    stakeholderTextboxesAllFilledFromBody(body, 'sm_directUser') &&
    stakeholderTextboxesAllFilledFromBody(body, 'sm_indirectUser') &&
    stakeholderTextboxesAllFilledFromBody(body, 'sm_decisionMaker') &&
    stakeholderTextboxesAllFilledFromBody(body, 'sm_domainExpert') &&
    stakeholderTextboxesAllFilledOptionalFromBody(body, 'sm_regulator') &&
    stakeholderTextboxesAllFilledFromBody(body, 'sm_solutionProvider') &&
    interactionTextboxesAllFilledFromBody(body, 'sm_log_siteVisit') &&
    interactionTextboxesAllFilledFromBody(body, 'sm_log_expertMeeting') &&
    interactionTextboxesAllFilledFromBody(body, 'sm_log_userInterview')
  );
}

function normTripletRowsForForm(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) {
    return [{ dataFound: '', sourceLink: '', whyMatters: '' }];
  }
  return arr.map((r) => ({
    dataFound: r && r.dataFound != null ? String(r.dataFound) : '',
    sourceLink: r && r.sourceLink != null ? String(r.sourceLink) : '',
    whyMatters: r && r.whyMatters != null ? String(r.whyMatters) : ''
  }));
}

router
  .route('/process/:problemId/problem-discovery/challenge-intent')
  .get(isLoggedIn, loadProblemForUser, (req, res) => {
    const ci = req.problem.problemDiscoveryChallengeIntent || {};
    res.render('process/challengeIntent', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      challengeChosen: ci.challengeChosen || '',
      industrySector: ci.industrySector || '',
      whyLines: linesForForm(ci.whyMattersToday),
      solutionsLines: linesForForm(ci.existingSolutions),
      missingLines: linesForForm(ci.whatsMissing),
      motivationLines: linesForForm(ci.motivation),
      challengeSubmitted: !!req.problem.problemDiscoveryChallengeIntentSubmitted,
      researchSubmitted: !!req.problem.problemDiscoveryProblemResearchSubmitted,
      stakeholdersSubmitted: !!req.problem.problemDiscoveryStakeholderMappingSubmitted,
      title: 'Challenge & Intent – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      const challengeChosen = trimStr(req.body.challengeChosen);
      const industrySector = trimStr(req.body.industrySector);
      const whyMattersToday = parsePostedLines(req.body, 'whyMattersToday');
      const existingSolutions = parsePostedLines(req.body, 'existingSolutions');
      const whatsMissing = parsePostedLines(req.body, 'whatsMissing');
      const motivation = parsePostedLines(req.body, 'motivation');

      const ciPayload = {
        challengeChosen,
        industrySector,
        whyMattersToday,
        existingSolutions,
        whatsMissing,
        motivation
      };
      const errors = validateChallengeIntentPayload(ciPayload);
      const allTextboxesFilled = challengeIntentTextboxesAllFilled(req.body);

      if (isProblemDiscoveryAjax(req)) {
        req.problem.problemDiscoveryChallengeIntent = ciPayload;
        req.problem.problemDiscoveryChallengeIntentSubmitted = errors.length === 0 && allTextboxesFilled;
        await req.problem.save();
        return res.json(problemDiscoverySaveJson(req.problem));
      }

      if (errors.length) {
        req.flash('error', errors.join(' '));
        return res.redirect(`/process/${req.problem._id}/problem-discovery/challenge-intent`);
      }

      req.problem.problemDiscoveryChallengeIntent = ciPayload;
      req.problem.problemDiscoveryChallengeIntentSubmitted = allTextboxesFilled;
      await req.problem.save();
      req.flash('success', 'Challenge & Intent saved.');
      return res.redirect(`/process/${req.problem._id}/problem-discovery`);
    } catch (err) {
      console.error('challenge-intent save:', err);
      if (isProblemDiscoveryAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/problem-discovery/challenge-intent`);
    }
  });

router
  .route('/process/:problemId/problem-discovery/problem-research')
  .get(isLoggedIn, loadProblemForUser, (req, res) => {
    const prData = req.problem.problemDiscoveryProblemResearch || {};
    const prCategories = [
      {
        base: 'pr_scale',
        label: 'Scale of problem (numbers/statistics)',
        rows: normTripletRowsForForm(prData.scale),
        phDf: 'e.g., 2M tons of waste/year',
        phSl: 'e.g., Industry report URL',
        phWm: 'e.g., Quantifies urgency for leadership'
      },
      {
        base: 'pr_economic',
        label: 'Economic impact',
        rows: normTripletRowsForForm(prData.economic),
        phDf: 'e.g., $50M in annual losses',
        phSl: 'e.g., Trade publication URL',
        phWm: 'e.g., Makes the business case clear'
      },
      {
        base: 'pr_operational',
        label: 'Operational impact',
        rows: normTripletRowsForForm(prData.operational),
        phDf: 'e.g., 30% downtime in plants',
        phSl: 'e.g., Internal ops study link',
        phWm: 'e.g., Shows day-to-day operational pain'
      },
      {
        base: 'pr_human',
        label: 'Human impact',
        rows: normTripletRowsForForm(prData.human),
        phDf: 'e.g., 12,000 workers at elevated risk',
        phSl: 'e.g., NGO or labor data source',
        phWm: 'e.g., Why people leaders should care'
      },
      {
        base: 'pr_environmental',
        label: 'Environmental impact (if applicable)',
        rows: normTripletRowsForForm(prData.environmental),
        phDf: 'e.g., Emissions or waste volume',
        phSl: 'e.g., Agency or ESG report URL',
        phWm: 'e.g., Sustainability and compliance angle'
      },
      {
        base: 'pr_futureRisk',
        label: 'Future risk if unsolved',
        rows: normTripletRowsForForm(prData.futureRisk),
        phDf: 'e.g., 3× cost growth by 2030 if unaddressed',
        phSl: 'e.g., Forecast or scenario source',
        phWm: 'e.g., Why waiting is costly'
      }
    ];
    const projectedFields = [
      {
        field: 'pr_proj_costReduction',
        label: 'Cost reduction',
        lines: linesForForm(prData.projectedCostReduction),
        placeholder: 'e.g., 15% lower operating cost'
      },
      {
        field: 'pr_proj_timeSavings',
        label: 'Time savings',
        lines: linesForForm(prData.projectedTimeSavings),
        placeholder: 'e.g., 20 hours saved per week per team'
      },
      {
        field: 'pr_proj_efficiency',
        label: 'Efficiency increase',
        lines: linesForForm(prData.projectedEfficiencyIncrease),
        placeholder: 'e.g., 25% throughput increase'
      },
      {
        field: 'pr_proj_safety',
        label: 'Safety improvement',
        lines: linesForForm(prData.projectedSafetyImprovement),
        placeholder: 'e.g., Fewer near-miss incidents'
      },
      {
        field: 'pr_proj_sustainability',
        label: 'Sustainability improvement',
        lines: linesForForm(prData.projectedSustainabilityImprovement),
        placeholder: 'e.g., Lower emissions or waste'
      },
      {
        field: 'pr_proj_others',
        label: 'Others',
        lines: linesForForm(prData.projectedOthers),
        placeholder: 'e.g., Quality, morale, compliance'
      }
    ];
    res.render('process/problemResearch', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      prCategories,
      projectedFields,
      reflection: prData.reflection || '',
      researchFileNames: prData.researchFileNames || [],
      challengeSubmitted: !!req.problem.problemDiscoveryChallengeIntentSubmitted,
      researchSubmitted: !!req.problem.problemDiscoveryProblemResearchSubmitted,
      stakeholdersSubmitted: !!req.problem.problemDiscoveryStakeholderMappingSubmitted,
      title: 'Problem Research – Erehwon'
    });
  })
  .post(
    isLoggedIn,
    loadProblemForUser,
    prResearchUpload.array('researchFiles', 20),
    async (req, res) => {
      try {
        const existing = req.problem.problemDiscoveryProblemResearch || {};
        const scale = parseTripletCategory(req.body, 'pr_scale');
        const economic = parseTripletCategory(req.body, 'pr_economic');
        const operational = parseTripletCategory(req.body, 'pr_operational');
        const human = parseTripletCategory(req.body, 'pr_human');
        const environmental = parseTripletCategory(req.body, 'pr_environmental');
        const futureRisk = parseTripletCategory(req.body, 'pr_futureRisk');

        const projectedCostReduction = parsePostedLines(req.body, 'pr_proj_costReduction');
        const projectedTimeSavings = parsePostedLines(req.body, 'pr_proj_timeSavings');
        const projectedEfficiencyIncrease = parsePostedLines(req.body, 'pr_proj_efficiency');
        const projectedSafetyImprovement = parsePostedLines(req.body, 'pr_proj_safety');
        const projectedSustainabilityImprovement = parsePostedLines(req.body, 'pr_proj_sustainability');
        const projectedOthers = parsePostedLines(req.body, 'pr_proj_others');

        const reflection = trimStr(req.body.reflection);

        const newUploadNames = (req.files || []).map((f) => trimStr(f.originalname)).filter(Boolean);
        const researchFileNames =
          newUploadNames.length > 0
            ? [...(existing.researchFileNames || []), ...newUploadNames]
            : existing.researchFileNames || [];

        const prPayload = {
          scale,
          economic,
          operational,
          human,
          environmental,
          futureRisk,
          projectedCostReduction,
          projectedTimeSavings,
          projectedEfficiencyIncrease,
          projectedSafetyImprovement,
          projectedSustainabilityImprovement,
          projectedOthers,
          reflection,
          researchFileNames
        };
        const errors = validateProblemResearchPayload(prPayload);
        const allTextboxesFilled = problemResearchTextboxesAllFilled(req.body);

        if (isProblemDiscoveryAjax(req)) {
          req.problem.problemDiscoveryProblemResearch = prPayload;
          req.problem.problemDiscoveryProblemResearchSubmitted =
            errors.length === 0 && allTextboxesFilled;
          await req.problem.save();
          return res.json(problemDiscoverySaveJson(req.problem));
        }

        if (errors.length) {
          req.flash('error', errors.join(' '));
          return res.redirect(`/process/${req.problem._id}/problem-discovery/problem-research`);
        }

        req.problem.problemDiscoveryProblemResearch = prPayload;
        req.problem.problemDiscoveryProblemResearchSubmitted = allTextboxesFilled;
        await req.problem.save();
        req.flash('success', 'Problem Research saved.');
        return res.redirect(`/process/${req.problem._id}/problem-discovery`);
      } catch (err) {
        console.error('problem-research save:', err);
        if (isProblemDiscoveryAjax(req)) {
          return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
        }
        req.flash('error', 'Could not save. Please try again.');
        return res.redirect(`/process/${req.problem._id}/problem-discovery/problem-research`);
      }
    }
  );

function defaultStakeholderRow() {
  return {
    personRole: '',
    whyMatter: '',
    contactPlanned: true,
    contactContacted: false,
    contactMet: false
  };
}

function normStakeholderRows(arr) {
  if (!arr || !arr.length) return [defaultStakeholderRow()];
  return arr.map((r) => {
    if (!r) return defaultStakeholderRow();
    const personRole = r.personRole != null ? String(r.personRole) : '';
    const whyMatter = r.whyMatter != null ? String(r.whyMatter) : '';
    const legacy = trimStr(r.contactStatus);
    if (legacy === 'planned')
      return { personRole, whyMatter, contactPlanned: true, contactContacted: false, contactMet: false };
    if (legacy === 'contacted')
      return { personRole, whyMatter, contactPlanned: false, contactContacted: true, contactMet: false };
    if (legacy === 'met')
      return { personRole, whyMatter, contactPlanned: false, contactContacted: false, contactMet: true };
    const hasNewBools =
      typeof r.contactPlanned === 'boolean' ||
      typeof r.contactContacted === 'boolean' ||
      typeof r.contactMet === 'boolean';
    if (hasNewBools) {
      return {
        personRole,
        whyMatter,
        contactPlanned: !!r.contactPlanned,
        contactContacted: !!r.contactContacted,
        contactMet: !!r.contactMet
      };
    }
    return { personRole, whyMatter, contactPlanned: true, contactContacted: false, contactMet: false };
  });
}

function parseStakeholderCategoryRows(body, base) {
  const pr = bodyFieldArray(body, `${base}_personRole`).map(trimStr);
  const wm = bodyFieldArray(body, `${base}_whyMatter`).map(trimStr);
  const planned = bodyFieldArray(body, `${base}_planned`).map((v) => trimStr(String(v)) === '1');
  const contacted = bodyFieldArray(body, `${base}_contacted`).map((v) => trimStr(String(v)) === '1');
  const met = bodyFieldArray(body, `${base}_met`).map((v) => trimStr(String(v)) === '1');
  const n = Math.max(pr.length, wm.length, planned.length, contacted.length, met.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = {
      personRole: pr[i] || '',
      whyMatter: wm[i] || '',
      contactPlanned: !!planned[i],
      contactContacted: !!contacted[i],
      contactMet: !!met[i]
    };
    if (r.personRole || r.whyMatter || r.contactPlanned || r.contactContacted || r.contactMet) rows.push(r);
  }
  return rows;
}

function stakeholderRowComplete(r) {
  const anyContact = !!(r.contactPlanned || r.contactContacted || r.contactMet);
  return !!(trimStr(r.personRole) && trimStr(r.whyMatter) && anyContact);
}

function stakeholderRowPartial(r) {
  const any = !!(
    trimStr(r.personRole) ||
    trimStr(r.whyMatter) ||
    r.contactPlanned ||
    r.contactContacted ||
    r.contactMet
  );
  return any && !stakeholderRowComplete(r);
}

const INTERACTION_LOG_SECTION_KEYS = ['siteVisit', 'expertMeeting', 'userInterview'];

function parseInteractionLogSectionRows(body, entryType, prefix) {
  const org = bodyFieldArray(body, `${prefix}_organization`).map(trimStr);
  const obj = bodyFieldArray(body, `${prefix}_objective`).map(trimStr);
  const dates = bodyFieldArray(body, `${prefix}_date`).map(trimStr);
  const take = bodyFieldArray(body, `${prefix}_takeaways`).map(trimStr);
  const n = Math.max(org.length, obj.length, dates.length, take.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      entryType,
      organization: org[i] || '',
      objective: obj[i] || '',
      interactionDate: dates[i] || '',
      takeaways: take[i] || ''
    });
  }
  return rows;
}

function parseInteractionLogBody(body) {
  const rows = [];
  for (const key of INTERACTION_LOG_SECTION_KEYS) {
    rows.push(...parseInteractionLogSectionRows(body, key, `sm_log_${key}`));
  }
  return rows;
}

function interactionRowMeaningful(r) {
  return !!(trimStr(r.organization) && trimStr(r.objective) && trimStr(r.takeaways));
}

/** Non-empty strings only (for repeatable text fields). */
function stringArrayForValidation(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map((x) => trimStr(x)).filter(Boolean);
}

/** Errors if Challenge & Intent is not fully complete (same rules as strict save). */
function validateChallengeIntentPayload(ci) {
  const o = ci || {};
  const challengeChosen = trimStr(o.challengeChosen);
  const industrySector = trimStr(o.industrySector);
  const whyMattersToday = stringArrayForValidation(o.whyMattersToday);
  const existingSolutions = stringArrayForValidation(o.existingSolutions);
  const whatsMissing = stringArrayForValidation(o.whatsMissing);
  const motivation = stringArrayForValidation(o.motivation);

  const errors = [];
  if (!challengeChosen) errors.push('Challenge chosen is required.');
  if (!industrySector) errors.push('Industry / sector is required.');
  if (!whyMattersToday.length) errors.push('Add at least one answer for why this challenge matters today.');
  if (!existingSolutions.length) errors.push('Add at least one answer for what solutions exist.');
  if (!whatsMissing.length) errors.push('Add at least one answer for what is missing in current solutions.');
  if (!motivation.length) errors.push('Add at least one answer for why you are motivated to work on this.');
  return errors;
}

function normTripletRowsForValidation(rows) {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map((r) => ({
    dataFound: r && r.dataFound != null ? trimStr(r.dataFound) : '',
    sourceLink: r && r.sourceLink != null ? trimStr(r.sourceLink) : '',
    whyMatters: r && r.whyMatters != null ? trimStr(r.whyMatters) : ''
  }));
}

/** Errors if Problem Research is not fully complete. */
function validateProblemResearchPayload(pr) {
  const p = pr || {};
  const scale = normTripletRowsForValidation(p.scale);
  const economic = normTripletRowsForValidation(p.economic);
  const operational = normTripletRowsForValidation(p.operational);
  const human = normTripletRowsForValidation(p.human);
  const environmental = normTripletRowsForValidation(p.environmental);
  const futureRisk = normTripletRowsForValidation(p.futureRisk);

  const projectedCostReduction = stringArrayForValidation(p.projectedCostReduction);
  const projectedTimeSavings = stringArrayForValidation(p.projectedTimeSavings);
  const projectedEfficiencyIncrease = stringArrayForValidation(p.projectedEfficiencyIncrease);
  const projectedSafetyImprovement = stringArrayForValidation(p.projectedSafetyImprovement);
  const projectedSustainabilityImprovement = stringArrayForValidation(p.projectedSustainabilityImprovement);
  const projectedOthers = stringArrayForValidation(p.projectedOthers);

  const reflection = trimStr(p.reflection);

  const errors = [];
  const catChecks = [
    ['Scale of problem', scale],
    ['Economic impact', economic],
    ['Operational impact', operational],
    ['Human impact', human],
    ['Future risk if unsolved', futureRisk]
  ];
  catChecks.forEach(([label, rows]) => {
    if (tripletCategoryPartial(rows)) {
      errors.push(
        `For "${label}", complete all three fields in each row you started, or clear incomplete rows.`
      );
    } else if (!tripletCategoryComplete(rows)) {
      errors.push(
        `For "${label}", add at least one row with Data found, Source link, and Why this matters all filled in.`
      );
    }
  });
  if (tripletCategoryPartial(environmental)) {
    errors.push(
      'For "Environmental impact (if applicable)", complete all three fields in each row you started, or clear incomplete rows.'
    );
  }
  if (!projectedCostReduction.length) errors.push('Add at least one cost reduction projection.');
  if (!projectedTimeSavings.length) errors.push('Add at least one time savings projection.');
  if (!projectedEfficiencyIncrease.length) errors.push('Add at least one efficiency increase projection.');
  if (!projectedSafetyImprovement.length) errors.push('Add at least one safety improvement projection.');
  if (!projectedSustainabilityImprovement.length) {
    errors.push('Add at least one sustainability improvement projection.');
  }
  if (!projectedOthers.length) errors.push('Add at least one entry under Others (projected impact).');
  if (!reflection) errors.push('Reflection is required.');
  return errors;
}

/** Errors if Stakeholder Mapping is not fully complete. */
function validateStakeholderMappingPayload(sm) {
  const s = sm || {};
  const directUser = Array.isArray(s.directUser) ? s.directUser : [];
  const indirectUser = Array.isArray(s.indirectUser) ? s.indirectUser : [];
  const decisionMaker = Array.isArray(s.decisionMaker) ? s.decisionMaker : [];
  const domainExpert = Array.isArray(s.domainExpert) ? s.domainExpert : [];
  const regulator = Array.isArray(s.regulator) ? s.regulator : [];
  const solutionProvider = Array.isArray(s.solutionProvider) ? s.solutionProvider : [];
  const interactionLog = Array.isArray(s.interactionLog) ? s.interactionLog : [];

  const errors = [];
  const mandatoryChecks = [
    ['Direct User (Mandatory)', directUser],
    ['Indirect User', indirectUser],
    ['Decision Maker', decisionMaker],
    ['Domain Expert', domainExpert],
    ['Existing Solution Provider', solutionProvider]
  ];
  mandatoryChecks.forEach(([label, rows]) => {
    if (rows.some(stakeholderRowPartial)) {
      errors.push(
        `For "${label}", complete Specific person/role, Why they matter, and at least one Contact status option for each row you started.`
      );
    } else if (!rows.some(stakeholderRowComplete)) {
      errors.push(`For "${label}", add at least one complete row.`);
    }
  });

  if (regulator.some(stakeholderRowPartial)) {
    errors.push(
      'For "Regulator (if relevant)", complete all fields in each row you started, or clear incomplete rows.'
    );
  } else if (regulator.length > 0 && !regulator.some(stakeholderRowComplete)) {
    errors.push('For "Regulator (if relevant)", add a complete row or leave the section blank.');
  }

  const meaningfulLog = interactionLog.filter(interactionRowMeaningful);
  if (meaningfulLog.length < 5) {
    errors.push(
      'Interaction log: add at least 5 complete entries (Organization/Person, Objective, and Key takeaways filled).'
    );
  }
  return errors;
}

function problemDiscoveryStepIsComplete(problem, step) {
  if (step === 'challenge') {
    return validateChallengeIntentPayload(problem.problemDiscoveryChallengeIntent).length === 0;
  }
  if (step === 'research') {
    return validateProblemResearchPayload(problem.problemDiscoveryProblemResearch).length === 0;
  }
  if (step === 'stakeholders') {
    return validateStakeholderMappingPayload(problem.problemDiscoveryStakeholderMapping).length === 0;
  }
  return false;
}

function splitInteractionLogForForm(log) {
  const allowed = new Set(INTERACTION_LOG_SECTION_KEYS);
  const buckets = {
    siteVisit: [],
    expertMeeting: [],
    userInterview: []
  };
  (log || []).forEach((r) => {
    let t = r && r.entryType ? String(r.entryType) : 'siteVisit';
    if (!allowed.has(t)) t = 'siteVisit';
    buckets[t].push({
      organization: r && r.organization != null ? String(r.organization) : '',
      objective: r && r.objective != null ? String(r.objective) : '',
      interactionDate: r && r.interactionDate != null ? String(r.interactionDate) : '',
      takeaways: r && r.takeaways != null ? String(r.takeaways) : ''
    });
  });
  for (const key of INTERACTION_LOG_SECTION_KEYS) {
    if (buckets[key].length === 0) {
      buckets[key].push({
        organization: '',
        objective: '',
        interactionDate: '',
        takeaways: ''
      });
    }
  }
  return buckets;
}

router
  .route('/process/:problemId/problem-discovery/stakeholder-mapping')
  .get(isLoggedIn, loadProblemForUser, (req, res) => {
    const sm = req.problem.problemDiscoveryStakeholderMapping || {};
    const stakeholderCategories = [
      {
        base: 'sm_directUser',
        label: 'Direct User (Mandatory)',
        optional: false,
        rows: normStakeholderRows(sm.directUser),
        phPerson: 'e.g., Warehouse Operator',
        phWhy: 'e.g., Touches the problem daily'
      },
      {
        base: 'sm_indirectUser',
        label: 'Indirect User',
        optional: false,
        rows: normStakeholderRows(sm.indirectUser),
        phPerson: 'e.g., Procurement Analyst',
        phWhy: 'e.g., Influences buying decisions'
      },
      {
        base: 'sm_decisionMaker',
        label: 'Decision Maker',
        optional: false,
        rows: normStakeholderRows(sm.decisionMaker),
        phPerson: 'e.g., VP Operations',
        phWhy: 'e.g., Owns budget sign-off'
      },
      {
        base: 'sm_domainExpert',
        label: 'Domain Expert',
        optional: false,
        rows: normStakeholderRows(sm.domainExpert),
        phPerson: 'e.g., Safety Engineer',
        phWhy: 'e.g., Validates technical feasibility'
      },
      {
        base: 'sm_regulator',
        label: 'Regulator (if relevant)',
        optional: true,
        rows: normStakeholderRows(sm.regulator),
        phPerson: 'e.g., Local environmental officer',
        phWhy: 'e.g., Compliance requirements'
      },
      {
        base: 'sm_solutionProvider',
        label: 'Existing Solution Provider',
        optional: false,
        rows: normStakeholderRows(sm.solutionProvider),
        phPerson: 'e.g., Incumbent vendor lead',
        phWhy: 'e.g., Current contract holder'
      }
    ];
    const interactionLogByType = splitInteractionLogForForm(sm.interactionLog);
    const interactionLogSections = [
      { key: 'siteVisit', num: 1, title: 'Site Visit' },
      { key: 'expertMeeting', num: 2, title: 'Expert Meeting' },
      { key: 'userInterview', num: 3, title: 'User Interview' }
    ];
    res.render('process/stakeholderMapping', {
      currentUser: req.user,
      problem: req.problem,
      problemId: req.problem._id,
      stakeholderCategories,
      interactionLogByType,
      interactionLogSections,
      challengeSubmitted: !!req.problem.problemDiscoveryChallengeIntentSubmitted,
      researchSubmitted: !!req.problem.problemDiscoveryProblemResearchSubmitted,
      stakeholdersSubmitted: !!req.problem.problemDiscoveryStakeholderMappingSubmitted,
      title: 'Stakeholder Mapping – Erehwon'
    });
  })
  .post(isLoggedIn, loadProblemForUser, async (req, res) => {
    try {
      const directUser = parseStakeholderCategoryRows(req.body, 'sm_directUser');
      const indirectUser = parseStakeholderCategoryRows(req.body, 'sm_indirectUser');
      const decisionMaker = parseStakeholderCategoryRows(req.body, 'sm_decisionMaker');
      const domainExpert = parseStakeholderCategoryRows(req.body, 'sm_domainExpert');
      const regulator = parseStakeholderCategoryRows(req.body, 'sm_regulator');
      const solutionProvider = parseStakeholderCategoryRows(req.body, 'sm_solutionProvider');
      const interactionLog = parseInteractionLogBody(req.body);

      const smPayload = {
        directUser,
        indirectUser,
        decisionMaker,
        domainExpert,
        regulator,
        solutionProvider,
        interactionLog
      };
      const errors = validateStakeholderMappingPayload(smPayload);
      const allTextboxesFilled = stakeholderMappingTextboxesAllFilled(req.body);

      if (isProblemDiscoveryAjax(req)) {
        req.problem.problemDiscoveryStakeholderMapping = smPayload;
        req.problem.problemDiscoveryStakeholderMappingSubmitted =
          errors.length === 0 && allTextboxesFilled;
        await req.problem.save();
        return res.json(problemDiscoverySaveJson(req.problem));
      }

      if (errors.length) {
        req.flash('error', errors.join(' '));
        return res.redirect(`/process/${req.problem._id}/problem-discovery/stakeholder-mapping`);
      }

      req.problem.problemDiscoveryStakeholderMapping = smPayload;
      req.problem.problemDiscoveryStakeholderMappingSubmitted = allTextboxesFilled;
      await req.problem.save();
      req.flash('success', 'Stakeholder Mapping saved.');
      return res.redirect(`/process/${req.problem._id}/problem-discovery`);
    } catch (err) {
      console.error('stakeholder-mapping save:', err);
      if (isProblemDiscoveryAjax(req)) {
        return res.status(500).json({ ok: false, error: 'Could not save. Please try again.' });
      }
      req.flash('error', 'Could not save. Please try again.');
      return res.redirect(`/process/${req.problem._id}/problem-discovery/stakeholder-mapping`);
    }
  });

router.get('/process/:problemId/:stage', isLoggedIn, loadProblemForUser, (req, res) => {
  const { problemId, stage } = req.params;

  // Excite & Enrol uses the Mission Launch page at /excite-and-enrol
  if (stage === 'excite-enrol') {
    return res.redirect(`/excite-and-enrol?campgroundId=${problemId}`);
  }

  const stageConfig = STAGE_CONFIG[stage];
  if (!stageConfig) {
    req.flash('error', 'Invalid process stage.');
    return res.redirect(`/problems/${problemId}`);
  }

  if (stage === 'problem-discovery') {
    return res.render('process/problemDiscoveryHub', {
      currentUser: req.user,
      problem: req.problem,
      campground: req.problem,
      campgroundId: req.problem._id,
      bodyClass: 'mission-launch-body',
      title: 'Phase 2: Problem Discovery – Erehwon'
    });
  }

  if (stage === 'analysis') {
    return res.render('process/analysisHub', {
      currentUser: req.user,
      problem: req.problem,
      campground: req.problem,
      campgroundId: req.problem._id,
      bodyClass: 'mission-launch-body',
      title: 'Phase 3: Analysis – Erehwon'
    });
  }

  if (stage === 'ideation') {
    return res.render('process/ideationHub', {
      currentUser: req.user,
      problem: req.problem,
      campground: req.problem,
      campgroundId: req.problem._id,
      bodyClass: 'mission-launch-body',
      title: 'Phase 4: Ideation – Erehwon'
    });
  }

  if (stage === 'converge-ideas') {
    return res.render('process/convergeHub', {
      currentUser: req.user,
      problem: req.problem,
      campground: req.problem,
      campgroundId: req.problem._id,
      bodyClass: 'mission-launch-body',
      title: 'Phase 5: Converge – Erehwon'
    });
  }

  if (stage === 'conceptual-solution') {
    return res.render('process/solutionHub', {
      currentUser: req.user,
      problem: req.problem,
      campground: req.problem,
      campgroundId: req.problem._id,
      bodyClass: 'mission-launch-body',
      title: 'Phase 6: Solution – Erehwon'
    });
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
