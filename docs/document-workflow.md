# Legal Document Review & Approval Workflow

## 1. Lifecycle Overview
The Document Review & Approval Engine enforces a strict 4-stage lifecycle ensuring quality control before any document leaves chambers or is submitted to court:

```
+-----------------------------------------------------------------------------------+
|                               Document State Machine                              |
+-----------------------------------------------------------------------------------+

     +------------+
     |   DRAFT    | <--------------------+ (Changes Requested)
     +-----+------+                      |
           |                             |
     (Submit for Review)                 |
           |                             |
           v                             |
     +------------+                      |
     | IN_REVIEW  | --- (Advocate Req) --+
     +-----+------+
           |
     (Advocate Approve)
           |
           v
     +------------+
     |  APPROVED  |  (Locked from edits)
     +-----+------+
           |
     (Initiate E-Sign)
           |
           v
     +--------------------+
     | AWAITING_SIGNATURE |
     +-----+--------------+
           |
     (Webhook: Signed)
           |
           v
     +------------+
     |   SIGNED   |  (Immutable v(N+1) with Digital Seal)
     +------------+
```

---

## 2. Review Submission
- A drafter (associate, paralegal, or intern) completes drafting and submits via `POST /api/v1/documents/:id/reviews/submit`.
- The document status transitions to `IN_REVIEW` and `is_locked = TRUE`.
- The designated reviewer is notified.

---

## 3. Reviewer Decisions
- **APPROVE**:
  - Requires Advocate, Senior Advocate, or Owner role.
  - Transitions document to `APPROVED`, sets `approved_at = NOW()`, `approved_by = reviewerId`, and locks the document.
- **REQUEST_CHANGES**:
  - Reviewer submits required feedback notes.
  - Document transitions to `CHANGES_REQUESTED` and unlocks (`is_locked = FALSE`), allowing the author to upload revision v2.
- **REJECT**:
  - For non-viable or obsolete drafts. Document transitions to `REJECTED` and is locked.

---

## 4. Threaded Annotations & Inline Comments
- Counsel can add page-specific comments (`POST /api/v1/documents/:id/comments`).
- Associates can reply in-thread (`parent_comment_id`).
- Comments can be marked as `RESOLVED` once addressed.
