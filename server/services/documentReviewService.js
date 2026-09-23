const db = require('../config/database');
const { logDocumentEvent } = require('./auditService');

class DocumentReviewService {
  /**
   * Submit draft document version for internal review
   */
  async submitForReview(arg1, userId, reviewerId, notes, reqInfo = {}) {
    let documentId, versionId, requestedBy, comments;
    if (typeof arg1 === 'object' && arg1 !== null) {
      documentId = arg1.documentId;
      versionId = arg1.versionId || null;
      requestedBy = arg1.requestedBy;
      reviewerId = arg1.reviewerId;
      comments = arg1.comments || '';
    } else {
      documentId = arg1;
      requestedBy = userId;
      reviewerId = reviewerId;
      comments = notes || '';
      versionId = null;
    }

    const [docRows] = await db.query(
      `SELECT d.*, dv.id as latest_version_id 
       FROM documents d
       LEFT JOIN document_versions dv ON d.current_version_id = dv.id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [documentId]
    );

    if (docRows.length === 0) {
      const err = new Error('Document not found.');
      err.statusCode = 404;
      throw err;
    }

    const doc = docRows[0];
    const targetVersionId = versionId || doc.latest_version_id;

    if (!targetVersionId) {
      const err = new Error('Document has no valid uploaded version.');
      err.statusCode = 400;
      throw err;
    }

    if (doc.status === 'APPROVED' || doc.status === 'SIGNED') {
      const err = new Error(`Document is already ${doc.status} and cannot be re-submitted without creating a new version.`);
      err.statusCode = 400;
      throw err;
    }

    const [res] = await db.query(
      `INSERT INTO document_reviews (document_id, version_id, requested_by, reviewer_id, status, comments)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [documentId, targetVersionId, requestedBy, reviewerId, comments]
    );

    // Update document status and lock from modification
    await db.query(
      `UPDATE documents SET status = 'IN_REVIEW', is_locked = TRUE WHERE id = ?`,
      [documentId]
    );

    await logDocumentEvent(requestedBy, 'DOCUMENT_REVIEW_REQUESTED', documentId, reqInfo.ip, reqInfo.userAgent, {
      reviewId: res.insertId,
      versionId: targetVersionId,
      reviewerId
    });

    return {
      reviewId: res.insertId,
      status: 'IN_REVIEW',
      is_locked: true,
      document: {
        id: documentId,
        status: 'IN_REVIEW',
        is_locked: 1
      }
    };
  }

  /**
   * Get all reviews for a document
   */
  async getReviews(documentId) {
    const [rows] = await db.query(
      `SELECT r.*, 
        req.first_name as requester_first_name, req.last_name as requester_last_name,
        rev.first_name as reviewer_first_name, rev.last_name as reviewer_last_name,
        dv.version_number
       FROM document_reviews r
       JOIN users req ON r.requested_by = req.id
       LEFT JOIN users rev ON r.reviewer_id = rev.id
       LEFT JOIN document_versions dv ON r.version_id = dv.id
       WHERE r.document_id = ?
       ORDER BY r.requested_at DESC`,
      [documentId]
    );
    return rows;
  }

  async getDocumentReviews(documentId) {
    return this.getReviews(documentId);
  }

