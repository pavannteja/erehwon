const Campground = require('../models/campgrounds');
const Review = require('../models/review');

module.exports.createReview = async (req, res)=>{
    const campground = await Campground.findById(req.params.id);
    const wantsJson =
      String(req.body.reviewsAjax || '') === '1' ||
      req.xhr ||
      (req.get('Accept') || '').includes('application/json');
    if (!campground) {
      if (wantsJson) {
        return res.status(404).json({ ok: false, error: 'Problem statement not found' });
      }
      req.flash('error', 'Problem statement not found');
      return res.redirect('/dashboard');
    }
    const review = new Review(req.body.review);
    review.author = req.user._id;
    campground.reviews.push(review);
    await review.save();
    await campground.save();
    if (wantsJson) {
      return res.json({
        ok: true,
        message: 'Submitted Successfully!',
        review: {
          id: String(review._id),
          rating: Number(review.rating) || 0,
          body: review.body || '',
          author: {
            username: req.user && req.user.username ? req.user.username : 'You',
            schoolName: req.user && req.user.schoolName ? req.user.schoolName : ''
          }
        }
      });
    }
    req.flash('success', 'Created new review');
    res.redirect(`/campgrounds/${campground._id}`);
  }

  module.exports.deleteReview =async (req, res)=>{
    const { id, reviewId } = req.params;
    await Campground.findByIdAndUpdate(id, {$pull: { reviews: reviewId} });
    await Review.findByIdAndDelete(reviewId);
    req.flash('success', 'successfully deleted a review')
    res.redirect(`/campgrounds/${id}`);
  }