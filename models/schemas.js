const mongoose = require('mongoose');

const ideaSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campground', required: true }
});

const frameSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campground', required: true }
});

const problemStatementSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campground' }
});

const connectionSchema = new mongoose.Schema({
  sourceId: { type: String, required: true },
  targetId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campground', required: true }
});

const solutionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  detail: { type: String, default: '' }, // Optional - will be filled by AI
  shouldDo: { type: String, required: true },
  shouldNotDo: { type: String, required: true },
  keyFeatures: [{
    feature: { type: String, required: true },
    format: { type: String, required: true },
    usage: { type: String, required: true }
  }],
  implementationSteps: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true }
});

const prototypeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  files: [{
    url: { type: String, required: true },
    filename: { type: String, required: true },
    fileType: { type: String }, // image, video, document, etc.
    uploadedAt: { type: Date, default: Date.now }
  }],
  additionalLinks: [{ type: String }],
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campground', required: true }
});

// Schema for multi-page problem statement form data
const problemFormDataSchema = new mongoose.Schema({
  // Page 1 Data
  schoolName: { type: String, required: true },
  className: { type: String, required: true },
  groupMembers: { type: String, required: true },
  groupName: { type: String, required: true },
  enrolledProgram: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  sdgGoal: { type: String, required: true },
  innovationProcessSteps: { type: String, required: true },
  problemDiscoveryMethod: { type: String, required: true },
  communityChallenges: { type: String, required: true },
  fiveYearProblem: { type: String, required: true },
  technologyApplicationReason: { type: String, required: true },
  
  // Page 2 Data (if predefined problem selected)
  selectedPredefinedProblem: { type: String, default: '' },
  recommendedStakeholders: [{ type: String }],
  
  // Page 3 Data (if custom problem)
  customProblem: {
    whoHasProblem: { type: String, default: '' },
    whatIsProblem: { type: String, default: '' },
    expectedBenefit: { type: String, default: '' }
  },
  
  // Problem type: 'predefined' or 'custom'
  problemType: { type: String, enum: ['predefined', 'custom'], default: 'custom' },
  
  // Reference to the created problem/campground
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campground' },
  
  createdAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true }
});

// Schema for SDG Goals
const sdgGoalSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Schema for Predefined Problem Statements
const predefinedProblemSchema = new mongoose.Schema({
  sdgGoal: { type: String, required: true },
  problemStatement: { type: String, required: true },
  recommendedStakeholders: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

// Schema for Programs (ABPS Group, Erehwon Championship, Erehwon lab school, etc.)
const programSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Schema for Schools
const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Schema for School-Program relationship (junction table)
// Tracks which schools are enrolled in which programs and number of students
const schoolProgramSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  numberOfStudents: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  enrolledAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create unique index to prevent duplicate school-program combinations
schoolProgramSchema.index({ school: 1, program: 1 }, { unique: true });

const Idea = mongoose.model('Idea', ideaSchema);
const Frame = mongoose.model('Frame', frameSchema);
const ProblemStatement = mongoose.model('ProblemStatement', problemStatementSchema);
const Connection = mongoose.model('Connection', connectionSchema);
const Solution = mongoose.model('Solution', solutionSchema);
const Prototype = mongoose.model('Prototype', prototypeSchema);
const ProblemFormData = mongoose.model('ProblemFormData', problemFormDataSchema);
const SDGGoal = mongoose.model('SDGGoal', sdgGoalSchema);
const PredefinedProblem = mongoose.model('PredefinedProblem', predefinedProblemSchema);
const Program = mongoose.model('Program', programSchema);
const School = mongoose.model('School', schoolSchema);
const SchoolProgram = mongoose.model('SchoolProgram', schoolProgramSchema);

module.exports = { 
  Idea, Frame, ProblemStatement, Connection, Solution, Prototype,
  ProblemFormData, SDGGoal, PredefinedProblem,
  Program, School, SchoolProgram
};