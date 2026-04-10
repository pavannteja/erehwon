const fs = require("fs");
const path = require("path");

if (process.env.NODE_ENV !== "production") {
  const customEnvPath = path.join(__dirname, "Problem_Discovery.env");
  const defaultEnvPath = path.join(__dirname, ".env");
  require("dotenv").config({
    path: fs.existsSync(customEnvPath) ? customEnvPath : defaultEnvPath
  });
}

console.log('Environment Variables:', {
  NODE_ENV: process.env.NODE_ENV,
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'Set' : 'Not set',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? 'Set' : 'Not set'
});

const express = require("express");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const morgan = require("morgan");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MongoStore = require('connect-mongo').default;
const multer = require('multer');

const ExpressError = require("./utils/ExpressError");
const User = require("./models/user");
const Campground = require("./models/campgrounds");
const CorporateProblem = require("./models/corporateProblem");
const { Program } = require("./models/schemas");
const { getProblemStage } = require("./utils/stageHelper");

const userRoutes = require("./routes/users");
const problemsRoutes = require("./routes/campgrounds");
const reviewRoutes = require("./routes/reviews");
const ideationRoutes = require("./routes/ideation");
const problemStatementRoutes = require("./routes/problemStatement");
const adminRoutes = require("./routes/admin");
const programAdministratorRoutes = require("./routes/programAdministrator");
const prototypingRoutes = require("./routes/prototyping");
const corporateProblemsRoutes = require("./routes/corporateProblems");
const processRoutes = require("./routes/process");

const dbUrl = process.env.DB_URL || "mongodb://127.0.0.1:27017/yelp-camp";

mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error"));
db.once("open", () => {
  console.log("Database connected");
});

const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(morgan("dev"));

// Favicon route - MUST come before static file serving
app.get("/favicon.ico", (req, res) => {
  res.type("image/webp");
  res.sendFile(path.join(__dirname, "public/images/logo-tranparent.webp"));
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const store = new MongoStore({
  mongoUrl: dbUrl,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret: process.env.SESSION_SECRET || "thisshouldbeabettersecret!",
  },
});

store.on("error", function (e) {
  console.log("Session store error", e);
});

const sessionConfig = {
  store,
  name: "session",
  secret: process.env.SESSION_SECRET || "thisshouldbeabettersecret!",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Construct absolute callback URL
  // Use GOOGLE_CALLBACK_URL if set, otherwise construct from BASE_URL
  // If BASE_URL is not set, try to detect from request (for production)
  let baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  // Force HTTPS for production if BASE_URL contains the domain
  if (baseUrl.includes('erehwonorbitshift.org') && !baseUrl.startsWith('https://')) {
    baseUrl = baseUrl.replace('http://', 'https://');
  }
  
  const absoluteCallback = process.env.GOOGLE_CALLBACK_URL || (baseUrl + '/auth/google/callback');
  console.log('🔐 Google OAuth Callback URL:', absoluteCallback);
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: absoluteCallback
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (user) return done(null, user);
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }
      const newUser = new User({
        username: profile.displayName || profile.emails[0].value.split('@')[0],
        email: profile.emails[0].value,
        googleId: profile.id,
        isEmailVerified: true
      });
      await newUser.save();
      done(null, newUser);
    } catch (error) {
      done(error, null);
    }
  }));
}

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Cloudinary configuration is now handled in cloudinary/index.js
// Import the configured storage from there
const { storage } = require('./cloudinary');
const upload = multer({ storage });

app.use(async (req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success") || [];
  res.locals.error = req.flash("error") || [];
  res.locals.problemStatementRemovedToast = !!(req.session && req.session.problemStatementRemovedToast);
  res.locals.customProjectSavedToast = req.session && req.session.customProjectSavedToast ? String(req.session.customProjectSavedToast) : '';
  if (req.session) {
    delete req.session.problemStatementRemovedToast;
    delete req.session.customProjectSavedToast;
  }
  res.locals.currentPath = req.path;

  // SEO and meta data
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  res.locals.baseURL = baseUrl;
  res.locals.originalUrl = req.originalUrl;
  res.locals.canonicalUrl = baseUrl + req.originalUrl;
  
  // Check if user has completed Excite & Enrol (has at least one project with teamInfo.schoolName)
  if (req.user && !req.user.isAdmin) {
    try {
      const hasProject = await Campground.findOne({
        author: req.user._id,
        $or: [
          { 'teamInfo.schoolName': { $exists: true, $nin: [null, ''] } },
          { 'missionLaunchGroundworkInfo.schoolName': { $exists: true, $nin: [null, ''] } }
        ]
      });
      res.locals.hasCompletedExciteEnrol = !!hasProject;
    } catch (error) {
      console.error('Error checking Excite & Enrol completion:', error);
      res.locals.hasCompletedExciteEnrol = false;
    }
  } else {
    res.locals.hasCompletedExciteEnrol = false;
  }
  
  next();
});

