/**
 * @swagger
 * tags:
 *   - name: User
 *     description: User related endpoints
 *   - name: Session
 *     description: Session related endpoints
 *   - name: List
 *     description: List related endpoints
 */

/**
 * @swagger
 * /user/login:
 *   post:
 *     summary: User login
 *     description: API endpoint for user login
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Email and password are required
 *       404:
 *         description: User not found
 *       401:
 *         description: Invalid password
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /user/session:
 *   post:
 *     summary: Create new Session
 *     description: API endpoint for creating a new counseling session
 *     tags:
 *       - Session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "For Career Counselling"
 *               session_date:
 *                 type: string
 *                 format: date
 *                 example: "2023-06-28"
 *               session_time:
 *                 type: string
 *                 format: time
 *                 example: "15:30:00"
 *               type:
 *                 type: string
 *                 example: "career"
 *               counsellor:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               description:
 *                 type: string
 *                 example: "A brief description of the session"
 *               report:
 *                 type: string
 *                 example: "Detailed report of the session"
 *     responses:
 *       201:
 *         description: New Session created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /user/list:
 *   get:
 *     summary: List sessions or reports
 *     description: API endpoint for listing sessions or reports based on type
 *     tags:
 *       - List
 *     parameters:
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [sessions]
 *         description: Type of data to list (currently only supports "sessions")
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - name: searchQuery
 *         in: query
 *         schema:
 *           type: string
 *         description: Optional search query to filter results
 *     responses:
 *       200:
 *         description: Sessions found
 *       404:
 *         description: No sessions found or invalid type
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /user/reschedule/{id}:
 *   put:
 *     summary: Reschedule a session
 *     description: API endpoint for rescheduling a session
 *     tags:
 *       - Session
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the session to reschedule
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_date:
 *                 type: string
 *                 format: date
 *                 example: "2023-07-01"
 *               session_time:
 *                 type: string
 *                 format: time
 *                 example: "15:30:00"
 *     responses:
 *       200:
 *         description: Session rescheduled successfully
 *       400:
 *         description: Session date & time is required or You can't reschedule this session or Session reschedule failed
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal Server Error
 */


/**
 * @swagger
 * /user/counseller/{id}/times:
 *   get:
 *     summary: Counsellor available times
 *     description: API endpoint for getting available times for a specific day
 *     tags:
 *       - Counsellor
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the counsellor
 *       - name: day
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           example: "Monday"
 *         description: Day of the week to find available times
 *     responses:
 *       200:
 *         description: Times found
 *       404:
 *         description: No times found
 *       500:
 *         description: Internal Server Error
 */
