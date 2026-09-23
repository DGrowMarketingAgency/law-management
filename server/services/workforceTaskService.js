const pool = require("../config/database");
const WorkforceCodeService = require("./workforceCodeService");
const { ApiError } = require("../middleware/errorHandler");

/**
 * WorkforceTaskService
 * Internal Chambers task delegation, legal research/drafting tracking,
 * case linking, hour logging, and role-scoped task views.
 */
class WorkforceTaskService {
  /**
   * List tasks with filters and role-level visibility
   */
  static async getTasks(filters = {}, requestingUser) {
    const {
      assigned_to,
      related_case_id,
      status,
      priority,
      task_type,
      search,
      page = 1,
      limit = 25,
    } = filters;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    // Privacy Guard: If INTERN or JUNIOR_ASSOCIATE, can only see assigned tasks or tasks in their assigned cases
    if (["INTERN", "JUNIOR_ASSOCIATE"].includes(requestingUser.role)) {
      whereClause += ` AND (
        wt.assigned_to = ? OR 
        wt.assigned_by = ? OR
        wt.related_case_id IN (SELECT case_id FROM case_assignments WHERE user_id = ?)
      )`;
      params.push(requestingUser.id, requestingUser.id, requestingUser.id);
    } else if (assigned_to) {
      whereClause += " AND wt.assigned_to = ?";
      params.push(assigned_to);
    }

    if (related_case_id) {
      whereClause += " AND wt.related_case_id = ?";
      params.push(related_case_id);
    }

    if (status) {
      whereClause += " AND wt.status = ?";
      params.push(status);
    }

    if (priority) {
      whereClause += " AND wt.priority = ?";
      params.push(priority);
    }

    if (task_type) {
      whereClause += " AND wt.task_type = ?";
      params.push(task_type);
    }

    if (search) {
      whereClause += ` AND (wt.task_code LIKE ? OR wt.title LIKE ? OR wt.description LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM workforce_tasks wt ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        wt.*,
        assignee.first_name AS assignee_first_name,
        assignee.last_name AS assignee_last_name,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        c.case_number,
        c.title AS case_title,
        cl.client_code,
        client_c.display_name AS client_name
       FROM workforce_tasks wt
       JOIN users assignee ON wt.assigned_to = assignee.id
       JOIN users creator ON wt.assigned_by = creator.id
       LEFT JOIN cases c ON wt.related_case_id = c.id
       LEFT JOIN clients cl ON wt.related_client_id = cl.id
       LEFT JOIN contacts client_c ON cl.contact_id = client_c.id
       ${whereClause}
       ORDER BY 
         CASE wt.priority 
           WHEN 'URGENT' THEN 1 
           WHEN 'HIGH' THEN 2 
           WHEN 'MEDIUM' THEN 3 
           WHEN 'LOW' THEN 4 
         END ASC, 
         wt.due_date ASC, 
         wt.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      tasks: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Get single task by ID
   */
  static async getTaskById(id, requestingUser) {
    const [rows] = await pool.query(
      `SELECT 
        wt.*,
        assignee.first_name AS assignee_first_name,
        assignee.last_name AS assignee_last_name,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        c.case_number,
        c.title AS case_title,
        cl.client_code
       FROM workforce_tasks wt
       JOIN users assignee ON wt.assigned_to = assignee.id
       JOIN users creator ON wt.assigned_by = creator.id
       LEFT JOIN cases c ON wt.related_case_id = c.id
       LEFT JOIN clients cl ON wt.related_client_id = cl.id
       WHERE wt.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, "Task not found.");
    }
    const task = rows[0];

    // Privacy Guard
    if (["INTERN", "JUNIOR_ASSOCIATE"].includes(requestingUser.role)) {
      if (task.assigned_to !== requestingUser.id && task.assigned_by !== requestingUser.id) {
        // Check if assigned to same case
        if (task.related_case_id) {
          const [caseCheck] = await pool.query(
            `SELECT id FROM case_assignments WHERE case_id = ? AND user_id = ?`,
            [task.related_case_id, requestingUser.id]
          );
          if (caseCheck.length === 0) {
            throw new ApiError(403, "Access denied. You do not have permission to view this task.");
          }
        } else {
          throw new ApiError(403, "Access denied. You do not have permission to view this task.");
        }
      }
    }

    return task;
  }

  /**
   * Create task
   */
  static async createTask(data, creatorUserId) {
    const taskCode = await WorkforceCodeService.generateCode(
      "TSK",
      "workforce_tasks",
      "task_code"
    );

    // If related_case_id provided, verify case existence and fetch client if not provided
    let clientId = data.related_client_id || null;
    if (data.related_case_id && !clientId) {
      const [caseRows] = await pool.query(
        `SELECT client_id FROM cases WHERE id = ?`,
        [data.related_case_id]
      );
      if (caseRows.length > 0) {
        clientId = caseRows[0].client_id;
      }
    }

    const [res] = await pool.query(
      `INSERT INTO workforce_tasks
       (task_code, title, description, task_type, priority, assigned_to, assigned_by,
        related_case_id, related_client_id, due_date, estimated_hours, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TODO')`,
      [
        taskCode,
        data.title,
        data.description || null,
        data.task_type || "CASE",
        data.priority || "MEDIUM",
        data.assigned_to,
        creatorUserId,
        data.related_case_id || null,
        clientId,
        data.due_date,
        data.estimated_hours || 0.0,
      ]
    );

    return { id: res.insertId, task_code: taskCode };
  }

  /**
   * Update task
   */
  static async updateTask(id, data, requestingUser) {
    const task = await this.getTaskById(id, requestingUser);

    const isCompleted = data.status === "COMPLETED";

    await pool.query(
      `UPDATE workforce_tasks
       SET status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           actual_hours = COALESCE(?, actual_hours),
           completed_at = ?,
           description = COALESCE(?, description),
           due_date = COALESCE(?, due_date)
       WHERE id = ?`,
      [
        data.status || null,
        data.priority || null,
        data.actual_hours !== undefined ? data.actual_hours : null,
        isCompleted ? new Date() : (task.status === "COMPLETED" && data.status !== "COMPLETED" ? null : task.completed_at),
        data.description || null,
        data.due_date || null,
        id,
      ]
    );

    return { id, status: data.status || task.status };
  }
}

module.exports = WorkforceTaskService;
