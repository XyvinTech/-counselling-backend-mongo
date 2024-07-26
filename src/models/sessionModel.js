const sql = require("../helpers/sql");

class Session {
  static async createTable() {
    // Ensure the UUID extension is enabled
    await sql`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `;

    // Create the Sessions table with UUID primary key
    await sql`
      CREATE TABLE IF NOT EXISTS Sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255),
        "user" UUID REFERENCES Users(id),
        case_id UUID REFERENCES Cases(id),
        session_date DATE,
        session_time TIME,
        type VARCHAR(255),
        platform VARCHAR(255),
        link VARCHAR(255),
        status VARCHAR(255) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'completed', 'rescheduled')),
        counsellor UUID REFERENCES Users(id),
        description TEXT,
        report TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  static async create({
    user,
    name,
    session_date,
    session_time,
    type,
    status = "pending",
    counsellor,
    description = null,
    report = null,
  }) {
    const [session] = await sql`
      INSERT INTO Sessions (
        "user", name, session_date, session_time, type, status, counsellor, description, report
      ) VALUES (
        ${user}, ${name}, ${session_date}, ${session_time}, ${type}, ${status}, ${counsellor}, ${description}, ${report}
      )
       RETURNING 
      id,
      name,
      session_date,
      session_time,
      type,
      status,
      description,
      counsellor,
      report,
      (SELECT email FROM Users WHERE id = "user") AS user_email,
      (SELECT email FROM Users WHERE id = counsellor) AS counsellor_email
    `;
    return session;
  }

  static async findAll({ page = 1, limit = 10, searchQuery = "" } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql``;

    if (searchQuery) {
      filterCondition = sql`
        WHERE Sessions.description ILIKE ${"%" + searchQuery + "%"}
      `;
    }

    return await sql`
      SELECT 
        Sessions.*,
        Users.name as user_name,
        Counsellors.name as counsellor_name,
      FROM Sessions
      LEFT JOIN Users ON Sessions.user = Users.id
      LEFT JOIN Users as Counsellors ON Sessions.counsellor = Counsellors.id
      ${filterCondition}
      OFFSET ${offset} LIMIT ${limit}
    `;
  }

  static async findAllByUserId({
    userId,
    page = 1,
    limit = 10,
    searchQuery = "",
  } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql` WHERE Sessions."user" = ${userId} `;

    if (searchQuery) {
      filterCondition = sql`
        ${filterCondition} AND Sessions.description ILIKE ${
        "%" + searchQuery + "%"
      }
      `;
    }

    const query = sql`
      SELECT 
        Sessions.*,
        Users.name as user_name,
        Counsellors.name as counsellor_name
      FROM Sessions
      LEFT JOIN Users ON Sessions."user" = Users.id
      LEFT JOIN Users as Counsellors ON Sessions.counsellor = Counsellors.id
      ${filterCondition}
      ORDER BY Sessions."createdAt" DESC
      OFFSET ${offset} LIMIT ${limit}
    `;

    return await query;
  }

  static async findAllByCounsellorId({
    userId,
    page = 1,
    limit = 10,
    searchQuery = "",
    status = null,
  } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql` WHERE Sessions.counsellor = ${userId} `;

    if (status)
      filterCondition = sql` ${filterCondition} AND Sessions.status = ${status}`;

    if (searchQuery) {
      filterCondition = sql`
        ${filterCondition} AND Sessions.description ILIKE ${
        "%" + searchQuery + "%"
      }
      `;
    }

    const query = sql`
      SELECT 
        Sessions.*,
        Users.name as user_name,
        Users.id as user_id,
        Counsellors.name as counsellor_name,
        Cases.grade as grade,
        Cases.id as case_id
      FROM Sessions
      LEFT JOIN Users ON Sessions."user" = Users.id
      LEFT JOIN Cases ON Sessions."case_id" = Cases.id
      LEFT JOIN Users as Counsellors ON Sessions.counsellor = Counsellors.id
      ${filterCondition}
      ORDER BY Sessions."createdAt" DESC
      OFFSET ${offset} LIMIT ${limit}
    `;

    return await query;
  }

  static async find() {
    const [session] = await sql`
      SELECT * FROM Sessions 
    `;
    return session;
  }

  static async count({ id }) {
    let filterCondition = sql``;

    if (id) {
      filterCondition = sql`
        WHERE "user" = ${id}
      `;
    }

    const [result] = await sql`
      SELECT COUNT(*) AS count
      FROM Sessions
      ${filterCondition}
    `;

    return result.count;
  }

  static async counsellor_count({ id }) {
    let filterCondition = sql``;

    if (id) {
      filterCondition = sql`
        WHERE "counsellor" = ${id}
      `;
    }

    const [result] = await sql`
      SELECT COUNT(*) AS count
      FROM Sessions
      ${filterCondition}
    `;

    return result.count;
  }

  static async findByUserId(id) {
    const session = await sql`
      SELECT * FROM Sessions 
      WHERE "user" = ${id} 
      AND status IN ('pending', 'accepted')
    `;
    return session;
  }

  static async findAllByCaseId(id) {
    const session = await sql`
      SELECT Sessions.*, 
      Users.name as user_name,
      Counsellors.name as counsellor_name
      FROM Sessions
      LEFT JOIN Users ON Sessions.user = Users.id
      LEFT JOIN Users as Counsellors ON Sessions.counsellor = Counsellors.id
      WHERE "case_id" = ${id}
    `;
    return session;
  }

  static async findById(id) {
    const [session] = await sql`
      SELECT 
        Sessions.*,
        Users.name as user_name,
        Users.mobile as user_mobile,
        Counsellors.name as counsellor_name,
        Counsellors.mobile as counsellor_mobile,
        Users.email as user_email,
        Counsellors.email as counsellor_email,
        Cases.grade as grade,
        Cases.details as case_details,
        Cases.status as case_status
      FROM Sessions
      LEFT JOIN Users ON Sessions.user = Users.id
      LEFT JOIN Users as Counsellors ON Sessions.counsellor = Counsellors.id
      LEFT JOIN Cases ON Sessions.case_id = Cases.id
      WHERE Sessions.id = ${id}
    `;
    return session;
  }

  static async update(
    id,
    {
      session_date,
      session_time,
      type,
      status,
      counsellor,
      description,
      report,
    }
  ) {
    const [session] = await sql`
      UPDATE Sessions SET
        session_date = ${session_date},
        session_time = ${session_time},
        type = ${type},
        status = ${status},
        counsellor = ${counsellor},
        description = ${description},
        report = ${report},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return session;
  }

  static async close(id) {
    const [session] = await sql`
      UPDATE Sessions SET
        status = completed,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return session;
  }

  static async cancel(id) {
    const [session] = await sql`
      UPDATE Sessions SET
        status = cancelled,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return session;
  }

  static async accept(id, { status, platform, link }) {
    const [session] = await sql`
      UPDATE Sessions SET
        status = ${status},
        platform = ${platform},
        link = ${link},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return session;
  }

  static async countSessionsById(userid, counsellorid) {
    const [result] = await sql`
      SELECT 
        COUNT(*) as session_count
      FROM Sessions
      WHERE user = ${userid} AND counsellor = ${counsellorid}
    `;
    return result.session_count;
  }

  static async delete(id) {
    await sql`
      DELETE FROM Sessions WHERE id = ${id}
    `;
    return true;
  }
}

module.exports = Session;
