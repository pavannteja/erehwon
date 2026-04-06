const Campground = require('../models/campgrounds');
const { projectBrandLogo } = require('../utils/projectBrandLogo');
const { cloudinary } = require("../cloudinary");
const multer = require('multer');
const maptilerClient = require("@maptiler/client");
const { Program, School } = require('../models/schemas');
maptilerClient.config.apiKey = process.env.MAPTILER_API_KEY;

module.exports.index = async (req, res) => {
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds }); // template path unchanged, route base renamed
  }

module.exports.renderNewForm = (req, res) => {
    res.render('campgrounds/new');
  }

  module.exports.createCampground = async(req, res, next) => {
     const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
     const campground = new Campground(req.body.campground);
     campground.geometry = geoData.features[0].geometry;

    //const campground = new Campground (req.body.campground);
    campground.images = req.files.map( f => ({url: f.path,filename: f.filename}))
    campground.author = req.user._id;
    await campground.save(); // Whenever we want to send a form request, we encode the data into the url and send a post request with the new tag attached to the database and await and save it
    console.log(campground);
    req.flash('success', 'Problem created');
    res.redirect(`/problems/${campground._id}`);
  }

  module.exports.showCampground = async (req, res) => {
    const campground = await Campground.findById(req.params.id).populate({
      path:'reviews',
      populate: {
        path: 'author'
      }
    }).populate('author')
    .populate('solution')
    .populate('prototype')
    .populate({ path: 'adoptedFromCorporateProblem', select: 'companyName title' })
    .select('+notes'); // Explicitly include notes field
    
    if(!campground){
        req.flash('error', 'Problem not found');
        return res.redirect('/dashboard')
    }

    // Count ideas for ideation phase completion check
    const Idea = require('../models/schemas').Idea;
    let ideaCount = 0;
    try {
      ideaCount = await Idea.countDocuments({ problemId: campground._id });
    } catch (err) {
      console.error('Error counting ideas:', err);
    }

    // Check if prototype has files
    let prototypeHasFiles = false;
    if (campground.prototype) {
      try {
        const { Prototype } = require('../models/schemas');
        const prototype = await Prototype.findById(campground.prototype);
        if (prototype && prototype.files && prototype.files.length > 0) {
          prototypeHasFiles = true;
        }
      } catch (err) {
        console.error('Error checking prototype files:', err);
      }
    }

    // Create a simplified version of the campground for the map
    const mapData = {
        _id: campground._id,
        title: campground.title,
        location: campground.location,
        geometry: {
            type: 'Point',
            coordinates: campground.geometry.coordinates
        }
    };

    // Refresh campground to ensure notes are loaded
    const refreshedCampground = await Campground.findById(req.params.id);
    if (refreshedCampground && refreshedCampground.notes) {
      campground.notes = refreshedCampground.notes;
    }
    
    res.render('campgrounds/show', {
      campground,
      brandMark: projectBrandLogo(campground),
      mapData,
      ideaCount,
      prototypeHasFiles,
      bodyClass: 'mission-launch-body',
      title: `${campground.title} | Project overview`
    });
  }

  module.exports.renderEditForm = async(req, res) => {
    const SDG_GOALS = [
      { number: 1, title: 'No Poverty', description: 'End poverty in all its forms everywhere' },
      { number: 2, title: 'Zero Hunger', description: 'End hunger, achieve food security and improved nutrition' },
      { number: 3, title: 'Good Health and Well-being', description: 'Ensure healthy lives and promote well-being for all' },
      { number: 4, title: 'Quality Education', description: 'Ensure inclusive and equitable quality education' },
      { number: 5, title: 'Gender Equality', description: 'Achieve gender equality and empower all women and girls' },
      { number: 6, title: 'Clean Water and Sanitation', description: 'Ensure availability and sustainable management of water' },
      { number: 7, title: 'Affordable and Clean Energy', description: 'Ensure access to affordable, reliable, sustainable energy' },
      { number: 8, title: 'Decent Work and Economic Growth', description: 'Promote sustained, inclusive economic growth' },
      { number: 9, title: 'Industry, Innovation and Infrastructure', description: 'Build resilient infrastructure, promote innovation' },
      { number: 10, title: 'Reduced Inequalities', description: 'Reduce inequality within and among countries' },
      { number: 11, title: 'Sustainable Cities and Communities', description: 'Make cities and human settlements inclusive, safe, resilient' },
      { number: 12, title: 'Responsible Consumption and Production', description: 'Ensure sustainable consumption and production patterns' },
      { number: 13, title: 'Climate Action', description: 'Take urgent action to combat climate change and its impacts' },
      { number: 14, title: 'Life Below Water', description: 'Conserve and sustainably use the oceans, seas and marine resources' },
      { number: 15, title: 'Life on Land', description: 'Protect, restore and promote sustainable use of terrestrial ecosystems' },
      { number: 16, title: 'Peace, Justice and Strong Institutions', description: 'Promote peaceful and inclusive societies' },
      { number: 17, title: 'Partnerships for the Goals', description: 'Strengthen the means of implementation and revitalize partnerships' },
      { number: 18, title: 'Women and Welfare', description: 'Promote women\'s welfare and empowerment' }
    ];

    const campground = await Campground.findById(req.params.id).populate('teamInfo.enrolledProgram');
    if(!campground){
      req.flash('error', 'Cannot find that problem statement');
      return res.redirect('/dashboard')
    }
    
    const programs = await Program.find({ isActive: true }).sort({ name: 1 });
    const schools = await School.find({ isActive: true }).sort({ name: 1 });
    
    res.render('campgrounds/edit', { 
      campground,
      programs,
      schools,
      sdgGoals: SDG_GOALS
    });
  }

