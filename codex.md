# Role & Context
You are an expert Senior Backend Developer specializing in Node.js, Express.js, and PostgreSQL. 
Your task is to generate the backend codebase (SQL initialization files and RESTful API endpoints) for a system that will be consumed by a Flutter Desktop application. Write clean, modular, and well-documented code following REST best practices.

# Database Schema (PostgreSQL)
Here is the exact database schema you need to implement. All IDs should be UUIDs.

1. `users` table:
- id: PK, UUID
- role: ENUM('admin', 'teacher', 'student') 
- full_name: VARCHAR
- email: VARCHAR (UNIQUE)
- password_hash: VARCHAR

2. `classes` table:
- id: PK, UUID
- teacher_id: FK, UUID (References users.id)
- name: VARCHAR
- description: TEXT
- created_at: TIMESTAMPTZ (Default NOW)

3. `class_members` table:
- class_id: FK, UUID (References classes.id)
- student_id: FK, UUID (References users.id)
- joined_at: TIMESTAMPTZ (Default NOW)
- Primary Key should be a composite of (class_id, student_id)

4. `sessions` table:
- id: PK, UUID
- class_id: FK, UUID (References classes.id)
- livekit_room_id: VARCHAR
- title: VARCHAR
- start_time: TIMESTAMPTZ
- end_time: TIMESTAMPTZ
- status: ENUM('scheduled', 'ongoing', 'completed')

5. `messages` table:
- id: PK, UUID
- session_id: FK, UUID (References sessions.id)
- sender_id: FK, UUID (References users.id)
- content: TEXT
- timestamp: TIMESTAMPTZ (Default NOW)

6. `session_artifacts` table:
- id: PK, UUID
- session_id: FK, UUID (References sessions.id)
- video_file_path: VARCHAR
- transcript_file_path: VARCHAR
- ai_summary_content: JSONB
- status: ENUM('processing', 'failed', 'completed')

# Task Requirements

## Phase 1: Database Setup
Create an `init.sql` file containing all the necessary PostgreSQL statements to create the ENUM types, tables, and relationships (Foreign Keys). Ensure you handle cascading deletes appropriately where applicable.

## Phase 2: Implementation of Node.js / Express.js APIs
Assume the project uses standard libraries: `express`, `pg` (or a query builder like `knex`/ORM like `Prisma` - please use raw `pg` with parameterized queries for transparency), `bcrypt` for passwords, and `jsonwebtoken` for authentication.

Please implement the following modules and their respective controllers/routes:

### 1. Authentication & User Management (`/api/auth` and `/api/users`)
* **POST `/api/auth/register`**: Register a new user (hash password).
* **POST `/api/auth/login`**: Authenticate user, check roles, and return a JWT containing user ID and role.
* **DELETE `/api/users/:id`**: Delete a user account. Middleware must ensure **ONLY** users with the 'admin' role can access this endpoint.

### 2. Class Management (`/api/classes`)
* **Teacher CRUD Operations** (Middleware: Must be 'teacher' role):
    * **POST `/api/classes`**: Create a new class (automatically assign `teacher_id` from JWT payload).
    * **GET `/api/classes`**: List all classes created by the requesting teacher.
    * **PUT `/api/classes/:id`**: Update class details (validate ownership).
    * **DELETE `/api/classes/:id`**: Delete a class (validate ownership).
* **Student Operations**:
    * **POST `/api/classes/:id/join`**: Allow a student (from JWT payload) to join a specific class. Add record to `class_members`.
* **Teacher Operations on Members**:
    * **POST `/api/classes/:id/members`**: Allow a teacher to add a student to their class using the student's ID. Validate that the requesting teacher owns the class.

# Expected Output Format
1. The full `init.sql` file.
2. The middleware code for JWT authentication and Role-Based Access Control (RBAC).
3. The Express route and controller code for Authentication.
4. The Express route and controller code for Class Management.
Keep the code modular, handle errors gracefully (e.g., duplicate emails, unauthorized access), and include brief comments explaining the logic.