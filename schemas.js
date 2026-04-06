

    const BaseJoi = require('joi');
    const sanitizeHtml = require('sanitize-html');
    
    const extension = (joi) => ({
        type: 'string',
        base: joi.string(),
        messages: {
            'string.escapeHTML': '{{#label}} must not include HTML!'
        },
        rules: {
            escapeHTML: {
                validate(value, helpers) {
                    const clean = sanitizeHtml(value, {
                        allowedTags: [],
                        allowedAttributes: {},
                    });
                    if (clean !== value) return helpers.error('string.escapeHTML', { value })
                    return clean;
                }
            }
        }
    });
    
    const Joi = BaseJoi.extend(extension)
    
    module.exports.campgroundSchema = Joi.object({
        campground: Joi.object({
            title: Joi.string().optional().allow('').escapeHTML(),
            location: Joi.string().optional().allow('').escapeHTML(),
            description: Joi.string().optional().allow('').escapeHTML()
        }).optional(),
        teamInfo: Joi.object({
            schoolName: Joi.string().optional().allow(''),
            className: Joi.string().optional().allow(''),
            groupMembers: Joi.string().optional().allow(''),
            groupName: Joi.string().optional().allow(''),
            enrolledProgram: Joi.string().optional().allow(''),
            sdgGoal: Joi.string().optional().allow(''),
            problemDiscoveryMethod: Joi.string().optional().allow(''),
            communityChallenges: Joi.string().optional().allow(''),
            fiveYearProblem: Joi.string().optional().allow(''),
            technologyApplicationReason: Joi.string().optional().allow(''),
            highImpactMissionWhy: Joi.string().optional().allow(''),
            missionEndKnownFor: Joi.string().optional().allow('')
        }).optional(),
        deleteImages: Joi.array().optional()
    });
    
    module.exports.reviewSchema = Joi.object({
        review: Joi.object({
            rating: Joi.number().required().min(1).max(5),
            body: Joi.string().required().escapeHTML()
        }).required()
    })
    
    