//   module.exports.updateCampground = async(req, res) => {
//     const campground = await Campground.findById(req.params.id)
//     res.render('campgrounds/edit', { campground });
//   }

  module.exports.updateCampground = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    
    if (!campground) {
      req.flash('error', 'Problem statement not found');
      return res.redirect('/dashboard');
    }

    // Update basic campground fields
    campground.title = req.body.campground.title;
    campground.description = req.body.campground.description;
    campground.location = req.body.campground.location;

    // Update team info if provided
    if (req.body.teamInfo) {
      if (!campground.teamInfo) {
        campground.teamInfo = {};
      }
      campground.teamInfo.schoolName = req.body.teamInfo.schoolName;
      campground.teamInfo.className = req.body.teamInfo.className;
      campground.teamInfo.groupMembers = req.body.teamInfo.groupMembers;
      campground.teamInfo.groupName = req.body.teamInfo.groupName;
      campground.teamInfo.enrolledProgram = req.body.teamInfo.enrolledProgram;
      if (req.body.teamInfo.sdgGoal) {
        campground.teamInfo.sdgGoal = req.body.teamInfo.sdgGoal;
      }
      if (req.body.teamInfo.problemDiscoveryMethod) {
        campground.teamInfo.problemDiscoveryMethod = req.body.teamInfo.problemDiscoveryMethod;
      }
      if (req.body.teamInfo.communityChallenges) {
        campground.teamInfo.communityChallenges = req.body.teamInfo.communityChallenges;
      }
      if (req.body.teamInfo.fiveYearProblem) {
        campground.teamInfo.fiveYearProblem = req.body.teamInfo.fiveYearProblem;
      }
      if (req.body.teamInfo.technologyApplicationReason) {
        campground.teamInfo.technologyApplicationReason = req.body.teamInfo.technologyApplicationReason;
      }
      if (req.body.teamInfo.highImpactMissionWhy !== undefined) {
        campground.teamInfo.highImpactMissionWhy = req.body.teamInfo.highImpactMissionWhy;
      }
      if (req.body.teamInfo.missionEndKnownFor !== undefined) {
        campground.teamInfo.missionEndKnownFor = req.body.teamInfo.missionEndKnownFor;
      }
    }

    // Update geometry based on location
    try {
      const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
      if (geoData.features && geoData.features.length > 0) {
        campground.geometry = geoData.features[0].geometry;
      }
    } catch (error) {
      console.error('Error geocoding location:', error);
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      const imgs = req.files.map(f => {
        // Check if Cloudinary (has secure_url or path is URL) or disk storage
        let url;
        if (f.secure_url || f.url || (f.path && f.path.startsWith('http'))) {
          url = f.secure_url || f.url || f.path;
        } else {
          // Disk storage - create URL path
          const path = require('path');
          const filename = path.basename(f.path);
          url = `/uploads/${filename}`;
        }
        return { url: url, filename: f.filename || f.originalname };
      });
      campground.images.push(...imgs);
    }

    // Handle image deletion
    if (req.body.deleteImages) {
      for(let filename of req.body.deleteImages){
        await cloudinary.uploader.destroy(filename);
      }
      await campground.updateOne({ $pull: {images: {filename: { $in: req.body.deleteImages } } } } );
    }

    await campground.save();
    req.flash('success', 'Problem statement updated successfully');
    res.redirect(`/problems/${campground._id}`);
  }

  module.exports.deleteCampground = async(req, res) =>{
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Problem deleted');
    res.redirect('/dashboard');
  }