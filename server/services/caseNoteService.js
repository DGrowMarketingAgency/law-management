const db = require("../config/database");
const { logCaseEvent } = require("./auditService");

const ALLOWED_NOTE_TYPES = ["GENERAL", "HEARING", "STRATEGY", "CLIENT", "INTERNAL"];

const getNotesByCaseId = async (caseId, isPrivilegedUser = false) => {
  const whereClauses = ["cn.case_id = ?", "cn.deleted_at IS NULL"];
  const params = [caseId];

  // If not owner/senior, restrict STRATEGY and INTERNAL notes
  if (!isPrivilegedUser) {
    whereClauses.push("cn.note_type NOT IN ('STRATEGY', 'INTERNAL')");
  }

  const query = `
    SELECT cn.*, u.first_name, u.last_name
    FROM case_notes cn
    JOIN users u ON cn.author_id = u.id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY cn.created_at DESC
  `;

  const [rows] = await db.execute(query, params);
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    authorId: r.author_id,
    authorName: `${r.first_name} ${r.last_name}`,
    noteType: r.note_type,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

const getNoteById = async (noteId) => {
  const [rows] = await db.execute(
    `SELECT cn.*, u.first_name, u.last_name
     FROM case_notes cn
     JOIN users u ON cn.author_id = u.id
     WHERE cn.id = ? AND cn.deleted_at IS NULL
     LIMIT 1`,
    [noteId]
  );
  if (rows.length === 0) {
    const err = new Error("Note not found.");
    err.statusCode = 404;
    err.code = "NOTE_NOT_FOUND";
    throw err;
  }
  const r = rows[0];
  return {
    id: r.id,
    caseId: r.case_id,
    authorId: r.author_id,
    authorName: `${r.first_name} ${r.last_name}`,
    noteType: r.note_type,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

const createNote = async (caseId, { note_type, title, content }, authorId, ip = null, userAgent = null) => {
  if (!title || !content) {
    const err = new Error("Note title and content are required.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const type = note_type || "GENERAL";
  if (!ALLOWED_NOTE_TYPES.includes(type)) {
    const err = new Error(`Invalid note_type: ${type}`);
    err.statusCode = 422;
    throw err;
  }

  const query = `
    INSERT INTO case_notes (case_id, author_id, note_type, title, content)
    VALUES (?, ?, ?, ?, ?)
  `;

  const [res] = await db.execute(query, [caseId, authorId, type, String(title).trim(), String(content).trim()]);

  await logCaseEvent(authorId, "NOTE_CREATED", "NOTE", res.insertId, ip, userAgent, {
    caseId,
    noteType: type,
  });

  return await getNoteById(res.insertId);
};

const updateNote = async (noteId, { title, content }, modifierId = null, ip = null, userAgent = null) => {
  const current = await getNoteById(noteId);
  const setClauses = [];
  const params = [];

  if (title !== undefined) {
    setClauses.push("title = ?");
    params.push(String(title).trim());
  }

  if (content !== undefined) {
    setClauses.push("content = ?");
    params.push(String(content).trim());
  }

  if (setClauses.length > 0) {
    params.push(noteId);
    await db.execute(`UPDATE case_notes SET ${setClauses.join(", ")} WHERE id = ?`, params);
    await logCaseEvent(modifierId, "NOTE_UPDATED", "NOTE", noteId, ip, userAgent, { caseId: current.caseId });
  }

  return await getNoteById(noteId);
};

const deleteNote = async (noteId, modifierId = null, ip = null, userAgent = null) => {
  const current = await getNoteById(noteId);
  await db.execute(`UPDATE case_notes SET deleted_at = NOW() WHERE id = ?`, [noteId]);
  await logCaseEvent(modifierId, "NOTE_DELETED", "NOTE", noteId, ip, userAgent, { caseId: current.caseId });
  return { success: true, message: "Note deleted." };
};

module.exports = {
  getNotesByCaseId,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  ALLOWED_NOTE_TYPES,
};