  /**
   * Process review: APPROVE | REQUEST_CHANGES | REJECT
   */
  async processReview(reviewId, action, reviewerUser, comments = '', reqInfo = {}) {
    const [reviewRows] = await db.query(
      `SELECT r.*, d.confidentiality_level, d.document_type_id, dt.requires_advocate_approval
       FROM document_reviews r
       JOIN documents d ON r.document_id = d.id
       LEFT JOIN document_types dt ON d.document_type_id = dt.id
       WHERE r.id = ?`,
      [reviewId]
    );

    if (reviewRows.length === 0) {
      const err = new Error('Review request not found.');
      err.statusCode = 404;
      throw err;
    }

    const review = reviewRows[0];
    if (review.status !== 'PENDING') {
      const err = new Error(`Review has already been processed with status '${review.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const roles = Array.isArray(reviewerUser.roles)
      ? reviewerUser.roles
      : [reviewerUser.role].filter(Boolean);
    const isAdvocate = roles.includes('ADVOCATE') || roles.includes('OWNER') || roles.includes('ADMIN') || roles.includes('MANAGING_PARTNER') || roles.includes('SENIOR_ADVOCATE');

    // Advocate-only approval enforcement
    if (action === 'APPROVE') {
      if (!isAdvocate) {
        const err = new Error('Advocate approval privilege required. Paralegals and Interns cannot approve legal documents.');
        err.statusCode = 403;
        throw err;
      }

      await db.query(
        `UPDATE document_reviews SET status = 'APPROVED', comments = ?, reviewed_at = NOW() WHERE id = ?`,
        [comments ? comments.trim() : 'Approved', reviewId]
      );

      // Transition document to APPROVED and ensure it is locked
      await db.query(
        `UPDATE documents SET 
           status = 'APPROVED', 
           approved_by = ?, 
           approved_at = NOW(), 
           is_locked = TRUE 
         WHERE id = ?`,
        [reviewerUser.id, review.document_id]
      );

      await logDocumentEvent(reviewerUser.id, 'DOCUMENT_APPROVED', review.document_id, reqInfo.ip, reqInfo.userAgent, {
        reviewId,
        versionId: review.version_id,
        approvalComment: comments
      });

      return {
        reviewId,
        status: 'APPROVED',
        documentStatus: 'APPROVED',
        document: {
          id: review.document_id,
          status: 'APPROVED',
          is_locked: 1
        }
      };
    }

    if (action === 'REQUEST_CHANGES') {
      if (!comments || !comments.trim()) {
        const err = new Error('Comments are mandatory when requesting changes.');
        err.statusCode = 400;
        throw err;
      }

      await db.query(
        `UPDATE document_reviews SET status = 'CHANGES_REQUESTED', comments = ?, reviewed_at = NOW() WHERE id = ?`,
        [comments.trim(), reviewId]
      );

      // Unlock document so author can upload revisions
      await db.query(
        `UPDATE documents SET status = 'CHANGES_REQUESTED', is_locked = FALSE WHERE id = ?`,
        [review.document_id]
      );

      await logDocumentEvent(reviewerUser.id, 'DOCUMENT_CHANGES_REQUESTED', review.document_id, reqInfo.ip, reqInfo.userAgent, {
        reviewId,
        comments
      });

      return {
        reviewId,
        status: 'CHANGES_REQUESTED',
        documentStatus: 'CHANGES_REQUESTED',
        document: {
          id: review.document_id,
          status: 'CHANGES_REQUESTED',
          is_locked: 0
        }
      };
    }

    if (action === 'REJECT') {
      if (!comments || !comments.trim()) {
        const err = new Error('Reason is required when rejecting a document review.');
        err.statusCode = 400;
        throw err;
      }

      await db.query(
        `UPDATE document_reviews SET status = 'REJECTED', comments = ?, reviewed_at = NOW() WHERE id = ?`,
        [comments.trim(), reviewId]
      );

      await db.query(
        `UPDATE documents SET status = 'REJECTED', is_locked = TRUE WHERE id = ?`,
        [review.document_id]
      );

      await logDocumentEvent(reviewerUser.id, 'DOCUMENT_REJECTED', review.document_id, reqInfo.ip, reqInfo.userAgent, {
        reviewId,
        reason: comments
      });

      return {
        reviewId,
        status: 'REJECTED',
        documentStatus: 'REJECTED',
        document: {
          id: review.document_id,
          status: 'REJECTED',
          is_locked: 1
        }
      };
    }

    const err = new Error(`Invalid review action '${action}'.`);
    err.statusCode = 400;
    throw err;
  }

  /**
   * Helper: Approve document by documentId
   */
  async approveDocument(documentId, userId, role, comments = '', reqInfo = {}) {
    // Find latest pending review for this document
    const [reviews] = await db.query(
      `SELECT id FROM document_reviews WHERE document_id = ? AND status = 'PENDING' ORDER BY requested_at DESC LIMIT 1`,
      [documentId]
    );

    let reviewId = reviews.length > 0 ? reviews[0].id : null;

    if (!reviewId) {
      // If no review record exists yet, create an immediate approval record
      const [docRows] = await db.query(`SELECT current_version_id FROM documents WHERE id = ?`, [documentId]);
      if (docRows.length === 0) {
        const err = new Error('Document not found.');
        err.statusCode = 404;
        throw err;
      }
      const [res] = await db.query(
        `INSERT INTO document_reviews (document_id, version_id, requested_by, reviewer_id, status, comments)
         VALUES (?, ?, ?, ?, 'PENDING', ?)`,
        [documentId, docRows[0].current_version_id, userId, userId, comments || 'Direct Approval']
      );
      reviewId = res.insertId;
    }

    return this.processReview(reviewId, 'APPROVE', { id: userId, role }, comments, reqInfo);
  }

  /**
   * Helper: Request changes by documentId
   */
  async requestChanges(documentId, userId, role, comments, reqInfo = {}) {
    const [reviews] = await db.query(
      `SELECT id FROM document_reviews WHERE document_id = ? AND status = 'PENDING' ORDER BY requested_at DESC LIMIT 1`,
      [documentId]
    );
    if (reviews.length === 0) {
      const err = new Error('No pending review found for this document.');
      err.statusCode = 404;
      throw err;
    }
    return this.processReview(reviews[0].id, 'REQUEST_CHANGES', { id: userId, role }, comments, reqInfo);
  }

  /**
   * Helper: Reject document by documentId
   */
  async rejectDocument(documentId, userId, role, comments, reqInfo = {}) {
    const [reviews] = await db.query(
      `SELECT id FROM document_reviews WHERE document_id = ? AND status = 'PENDING' ORDER BY requested_at DESC LIMIT 1`,
      [documentId]
    );
    if (reviews.length === 0) {
      const err = new Error('No pending review found for this document.');
      err.statusCode = 404;
      throw err;
    }
    return this.processReview(reviews[0].id, 'REJECT', { id: userId, role }, comments, reqInfo);
  }

  /**
   * Threaded Comments
   */
  async addComment(arg1, authorId, commentText, parentCommentId = null, pageNumber = null) {
    let documentId, targetVersionId, comment;
    if (typeof arg1 === 'object' && arg1 !== null) {
      documentId = arg1.documentId;
      targetVersionId = arg1.versionId;
      authorId = arg1.authorId;
      comment = arg1.comment || arg1.commentText;
      parentCommentId = arg1.parentCommentId || null;
    } else {
      documentId = arg1;
      comment = commentText;
    }

    if (!comment || !comment.trim()) {
      const err = new Error('Comment text cannot be empty.');
      err.statusCode = 400;
      throw err;
    }

    if (!targetVersionId) {
      const [doc] = await db.query(`SELECT current_version_id FROM documents WHERE id = ?`, [documentId]);
      targetVersionId = doc[0]?.current_version_id;
    }

    const [res] = await db.query(
      `INSERT INTO document_comments (document_id, version_id, parent_comment_id, author_id, comment, status)
       VALUES (?, ?, ?, ?, ?, 'OPEN')`,
      [documentId, targetVersionId, parentCommentId || null, authorId, comment.trim()]
    );

    return {
      id: res.insertId,
      document_id: documentId,
      version_id: targetVersionId,
      parent_comment_id: parentCommentId,
      author_id: authorId,
      comment: comment.trim(),
      status: 'OPEN'
    };
  }

  async getComments(documentId, versionId = null) {
    let sql = `
      SELECT c.*, u.first_name, u.last_name, u.email,
             ru.first_name as resolved_by_first_name, ru.last_name as resolved_by_last_name
      FROM document_comments c
      JOIN users u ON c.author_id = u.id
      LEFT JOIN users ru ON c.resolved_by = ru.id
      WHERE c.document_id = ?
    `;
    const params = [documentId];

    if (versionId) {
      sql += ` AND c.version_id = ?`;
      params.push(versionId);
    }

    sql += ` ORDER BY c.created_at ASC`;
    const [rows] = await db.query(sql, params);
    return rows;
  }

  async getDocumentComments(documentId) {
    return this.getComments(documentId);
  }

  async resolveComment(commentId, userId) {
    await db.query(
      `UPDATE document_comments SET status = 'RESOLVED', resolved_by = ?, resolved_at = NOW() WHERE id = ?`,
      [userId, commentId]
    );
    return { id: commentId, status: 'RESOLVED', is_resolved: true };
  }
}

module.exports = new DocumentReviewService();
