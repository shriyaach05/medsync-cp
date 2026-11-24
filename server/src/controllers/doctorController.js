const User = require('../models/User');
const Report = require('../models/Report');

/**
 * Search registered doctors by name or email
 * GET /api/doctors/search?q=...
 */
const searchDoctors = async (req, res, next) => {
  try {
    const query = req.query.q ? req.query.q.trim() : '';
    if (!query || query.length === 0) {
      return res.status(200).json({ doctors: [] });
    }

    // Escape regex special characters to prevent regex injection
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    const doctors = await User.find({
      role: 'doctor',
      $or: [{ name: regex }, { email: regex }],
    })
      .select('_id name email department yearsOfExperience phone')
      .limit(20);

    res.status(200).json({
      doctors,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Aggregate doctors visited from patient's uploaded reports
 * GET /api/doctors/visited
 */
const getDoctorsVisited = async (req, res, next) => {
  try {
    const visited = await Report.aggregate([
      { $match: { owner: req.user._id } },
      {
        $group: {
          _id: '$doctorName',
          visitCount: { $sum: 1 },
          lastVisitDate: { $max: '$visitDate' },
          types: { $addToSet: '$type' },
        },
      },
      { $sort: { lastVisitDate: -1 } },
      {
        $project: {
          _id: 0,
          doctorName: '$_id',
          visitCount: 1,
          lastVisitDate: 1,
          types: 1,
        },
      },
    ]);

    res.status(200).json({
      doctors: visited,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchDoctors,
  getDoctorsVisited,
};
