const sql = require("../helpers/sql");

class Case {
  static async createTable() {
    // Ensure the UUID extension is enabled
    await sql`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `;

    // Create a sequence for case_id
    await sql`
      CREATE SEQUENCE IF NOT EXISTS case_id_seq START 1;
    `;

    // Create the function to generate case_id
    await sql`
      CREATE OR REPLACE FUNCTION generate_case_id() RETURNS TEXT AS $$
      DECLARE
          new_case_id TEXT;
      BEGIN
          SELECT 'CS_' || LPAD(nextval('case_id_seq')::TEXT, 3, '0') INTO new_case_id;
          RETURN new_case_id;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Create the Cases table with UUID primary key and case_id
    await sql`
      CREATE TABLE IF NOT EXISTS Cases (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        case_id TEXT UNIQUE,
        "user" UUID REFERENCES Users(id),
        details TEXT,
        concern_raised DATE,
        status VARCHAR(255) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'completed', 'referred')),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_ids VARCHAR -- Comma-separated session IDs
      );
    `;

    // Create a trigger to automatically generate the case_id
    await sql`
      CREATE OR REPLACE FUNCTION set_case_id() RETURNS TRIGGER AS $$
      BEGIN
          NEW.case_id := generate_case_id();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await sql`
      CREATE TRIGGER trigger_set_case_id
      BEFORE INSERT ON Cases
      FOR EACH ROW
      EXECUTE FUNCTION set_case_id();
    `;
  }

  static async create({ user, sessions, concern_raised }) {
    const sessionIds = sessions.map((session) =>
      typeof session === "object" ? session.id : session
    );

    const [newCase] = await sql`
      INSERT INTO Cases (
        "user", session_ids, concern_raised
      ) VALUES (
        ${user}, ${concern_raised}, ${sessionIds.join(",")}
      )
      RETURNING *
    `;

    for (let index = 0; index < sessionIds.length; index++) {
      const sessionId = sessionIds[index];
      const formattedSessionId = `${newCase.case_id}/SC_${String(
        index + 1
      ).padStart(2, "0")}`;

      await sql`
        UPDATE Sessions SET
          session_id = ${formattedSessionId},
          case_id = ${newCase.id}
        WHERE id = ${sessionId}
      `;
    }

    return newCase;
  }

  static async find({ page = 1, limit = 10, searchQuery = "" } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql``;

    if (searchQuery) {
      filterCondition = sql`
        WHERE Users.name ILIKE ${"%" + searchQuery + "%"}
        OR Counsellors.name ILIKE ${"%" + searchQuery + "%"}
      `;
    }

    const cases = await sql`
    SELECT 
      Cases.*,
      Users.name AS user_name,
      Counsellors.name AS counsellor_name,
      json_agg(Sessions.*) AS sessions
    FROM Cases
    LEFT JOIN Users ON Cases."user" = Users.id
    LEFT JOIN Sessions ON Sessions.case_id = Cases.id
    LEFT JOIN Users AS Counsellors ON Sessions.counsellor = Counsellors.id
    ${filterCondition}
    GROUP BY Cases.id, Users.name, Counsellors.name
    OFFSET ${offset} LIMIT ${limit}
  `;

    return cases;
  }

  static async findAll({
    userId,
    page = 1,
    searchQuery = "",
    limit = 10,
  } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql``;

    if (searchQuery) {
      filterCondition = sql`
        ${filterCondition} AND Users.name ILIKE ${"%" + searchQuery + "%"}
      `;
    }

    const cases = await sql`
      SELECT 
        Cases.*,
        Users.name AS user_name,
        json_agg(Sessions.*) AS sessions
      FROM Cases
      LEFT JOIN Users ON Cases."user" = Users.id
      LEFT JOIN Sessions ON Sessions.case_id = Cases.id
      WHERE Sessions.counsellor = ${userId}
      ${filterCondition}
      GROUP BY Cases.id, Users.name
      ORDER BY Cases."createdAt" DESC
      OFFSET ${offset} LIMIT ${limit}
    `;

    return cases;
  }

  static async findById(id) {
    const [caseRow] = await sql`
      SELECT 
        Cases.*,
        json_agg(Sessions.*) as sessions
      FROM Cases
      LEFT JOIN Sessions ON Sessions.id = ANY(string_to_array(Cases.session_ids, ',')::uuid[])
      WHERE Cases.id = ${id}
      GROUP BY Cases.id
    `;

    return caseRow;
  }

  static async findByUserId(id) {
    const session = await sql`
      SELECT * FROM Cases 
      WHERE "user" = ${id} 
      AND status IN ('pending', 'accepted')
    `;
    return session;
  }

  static async findByUser({
    userId,
    page = 1,
    limit = 10,
    searchQuery = "",
  } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql`WHERE Cases."user" = ${userId}`;

    if (searchQuery) {
      filterCondition = sql`
        ${filterCondition} AND Counsellors.name ILIKE ${"%" + searchQuery + "%"}
      `;
    }

    const cases = await sql`
      SELECT Cases.*, 
      Counsellors.counsellorType AS session_type,
      Counsellors.name AS counsellor_name
      FROM Cases
      LEFT JOIN Sessions ON Cases.id = Sessions.case_id
      LEFT JOIN Users AS Counsellors ON Sessions.counsellor = Counsellors.id
      ${filterCondition}
      GROUP BY Cases.id, Counsellors.name, Counsellors.counsellorType
      ORDER BY Cases."createdAt" DESC
      OFFSET ${offset} LIMIT ${limit}
    `;
    return cases;
  }

  static async findAllByCounsellorId({
    userId,
    page = 1,
    limit = 10,
    searchQuery = "",
  } = {}) {
    const offset = (page - 1) * limit;
    let filterCondition = sql`WHERE Sessions.counsellor = ${userId}`;

    if (searchQuery) {
      filterCondition = sql`
        ${filterCondition} AND Cases.status ILIKE ${"%" + searchQuery + "%"}
      `;
    }

    const query = sql`
      SELECT 
      Cases.*,
      Users.name as user_name,
      Counsellors.name as counsellor_name
    FROM Cases
    LEFT JOIN Sessions ON Cases.id = Sessions.case_id
    LEFT JOIN Users ON Cases."user" = Users.id
    LEFT JOIN Users as Counsellors ON Sessions.counsellor = Counsellors.id
    ${filterCondition}
    ORDER BY Sessions."createdAt" DESC
    OFFSET ${offset} LIMIT ${limit}
    `;

    return await query;
  }

  static async counsellor_count({ id }) {
    const result = await sql`
      SELECT COUNT(*) AS count 
      FROM Cases 
      WHERE id IN (
        SELECT case_id 
        FROM Sessions 
        WHERE counsellor = ${id}
      )
    `;

    return result[0].count;
  }

  static async user_count({ id }) {
    const result = await sql`
      SELECT COUNT(*) AS count 
      FROM Cases 
      WHERE "user" = ${id} 
    `;

    return result[0].count;
  }

  static async update(id, { sessions, concern_raised }) {
    const sessionIds = sessions.map((session) =>
      typeof session === "object" ? session.id : session
    );

    const [updatedCase] = await sql`
      UPDATE Cases SET
        session_ids = ${sessionIds.join(",")},
        concern_raised = ${concern_raised},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    for (let index = 0; index < sessionIds.length; index++) {
      const sessionId = sessionIds[index];
      const formattedSessionId = `${updatedCase.case_id}/SC_${String(
        index + 1
      ).padStart(2, "0")}`;

      await sql`
        UPDATE Sessions SET
          session_id = ${formattedSessionId},
          case_id = ${id}
        WHERE id = ${sessionId}
      `;
    }

    return updatedCase;
  }

  static async accept(id) {
    const [session] = await sql`
      UPDATE Cases SET
        status = 'accepted',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return session;
  }

  static async close(id, { details, concern_raised }) {
    const [closeCase] = await sql`
      UPDATE Cases SET
        details = ${details},
        concern_raised = ${concern_raised},
        status = 'completed',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return closeCase;
  }

  static async refer(id, { details, concern_raised }) {
    const [closeCase] = await sql`
      UPDATE Cases SET
        details = ${details},
        concern_raised = ${concern_raised},
        status = 'referred',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return closeCase;
  }

  static async cancel(id) {
    const [session] = await sql`
      UPDATE Cases SET
        status = 'cancelled',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return session;
  }

  static async count() {
    const [cases] = await sql`
      SELECT COUNT(*) FROM Cases
    `;
    return cases.count;
  }

  static async delete(id) {
    await sql`
      DELETE FROM Cases WHERE id = ${id}
    `;
    return true;
  }

  static async dropTable() {
    await sql`
      DROP TABLE IF EXISTS ${sql("sessions")} CASCADE;
    `;
  }
}

module.exports = Case;
