/**
 * Determine the current stage and progress of a problem statement
 * Each stage is worth 20% (5 stages × 20% = 100%)
 * 
 * Success Criteria:
 * 1. Excite & Enrol (20%): teamInfo exists with schoolName
 * 2. Problem Discovery (20%): selectedPredefinedProblem exists OR customProblem exists
 * 3. Ideation (20%): 10+ ideas saved
 * 4. Conceptual Solution (20%): solution exists
 * 5. Prototyping (20%): prototype exists AND has files
 */
function getProblemStage(campground, ideaCount = 0) {
  if (!campground) {
    return { 
      stage: 1, 
      name: 'Excite & Enrol', 
      progress: 0,
      stageProgress: {
        1: 0, // Excite & Enrol
        2: 0, // Problem Discovery
        3: 0, // Ideation
        4: 0, // Conceptual Solution
        5: 0  // Prototyping
      }
    };
  }
  
  let totalProgress = 0;
  const stageProgress = {
    1: 0, // Excite & Enrol
    2: 0, // Problem Discovery
    3: 0, // Ideation
    4: 0, // Conceptual Solution
    5: 0  // Prototyping
  };
  
  // Stage 1: Excite & Enrol (20%)
  // Success criteria: school on teamInfo or Mission Launch Groundwork
  const gwSchool = campground.missionLaunchGroundworkInfo && campground.missionLaunchGroundworkInfo.schoolName;
  if ((campground.teamInfo && campground.teamInfo.schoolName) || gwSchool) {
    stageProgress[1] = 20;
    totalProgress += 20;
  }
  
  // Stage 2: Problem Discovery (20%)
  // Success criteria: Either selectedPredefinedProblem exists OR customProblem exists
  if (campground.problemStatementInfo && 
      (campground.problemStatementInfo.selectedPredefinedProblem || 
       (campground.problemStatementInfo.problemType === 'custom' && campground.problemStatementInfo.customProblem))) {
    stageProgress[2] = 20;
    totalProgress += 20;
  }
  
  // Stage 3: Ideation (20%)
  // Success criteria: 10+ ideas saved
  if (ideaCount >= 10) {
    stageProgress[3] = 20;
    totalProgress += 20;
  }
  
  // Stage 4: Conceptual Solution (20%)
  // Success criteria: solution exists
  if (campground.solution) {
    stageProgress[4] = 20;
    totalProgress += 20;
  }
  
  // Stage 5: Prototyping (20%)
  // Success criteria: prototype exists AND has at least one file
  if (campground.prototype) {
    // Check if prototype is populated (object) or just an ID
    const prototype = campground.prototype;
    if (prototype && typeof prototype === 'object' && prototype._id) {
      // Prototype is populated - check if it has files
      // Try to access files - might be on the document or need toObject()
      let files = prototype.files;
      if (!files && prototype.toObject) {
        const protoObj = prototype.toObject();
        files = protoObj.files;
      }
      
      if (files && Array.isArray(files) && files.length > 0) {
        // Prototype has files - complete
        stageProgress[5] = 20;
        totalProgress += 20;
      } else {
        // Prototype exists but has no files yet
        stageProgress[5] = 0;
      }
    } else {
      // Prototype exists but not populated - can't check files, assume incomplete
      // Caller should populate prototype before calling this function
      stageProgress[5] = 0;
    }
  }
  
  // Determine current stage (first incomplete stage)
  let currentStage = 1;
  if (stageProgress[1] === 20) currentStage = 2;
  if (stageProgress[2] === 20) currentStage = 3;
  if (stageProgress[3] === 20) currentStage = 4;
  if (stageProgress[4] === 20) currentStage = 5;
  if (stageProgress[5] === 20) currentStage = 5; // All complete
  
  const stageNames = {
    1: 'Excite & Enrol',
    2: 'Problem Discovery',
    3: 'Ideation',
    4: 'Conceptual Solution',
    5: 'Prototyping'
  };
  
  return {
    stage: currentStage,
    name: stageNames[currentStage],
    progress: totalProgress,
    stageProgress: stageProgress
  };
}

module.exports = { getProblemStage };