app.use("/", userRoutes);
app.use("/problems", problemsRoutes);
app.use("/problems/:id/reviews", reviewRoutes);
app.use("/", ideationRoutes);
app.use("/", problemStatementRoutes);
app.use("/", adminRoutes);
app.use("/", programAdministratorRoutes);
app.use("/", prototypingRoutes);
app.use("/corporate-problems", corporateProblemsRoutes);
app.use("/", processRoutes);

// Home route - displays user's problem statements
app.get("/", async (req, res) => {
  let campgrounds = [];
  let programs = [];
  let corporateProblemsHome = [];
  
  if (req.user) {
    try {
      // If user is admin, fetch programs
      if (req.user.isAdmin) {
        programs = await Program.find().sort({ name: 1 });
      }
      
      // Same query as dashboard - populate prototype to check for files
      campgrounds = await Campground.find({ author: req.user._id })
        .populate('author')
        .populate('reviews')
        .populate('teamInfo.enrolledProgram')
        .populate('problemStatementInfo.selectedPredefinedProblem')
        .populate('solution')
        .populate('prototype')
        .lean() // Use lean to get plain objects with all fields
        .sort({ createdAt: -1 });
      
      // Count ideas for each campground and add stage information
      const { Idea } = require('./models/schemas');
      campgrounds = await Promise.all(campgrounds.map(async (campground) => {
        // Count ideas for ideation progress
        let ideaCount = 0;
        try {
          ideaCount = await Idea.countDocuments({ problemId: campground._id });
        } catch (err) {
          ideaCount = 0;
        }
        
        // Get stage info with ideaCount and populated prototype
        // Ensure prototype is properly populated with files
        let campForStage = campground;
        if (campground.prototype) {
          if (typeof campground.prototype === 'object' && campground.prototype._id) {
            // Prototype is populated, check if it has files
            // With .lean(), files should be accessible directly
            if (!campground.prototype.files || !Array.isArray(campground.prototype.files) || campground.prototype.files.length === 0) {
              // Files not populated or empty, fetch prototype separately
              const { Prototype } = require('./models/schemas');
              const proto = await Prototype.findById(campground.prototype._id);
              if (proto) {
                campForStage = { ...campground };
                campForStage.prototype = proto.toObject ? proto.toObject() : proto;
              }
            }
          } else {
            // Prototype is just an ID, we need to fetch it
            const { Prototype } = require('./models/schemas');
            const proto = await Prototype.findById(campground.prototype);
            if (proto) {
              campForStage = { ...campground };
              campForStage.prototype = proto.toObject ? proto.toObject() : proto;
            }
          }
        }
        const stageInfo = getProblemStage(campForStage, ideaCount);
        const campObj = { ...campground }; // Create a copy to avoid mutating the original
        campObj.currentStage = stageInfo.name;
        campObj.stageNumber = stageInfo.stage;
        campObj.progress = stageInfo.progress;
        campObj.stageProgress = stageInfo.stageProgress; // Add stageProgress for incomplete steps display
        return campObj;
      }));

    } catch (error) {
      console.error('Error fetching data for home:', error);
      campgrounds = [];
      programs = [];
    }
  }

  try {
    // Pull live data from corporate problems page source for home preview
    // Visible for both logged-in and logged-out users.
    corporateProblemsHome = await CorporateProblem.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .lean();
  } catch (error) {
    console.error('Error fetching corporate problems preview for home:', error);
    corporateProblemsHome = [];
  }
  
  const seoData = {
    title: "Erehwon - Innovation Process Made Collaborative",
    description: "Start your innovation Journey. Guide your team through the complete innovation process. Discover problems, define solutions, ideate concepts, prototype ideas, and test with structured workflows.",
    ogImage: (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`) + "/images/logo-tranparent.webp"
  };
  
  res.render("home", { campgrounds, programs, corporateProblemsHome, ...seoData });
});

// Robots.txt route
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nAllow: /\n\nSitemap: " + (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`) + "/sitemap.xml");
});

// Sitemap route (basic implementation)
app.get("/sitemap.xml", (req, res) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/login</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/register</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
  res.type("application/xml");
  res.send(sitemap);
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page not found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message } = err;
  if (!err.message) err.message = "Ohh no! something went wrong";
  res.status(statusCode).render("error", { err });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Serving on port ${port}`);
});
