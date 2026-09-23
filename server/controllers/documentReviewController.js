const documentReviewService = require('../services/documentReviewService');

// Submit document for review
exports.submitForReview = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const { reviewerId, notes } = req.body;
    const result = await documentReviewService.submitForReview(
      documentId,
      req.user.id,
      reviewerId,
      notes
    );
    res.status(200).json({
      success: true,
      message: 'Document submitted for review successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Advocate approve document
exports.approveDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const { comments } = req.body;
    const result = await documentReviewService.approveDocument(
      documentId,
      req.user.id,
      req.user.role,
      comments
    );
    res.status(200).json({
      success: true,
      message: 'Document approved successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Request changes on document
exports.requestChanges = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const { comments } = req.body;
    const result = await documentReviewService.requestChanges(
      documentId,
      req.user.id,
      req.user.role,
      comments
    );
    res.status(200).json({
      success: true,
      message: 'Changes requested on document',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Reject document
exports.rejectDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const { comments } = req.body;
    const result = await documentReviewService.rejectDocument(
      documentId,
      req.user.id,
      req.user.role,
      comments
    );
    res.status(200).json({
      success: true,
      message: 'Document rejected',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// Get reviews for document
exports.getDocumentReviews = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const reviews = await documentReviewService.getDocumentReviews(documentId);
    res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (err) {
    next(err);
  }
};

// Add comment to document
exports.addComment = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const { commentText, parentCommentId, pageNumber } = req.body;
    const comment = await documentReviewService.addComment(
      documentId,
      req.user.id,
      commentText,
      parentCommentId,
      pageNumber
    );
    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      data: comment
    });
  } catch (err) {
    next(err);
  }
};

// Get threaded comments for document
exports.getDocumentComments = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const comments = await documentReviewService.getDocumentComments(documentId);
    res.status(200).json({
      success: true,
      data: comments
    });
  } catch (err) {
    next(err);
  }
};

// Resolve comment
exports.resolveComment = async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const comment = await documentReviewService.resolveComment(commentId, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Comment resolved',
      data: comment
    });
  } catch (err) {
    next(err);
  }
};
