# API Documentation

## 1) Tổng quan

- Base path: `/api`
- Content-Type request body: `application/json`
- API docs runtime:
	- `GET /api-docs` (Swagger UI)
	- `GET /api-docs.json` (OpenAPI JSON)

## 2) Authentication

Các endpoint cần đăng nhập sử dụng header:

```http
Authorization: Bearer <jwt_token>
```

Nếu thiếu/không hợp lệ token:

- `401 { "message": "Authorization token is required." }`
- `401 { "message": "Invalid or expired token." }`

Nếu không đủ quyền role:

- `403 { "message": "Forbidden: insufficient permissions." }`

## 3) Roles

- `admin`
- `teacher`
- `student`

## 4) Endpoints

### 4.1 Auth

#### POST `/api/auth/register`

Đăng ký tài khoản.

- Public: Không cần token
- Body:

```json
{
	"role": "student",
	"full_name": "Nguyen Van A",
	"email": "a@example.com",
	"password": "123456"
}
```

- Validation:
	- Bắt buộc: `role`, `full_name`, `email`, `password`
	- `role` chỉ nhận: `admin | teacher | student`

- Success:
	- `201`

```json
{
	"message": "User registered successfully.",
	"user": {
		"id": "uuid",
		"role": "student",
		"full_name": "Nguyen Van A",
		"email": "a@example.com"
	}
}
```

- Error:
	- `400 { "message": "role, full_name, email, and password are required." }`
	- `400 { "message": "Invalid role." }`
	- `409 { "message": "Email already exists." }`

#### POST `/api/auth/login`

Đăng nhập.

- Public: Không cần token
- Body:

```json
{
	"email": "a@example.com",
	"password": "123456"
}
```

- Success:
	- `200`

```json
{
	"message": "Login successful.",
	"token": "jwt_token",
	"user": {
		"id": "uuid",
		"role": "student",
		"full_name": "Nguyen Van A",
		"email": "a@example.com"
	}
}
```

- Error:
	- `400 { "message": "email and password are required." }`
	- `401 { "message": "Invalid email or password." }`

---

### 4.2 Users

#### GET `/api/users/search?query=<keyword>`

Tìm user theo `full_name` (không trả admin, không trả chính user đang đăng nhập).

- Auth: Bắt buộc token
- Roles: Tất cả role đã đăng nhập
- Query params:
	- `query` (ưu tiên)
	- hoặc `full_name`

- Success:
	- `200`

```json
{
	"users": [
		{
			"id": "uuid",
			"role": "student",
			"full_name": "Nguyen Van B",
			"email": "b@example.com"
		}
	]
}
```

- Error:
	- `400 { "message": "query is required." }`

#### DELETE `/api/users/:id`

Xóa user theo id.

- Auth: Bắt buộc token
- Roles: `admin`
- Path params:
	- `id`: user id (uuid)

- Success:
	- `200`

```json
{
	"message": "User deleted successfully.",
	"user": {
		"id": "uuid",
		"email": "user@example.com",
		"role": "student"
	}
}
```

- Error:
	- `404 { "message": "User not found." }`

---

### 4.3 Classes

#### POST `/api/classes`

Tạo lớp học.

- Auth: Bắt buộc token
- Roles: `teacher`
- Body:

```json
{
	"name": "Lop Toan 10A",
	"description": "On tap hoc ky 1"
}
```

- Success:
	- `201`

```json
{
	"message": "Class created successfully.",
	"class": {
		"id": "uuid",
		"teacher_id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A",
		"description": "On tap hoc ky 1",
		"status": "active",
		"created_at": "2026-04-25T10:00:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "Class name is required." }`
	- `500 { "message": "Could not generate unique class code. Please try again." }`

#### GET `/api/classes`

Danh sách lớp theo role:

- `teacher`: lớp do giáo viên tạo
- `student`: lớp đã tham gia
- `admin`: toàn bộ lớp

- Auth: Bắt buộc token
- Roles: tất cả role đã đăng nhập

- Success:
	- `200`

```json
{
	"classes": [
		{
			"id": "uuid",
			"teacher_id": "uuid",
			"class_code": "AB12CD",
			"name": "Lop Toan 10A",
			"description": "On tap",
			"status": "active",
			"student_count": "2",
			"created_at": "2026-04-25T10:00:00.000Z"
		}
	]
}
```

Ghi chú: với role `student`, mỗi phần tử có thêm `permission`, `joined_at`, `student_count`.

#### GET `/api/classes/:id`

Chi tiết lớp và danh sách thành viên.

- Auth: Bắt buộc token
- Roles: tất cả role đã đăng nhập
- Điều kiện truy cập:
	- `teacher` chỉ xem được lớp do mình sở hữu
	- `student` chỉ xem được lớp mình là thành viên
	- `admin` xem được mọi lớp

- Success:
	- `200`

```json
{
	"class": {
		"id": "uuid",
		"teacher_id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A",
		"description": "On tap",
		"status": "active",
		"created_at": "2026-04-25T10:00:00.000Z"
	},
	"members": [
		{
			"user_id": "uuid",
			"full_name": "Nguyen Van B",
			"email": "b@example.com",
			"role": "student",
			"permission": "Member",
			"joined_at": "2026-04-25T10:05:00.000Z"
		}
	],
	"total_members": 1
}
```

- Error:
	- `404 { "message": "Class not found." }`
	- `403 { "message": "Forbidden: you cannot view this class." }`
	- `403 { "message": "Forbidden: you are not a member of this class." }`

#### PUT `/api/classes/:id`

Cập nhật thông tin lớp.

- Auth: Bắt buộc token
- Roles: `teacher`
- Body (ít nhất 1 field):

```json
{
	"name": "Lop Toan 10A - cap nhat",
	"description": "Noi dung moi"
}
```

- Success:
	- `200`

```json
{
	"message": "Class updated successfully.",
	"class": {
		"id": "uuid",
		"teacher_id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A - cap nhat",
		"description": "Noi dung moi",
		"status": "active",
		"created_at": "2026-04-25T10:00:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "At least one field (name, description) is required." }`
	- `404 { "message": "Class not found or you do not own this class." }`

#### PATCH `/api/classes/:id/archive`

Archive lớp (active → archived).

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Class archived successfully.",
	"class": {
		"id": "uuid",
		"teacher_id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A",
		"description": "On tap",
		"status": "archived",
		"created_at": "2026-04-25T10:00:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "id must be a valid UUID." }`
	- `404 { "message": "Class not found or you do not own this class." }`
	- `409 { "message": "Only active classes can be archived." }`

#### PATCH `/api/classes/:id/activate`

Active lại lớp (archived → active).

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Class activated successfully.",
	"class": {
		"id": "uuid",
		"teacher_id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A",
		"description": "On tap",
		"status": "active",
		"created_at": "2026-04-25T10:00:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "id must be a valid UUID." }`
	- `404 { "message": "Class not found or you do not own this class." }`
	- `409 { "message": "Only archived classes can be activated." }`

#### DELETE `/api/classes/:id`

Xóa lớp.

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Class deleted successfully.",
	"class": {
		"id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A"
	}
}
```

- Error:
	- `404 { "message": "Class not found or you do not own this class." }`

#### POST `/api/classes/join`

Sinh viên tham gia lớp bằng mã lớp.

- Auth: Bắt buộc token
- Roles: `student`
- Body:

```json
{
	"class_code": "AB12CD"
}
```

- Validation:
	- Bắt buộc `class_code`
	- Định dạng: 6 ký tự chữ hoa/số (`^[A-Z0-9]{6}$`)

- Success:
	- `201`

```json
{
	"message": "Joined class successfully.",
	"class": {
		"id": "uuid",
		"teacher_id": "uuid",
		"class_code": "AB12CD",
		"name": "Lop Toan 10A",
		"description": "On tap",
		"status": "active",
		"created_at": "2026-04-25T10:00:00.000Z"
	},
	"membership": {
		"class_id": "uuid",
		"student_id": "uuid",
		"permission": "Member",
		"joined_at": "2026-04-25T10:05:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "class_code is required." }`
	- `400 { "message": "class_code must be 6 uppercase letters/numbers." }`
	- `404 { "message": "Class not found." }`
	- `409 { "message": "Student already joined this class." }`

#### POST `/api/classes/:id/members`

Thêm 1 student vào lớp.

- Auth: Bắt buộc token
- Roles: `teacher`
- Body:

```json
{
	"student_id": "uuid",
	"permission": "Member"
}
```

- `permission` cho phép: `Member | Owner` (mặc định `Member`)

- Success:
	- `201`

```json
{
	"message": "Student added to class successfully.",
	"membership": {
		"class_id": "uuid",
		"student_id": "uuid",
		"permission": "Member",
		"joined_at": "2026-04-25T10:05:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "student_id is required." }`
	- `400 { "message": "Invalid permission. Allowed values: Member, Owner." }`
	- `400 { "message": "Provided user is not a student." }`
	- `404 { "message": "Class not found or you do not own this class." }`
	- `404 { "message": "Student not found." }`
	- `409 { "message": "Student is already a member of this class." }`

#### POST `/api/classes/:id/members/bulk`

Thêm nhiều thành viên vào lớp (upsert theo `class_id + student_id`).

- Auth: Bắt buộc token
- Roles: `teacher`
- Body:

```json
{
	"members": [
		{ "student_id": "uuid-1", "permission": "Member" },
		{ "student_id": "uuid-2", "permission": "Owner" }
	]
}
```

- Validation:
	- `members` là mảng không rỗng
	- Mỗi phần tử bắt buộc có `student_id`
	- Không cho phép trùng `student_id` trong cùng request
	- `permission`: `Member | Owner`

- Success:
	- `201`

```json
{
	"message": "Members added successfully.",
	"members": [
		{
			"class_id": "uuid",
			"student_id": "uuid-1",
			"permission": "Member",
			"joined_at": "2026-04-25T10:05:00.000Z"
		},
		{
			"class_id": "uuid",
			"student_id": "uuid-2",
			"permission": "Owner",
			"joined_at": "2026-04-25T10:05:01.000Z"
		}
	]
}
```

- Error:
	- `400 { "message": "members must be a non-empty array." }`
	- `400 { "message": "Each member must include student_id." }`
	- `400 { "message": "Invalid permission. Allowed values: Member, Owner." }`
	- `400 { "message": "members contains duplicate student_id values." }`
	- `400 { "message": "Some members are invalid.", "details": { "not_found_student_ids": [...], "non_student_user_ids": [...] } }`
	- `404 { "message": "Class not found or you do not own this class." }`

#### PATCH `/api/classes/:id/members/:userId/role`

Cập nhật quyền thành viên trong lớp.

- Auth: Bắt buộc token
- Roles: `teacher`
- Body:

```json
{
	"role": "Owner"
}
```

- `role` cho phép: `Member | Owner`

- Success:
	- `200`

```json
{
	"message": "Member role updated successfully.",
	"membership": {
		"class_id": "uuid",
		"student_id": "uuid",
		"permission": "Owner",
		"joined_at": "2026-04-25T10:05:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "role is required." }`
	- `400 { "message": "Invalid role. Allowed values: Member, Owner." }`
	- `404 { "message": "Class not found or you do not own this class." }`
	- `404 { "message": "Member not found in this class." }`

#### DELETE `/api/classes/:id/members/:userId`

Xóa thành viên khỏi lớp.

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Member removed successfully.",
	"membership": {
		"class_id": "uuid",
		"student_id": "uuid",
		"permission": "Member"
	}
}
```

- Error:
	- `404 { "message": "Class not found or you do not own this class." }`
	- `404 { "message": "Member not found in this class." }`

---

### 4.4 Sessions (Meetings)

#### POST `/api/sessions`

Tạo session mới.

- Auth: Bắt buộc token
- Roles: `teacher`
- Body:

```json
{
	"classId": "uuid",
	"title": "Buoi hoc 1",
	"scheduledAt": "2026-05-05T08:00:00.000Z",
	"scheduledEndAt": "2026-05-05T09:30:00.000Z"
}
```

- Validation:
	- `classId`: UUID hợp lệ
	- `title`: required
	- `scheduledAt`: ISO date (optional)
	- `scheduledEndAt`: ISO date (optional, nếu có cả 2 thì `scheduledEndAt > scheduledAt`)

- Success:
	- `201`

```json
{
	"message": "Session created successfully.",
	"session": {
		"id": "uuid",
		"class_id": "uuid",
		"livekit_room_id": null,
		"title": "Buoi hoc 1",
		"scheduled_at": "2026-05-05T08:00:00.000Z",
		"scheduled_end_at": "2026-05-05T09:30:00.000Z",
		"start_time": null,
		"end_time": null,
		"status": "scheduled"
	}
}
```

- Error:
	- `400 { "message": "classId must be a valid UUID." }`
	- `400 { "message": "title is required." }`
	- `403 { "message": "Only teachers can create sessions." }`
	- `403 { "message": "You do not have permission to create a session for this class." }`

#### GET `/api/sessions/class/:classId`

Lấy danh sách session của 1 lớp.

- Auth: Bắt buộc token
- Roles: tất cả role đã đăng nhập

- Success:
	- `200`

```json
{
	"sessions": [
		{
			"id": "uuid",
			"class_id": "uuid",
			"livekit_room_id": null,
			"title": "Buoi hoc 1",
			"scheduled_at": "2026-05-05T08:00:00.000Z",
			"scheduled_end_at": "2026-05-05T09:30:00.000Z",
			"start_time": null,
			"end_time": null,
			"status": "scheduled"
		}
	]
}
```

#### GET `/api/sessions/:sessionId`

Lấy chi tiết 1 session.

- Auth: Bắt buộc token
- Roles: tất cả role đã đăng nhập

- Success:
	- `200`

```json
{
	"session": {
		"id": "uuid",
		"class_id": "uuid",
		"livekit_room_id": "uuid",
		"title": "Buoi hoc 1",
		"scheduled_at": "2026-05-05T08:00:00.000Z",
		"scheduled_end_at": "2026-05-05T09:30:00.000Z",
		"start_time": "2026-05-05T08:00:00.000Z",
		"end_time": null,
		"status": "ongoing"
	}
}
```

- Error:
	- `404 { "message": "Session not found." }`

#### GET `/api/sessions/my?from=<ISO>&to=<ISO>`

Lấy tất cả sessions theo date range để hiển thị calendar.

- Auth: Bắt buộc token
- Roles: tất cả role đã đăng nhập
- Query params:
	- `from`: ISO date (bắt buộc)
	- `to`: ISO date (bắt buộc)

- Success:
	- `200`

```json
{
	"sessions": [
		{
			"id": "uuid",
			"class_id": "uuid",
			"class_name": "Lop Toan 10A",
			"title": "Buoi hoc 1",
			"scheduled_at": "2026-05-05T08:00:00.000Z",
			"scheduled_end_at": "2026-05-05T09:30:00.000Z",
			"start_time": null,
			"end_time": null,
			"status": "scheduled"
		}
	]
}
```

- Error:
	- `400 { "message": "from and to are required." }`
	- `400 { "message": "from must be a valid ISO date." }`
	- `400 { "message": "to must be a valid ISO date." }`

#### PATCH `/api/sessions/:sessionId`

Cập nhật lịch session (title / scheduledAt). Teacher sở hữu lớp mới được update.

- Auth: Bắt buộc token
- Roles: `teacher`
- Body (ít nhất 1 field):

```json
{
	"title": "Buoi hoc 1 - cap nhat",
	"scheduledAt": "2026-05-06T08:00:00.000Z",
	"scheduledEndAt": "2026-05-06T09:30:00.000Z"
}
```

- Success:
	- `200`

```json
{
	"session": {
		"id": "uuid",
		"class_id": "uuid",
		"livekit_room_id": null,
		"title": "Buoi hoc 1 - cap nhat",
		"scheduled_at": "2026-05-06T08:00:00.000Z",
		"scheduled_end_at": "2026-05-06T09:30:00.000Z",
		"start_time": null,
		"end_time": null,
		"status": "scheduled"
	}
}
```

- Error:
	- `400 { "message": "At least one field (title, scheduledAt) is required." }`
	- `400 { "message": "Cannot reschedule a session that is already ongoing or completed." }`
	- `403 { "message": "You do not have permission to update this session." }`
	- `404 { "message": "Session not found." }`

#### DELETE `/api/sessions/:sessionId`

Xóa session (chỉ xóa được session có status `scheduled`). Teacher sở hữu lớp mới được xóa.

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Session deleted successfully.",
	"session": {
		"id": "uuid",
		"title": "Buoi hoc 1"
	}
}
```

- Error:
	- `400 { "message": "Only scheduled sessions can be deleted." }`
	- `403 { "message": "You do not have permission to delete this session." }`
	- `404 { "message": "Session not found." }`

#### PATCH `/api/sessions/:sessionId/start`

Start session (scheduled → ongoing). Teacher của lớp mới được start.

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Session started successfully.",
	"session": {
		"id": "uuid",
		"class_id": "uuid",
		"livekit_room_id": "uuid",
		"title": "Buoi hoc 1",
		"scheduled_at": "2026-05-05T08:00:00.000Z",
		"scheduled_end_at": "2026-05-05T09:30:00.000Z",
		"start_time": "2026-05-05T08:00:00.000Z",
		"end_time": null,
		"status": "ongoing"
	}
}
```

- Error:
	- `400 { "message": "Unable to start session." }`
	- `403 { "message": "Only teachers can start sessions." }`

#### PATCH `/api/sessions/:sessionId/end`

End session (ongoing → completed). Teacher của lớp mới được end.

- Auth: Bắt buộc token
- Roles: `teacher`

- Success:
	- `200`

```json
{
	"message": "Session ended successfully.",
	"session": {
		"id": "uuid",
		"class_id": "uuid",
		"livekit_room_id": "uuid",
		"title": "Buoi hoc 1",
		"scheduled_at": "2026-05-05T08:00:00.000Z",
		"scheduled_end_at": "2026-05-05T09:30:00.000Z",
		"start_time": "2026-05-05T08:00:00.000Z",
		"end_time": "2026-05-05T09:30:00.000Z",
		"status": "completed"
	}
}
```

- Error:
	- `400 { "message": "Unable to end session." }`
	- `403 { "message": "Only teachers can end sessions." }`

#### POST `/api/sessions/:sessionId/token`

Join session và lấy LiveKit token (ghi nhận participant join session).

- Auth: Bắt buộc token
- Roles: teacher + student thuộc lớp

- Success:
	- `200`

```json
{
	"token": "<livekit_jwt>",
	"livekit_url": "wss://dev-monitor.id.vn",
	"room_name": "uuid"
}
```

- Error:
	- `400 { "message": "Session has not started yet." }`
	- `400 { "message": "Session has already ended." }`
	- `403 { "message": "You are not a member of this class." }`
	- `404 { "message": "Session not found." }`
	- `404 { "message": "User not found." }`

#### GET `/api/sessions/:sessionId/participants`

Lấy danh sách participants của session.

- Auth: Bắt buộc token
- Roles: teacher + student thuộc lớp + admin

- Success:
	- `200`

```json
{
	"session_id": "uuid",
	"total_count": 2,
	"participants": [
		{
			"user_id": "uuid",
			"full_name": "Nguyen Van A",
			"role": "teacher",
			"joined_at": "2026-05-05T08:00:10.000Z",
			"left_at": null,
			"is_online": true
		},
		{
			"user_id": "uuid",
			"full_name": "Tran Thi B",
			"role": "student",
			"joined_at": "2026-05-05T08:01:30.000Z",
			"left_at": "2026-05-05T08:45:00.000Z",
			"is_online": false
		}
	]
}
```

- Error:
	- `403 { "message": "You are not a member of this class." }`
	- `404 { "message": "Session not found." }`

#### PATCH `/api/sessions/:sessionId/leave`

Roi session (cap nhat left_at).

- Auth: Bắt buộc token
- Roles: teacher + student thuộc lớp + admin

- Success:
	- `200`

```json
{
	"message": "Left session successfully.",
	"participant": {
		"session_id": "uuid",
		"user_id": "uuid",
		"joined_at": "2026-05-05T08:01:30.000Z",
		"left_at": "2026-05-05T08:45:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "You have not joined this session." }`
	- `400 { "message": "You have already left this session." }`
	- `403 { "message": "You are not a member of this class." }`
	- `404 { "message": "Session not found." }`

#### GET `/api/sessions/:sessionId/messages`

Lấy tin nhắn của session (pagination).

- Auth: Bắt buộc token
- Roles: teacher + student thuộc lớp
- Query params:
	- `limit` (default: 20)
	- `offset` (default: 0)

- Success:
	- `200`

```json
{
	"messages": [
		{
			"id": "uuid",
			"sender_name": "Nguyen Van A",
			"content": "Xin chao",
			"timestamp": "2026-05-05T08:05:00.000Z"
		}
	]
}
```

- Error:
	- `403 { "message": "You are not a member of this class." }`
	- `404 { "message": "Session not found." }`

#### POST `/api/sessions/:sessionId/messages`

Gửi tin nhắn trong session (session phải `ongoing`).

- Auth: Bắt buộc token
- Roles: teacher + student thuộc lớp
- Body:

```json
{
	"content": "Xin chao"
}
```

- Validation:
	- `content`: required, non-empty

- Success:
	- `201`

```json
{
	"message": "Message sent successfully.",
	"message_data": {
		"id": "uuid",
		"session_id": "uuid",
		"sender_id": "uuid",
		"content": "Xin chao",
		"timestamp": "2026-05-05T08:05:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "content is required." }`
	- `400 { "message": "Session is not ongoing." }`
	- `403 { "message": "You are not a member of this class." }`
	- `404 { "message": "Session not found." }`

---

### 4.5 Posts

#### GET `/api/posts/class/:classId`

Lấy danh sách posts theo lớp (pagination).

- Auth: Bắt buộc token
- Roles: `teacher` (owner) hoặc `student` là thành viên
- Query params:
	- `limit` (default: 20, max: 100)
	- `offset` (default: 0)

- Success:
	- `200`

```json
{
	"posts": [
		{
			"id": "uuid",
			"type": "normal",
			"title": "Thong bao",
			"body_delta": { "ops": [] },
			"body_plain": "Noi dung",
			"author_id": "uuid",
			"author_name": "Nguyen Van A",
			"session_id": null,
			"session_title": null,
			"session_status": null,
			"session_scheduled_at": null,
			"created_at": "2026-05-01T10:00:00.000Z",
			"updated_at": "2026-05-01T10:00:00.000Z"
		}
	],
	"total_count": 15,
	"limit": 20,
	"offset": 0
}
```

- Error:
	- `403 { "message": "You do not have permission to access this class." }`
	- `404 { "message": "Class not found." }`

#### GET `/api/posts/:postId`

Lấy chi tiết 1 post.

- Auth: Bắt buộc token
- Roles: teacher owner hoặc student member

- Success:
	- `200`

```json
{
	"post": {
		"id": "uuid",
		"type": "normal",
		"title": "Thong bao",
		"body_delta": { "ops": [] },
		"body_plain": "Noi dung",
		"author_id": "uuid",
		"author_name": "Nguyen Van A",
		"session_id": null,
		"session_title": null,
		"session_status": null,
		"session_scheduled_at": null,
		"created_at": "2026-05-01T10:00:00.000Z",
		"updated_at": "2026-05-01T10:00:00.000Z"
	}
}
```

- Error:
	- `403 { "message": "You do not have permission to access this class." }`
	- `404 { "message": "Post not found." }`

#### POST `/api/posts`

Tao post normal.

- Auth: Bắt buộc token
- Roles: teacher owner hoặc student member
- Body:

```json
{
	"classId": "uuid",
	"title": "Thong bao",
	"bodyDelta": { "ops": [{ "insert": "Noi dung" }] },
	"bodyPlain": "Noi dung"
}
```

- Validation:
	- `classId`: UUID bat buoc
	- `bodyDelta` hoac `bodyPlain`: bat buoc it nhat 1 truong
	- `title`: optional, max 500 ky tu

- Success:
	- `201`

```json
{
	"message": "Post created successfully.",
	"post": {
		"id": "uuid",
		"type": "normal",
		"title": "Thong bao",
		"body_delta": { "ops": [] },
		"body_plain": "Noi dung",
		"author_id": "uuid",
		"author_name": "Nguyen Van A",
		"created_at": "2026-05-01T10:00:00.000Z",
		"updated_at": "2026-05-01T10:00:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "bodyDelta or bodyPlain is required." }`
	- `403 { "message": "You do not have permission to access this class." }`
	- `404 { "message": "Class not found." }`

#### PATCH `/api/posts/:postId`

Cap nhat post (chi author).

- Auth: Bắt buộc token
- Roles: `teacher`/`student` (author)
- Body (it nhat 1 field): `title`, `bodyDelta`, `bodyPlain`

- Success:
	- `200`

```json
{
	"message": "Post updated successfully.",
	"post": {
		"id": "uuid",
		"type": "normal",
		"title": "Thong bao moi",
		"body_delta": { "ops": [] },
		"body_plain": "Noi dung moi",
		"author_id": "uuid",
		"author_name": "Nguyen Van A",
		"created_at": "2026-05-01T10:00:00.000Z",
		"updated_at": "2026-05-01T11:00:00.000Z"
	}
}
```

- Error:
	- `400 { "message": "Session posts cannot be updated." }`
	- `403 { "message": "You do not have permission to update this post." }`
	- `404 { "message": "Post not found." }`

#### DELETE `/api/posts/:postId`

Xoa post (author hoac teacher owner).

- Auth: Bắt buộc token
- Roles: teacher owner hoặc author

- Success:
	- `200`

```json
{
	"message": "Post deleted successfully.",
	"post": { "id": "uuid" }
}
```

- Error:
	- `400 { "message": "Session posts cannot be deleted." }`
	- `403 { "message": "You do not have permission to delete this post." }`
	- `404 { "message": "Post not found." }`

---

### 4.6 Files

Files feature được thiết kế theo folder tree thuần (không còn category). Tất cả thao tác dùng `path` dạng POSIX bắt đầu bằng `/`.

#### POST `/api/files/class/:classId/content`

Teacher only. Tạo folder hoặc upload file tùy theo `type`.

- Auth: Bắt buộc token
- Roles: teacher owner
- `type`:
	- `folder`: có thể gửi JSON hoặc `multipart/form-data`
	- `file`: bắt buộc `multipart/form-data`

**Tạo folder (JSON)**

```json
{ "type": "folder", "path": "/lecture-notes/slides" }
```

**Upload file (`multipart/form-data`)**

- Fields:
	- `type`: `file`
	- `path`: full path tới file, ví dụ `/lecture-notes/chapter1.pdf`
	- `file`: binary

- Success `201` (folder):

```json
{ "message": "Folder created successfully.", "folder": { "id": "uuid", "path": "/lecture-notes/slides", "name": "slides", "created_at": "2026-05-01T10:00:00.000Z" } }
```

- Success `201` (file):

```json
{ "message": "File uploaded successfully.", "file": { "id": "uuid", "path": "/lecture-notes/chapter1.pdf", "original_name": "chapter1.pdf", "mime_type": "application/pdf", "size_bytes": 204800, "created_at": "2026-05-01T10:00:00.000Z" } }
```

- Error:
	- `400` thiếu field hoặc `path` không hợp lệ
	- `403` không phải teacher owner của lớp
	- `409` `path` đã tồn tại
	- `413` file > 50MB

#### GET `/api/files/class/:classId/content?path=/`

Teacher hoặc student là thành viên lớp. Trả về list items (folders + files) tại `path` (không recursive).

- Auth: Bắt buộc token
- Roles: teacher owner hoặc student member
- Query:
	- `path` (optional, default `/`)

- Success `200`:

```json
{
	"path": "/lecture-notes/",
	"items": [
		{ "id": "uuid", "type": "folder", "name": "slides", "path": "/lecture-notes/slides", "created_at": "2026-05-01T10:00:00.000Z", "created_by_name": "Nguyen Van A" },
		{ "id": "uuid", "type": "file", "name": "chapter1.pdf", "path": "/lecture-notes/chapter1.pdf", "mime_type": "application/pdf", "size_bytes": 204800, "created_at": "2026-05-01T10:00:00.000Z", "created_by_name": "Nguyen Van A" }
	]
}
```

- Error:
	- `403` không có quyền
	- `404` `path` không tồn tại

#### GET `/api/files/class/:classId/download?path=/lecture-notes/chapter1.pdf`

Teacher hoặc student là thành viên lớp. Trả về presigned URL từ MinIO (expiry 1 giờ).

- Auth: Bắt buộc token
- Roles: teacher owner hoặc student member
- Query:
	- `path` (required, full file path)

- Success `200`:

```json
{ "download_url": "http://localhost:9000/class-files/...?X-Amz-Signature=...", "expires_in_seconds": 3600 }
```

- Error:
	- `403` không có quyền
	- `404` file không tồn tại tại path

#### DELETE `/api/files/class/:classId/content?path=/...`

Chỉ `created_by = req.user.id` mới xóa được (áp dụng cả file lẫn folder).

- Auth: Bắt buộc token
- Roles: teacher owner hoặc student member (nhưng vẫn bị chặn nếu không phải người tạo)
- Query:
	- `path` (required)

- Success `200`:

```json
{ "message": "Deleted successfully." }
```

- Error:
	- `400` folder không rỗng
	- `403` không phải người tạo
	- `404` path không tồn tại
	- `500` MinIO lỗi khi xóa file

---

### 4.7 Recordings

Recording chỉ áp dụng cho session đang `ongoing`. Teacher (owner) có thể start/stop, teacher owner hoặc student member có thể xem list recordings đã `completed`.

#### POST `/api/sessions/:sessionId/recordings/start`

Start recording cho session.

- Auth: Bắt buộc token
- Roles: teacher owner
- Body: none

- Success:
	- `201`

```json
{
	"message": "Recording started successfully.",
	"recording": {
		"id": "uuid",
		"egress_id": "EG_xxx",
		"started_at": "2026-05-22T10:00:00.000Z"
	}
}
```

- Error:
	- `400` session không phải `ongoing`
	- `403` không phải teacher owner
	- `409` đã có recording đang chạy

#### POST `/api/sessions/:sessionId/recordings/stop`

Stop recording theo `egress_id`.

- Auth: Bắt buộc token
- Roles: teacher owner
- Body:

```json
{ "egress_id": "EG_xxx" }
```

- Success:
	- `200`

```json
{
	"message": "Recording stopped.",
	"recording": {
		"egress_id": "EG_xxx",
		"status": "stopping"
	}
}
```

- Error:
	- `400` thiếu `egress_id`
	- `403` không phải teacher owner
	- `404` egressId không tồn tại hoặc không thuộc session

#### GET `/api/classes/:classId/recordings`

Danh sách recordings đã `completed` cho class (kèm presigned URL từ MinIO, TTL 4 giờ).

- Auth: Bắt buộc token
- Roles: teacher owner hoặc student member

- Success:
	- `200`

```json
{
	"recordings": [
		{
			"id": "uuid",
			"session_id": "uuid",
			"egress_id": "EG_xxx",
			"duration_seconds": 3600,
			"started_at": "2026-05-22T10:00:00.000Z",
			"ended_at": "2026-05-22T11:00:00.000Z",
			"download_url": "http://localhost:9000/session-recordings/...?X-Amz-Signature=...",
			"expires_in_seconds": 14400
		}
	]
}
```

- Error:
	- `403` không có quyền truy cập class
	- `404` class không tồn tại

---

### 4.8 Suggestions

#### GET `/api/suggestions?q=<text>&topic=<topic>&limit=5`

Gợi ý câu hỏi (Fuse.js search, in-process).

- Auth: Bắt buộc token
- Roles: tất cả role đã đăng nhập
- Query params:
	- `q` (required): string, sau trim phải có length >= 2
	- `topic` (optional): nếu hợp lệ thì filter theo topic, nếu không hợp lệ/không có thì bỏ qua
		- Allowed: `ip | ipv4 | classful | cidr | subnet | ipv6`
	- `limit` (optional): default 5, max 10

- Success:
	- `200`

```json
{
	"results": [
		{ "id": "0001", "q": "IP là gì?", "topic": "ip" }
	],
	"latency_ms": 2.1
}
```

- Error:
	- `400 { "message": "q is required." }`
	- `400 { "message": "q must be at least 2 characters." }`
	- `401 { "message": "Authorization token is required." }`
	- `401 { "message": "Invalid or expired token." }`

	---

	### 4.9 Reactions

	Reactions dùng để lưu trạng thái reaction hiện tại của mỗi participant trong 1 session.

	- Mỗi user trong session chỉ có tối đa 1 reaction active tại một thời điểm.
	- Allowed types: `raise_hand | agree | repeat | pause | confused`

	#### POST `/api/sessions/:sessionId/reactions`

	Set/update reaction của user hiện tại trong session (session phải đang `ongoing`).

	- Auth: Bắt buộc token
	- Roles: teacher của session hoặc participant của session
	- Path params:
		- `sessionId`: UUID
	- Body:

	```json
	{ "type": "raise_hand" }
	```

	- Success:
		- `201`

	```json
	{
		"reaction": {
			"session_id": "uuid",
			"user_id": "uuid",
			"type": "raise_hand",
			"raised_at": "2026-05-25T10:00:00.000Z"
		}
	}
	```

	- Error:
		- `400 { "message": "sessionId must be a valid UUID." }`
		- `400 { "message": "type must be one of: raise_hand, agree, repeat, pause, confused." }`
		- `400 { "message": "Session is not ongoing." }`
		- `401 { "message": "Authorization token is required." }`
		- `401 { "message": "Invalid or expired token." }`
		- `403 { "message": "You do not have permission to access this session." }`
		- `404 { "message": "Session not found." }`

	#### DELETE `/api/sessions/:sessionId/reactions`

	Clear reaction hiện tại của user trong session (idempotent).

	- Auth: Bắt buộc token
	- Roles: teacher của session hoặc participant của session
	- Path params:
		- `sessionId`: UUID

	- Success:
		- `200`

	```json
	{ "message": "Reaction cleared." }
	```

	- Error:
		- `400 { "message": "sessionId must be a valid UUID." }`
		- `401 { "message": "Authorization token is required." }`
		- `401 { "message": "Invalid or expired token." }`
		- `403 { "message": "You do not have permission to access this session." }`
		- `404 { "message": "Session not found." }`

	#### GET `/api/sessions/:sessionId/reactions`

	List reactions hiện tại trong session.

	- Auth: Bắt buộc token
	- Roles: `teacher`
	- Path params:
		- `sessionId`: UUID

	- Success:
		- `200`

	```json
	{
		"reactions": [
			{
				"session_id": "uuid",
				"user_id": "uuid",
				"type": "raise_hand",
				"raised_at": "2026-05-25T10:00:00.000Z",
				"full_name": "Nguyen Van A"
			}
		],
		"raise_hand_count": 1
	}
	```

	- Error:
		- `400 { "message": "sessionId must be a valid UUID." }`
		- `401 { "message": "Authorization token is required." }`
		- `401 { "message": "Invalid or expired token." }`
		- `403 { "message": "Only teachers can list reactions." }`
		- `403 { "message": "You do not have permission to access this session." }`
		- `404 { "message": "Session not found." }`

## 5) Error chung

- Endpoint không tồn tại:
	- `404 { "message": "Route not found." }`
- Lỗi hệ thống chưa xử lý riêng:
	- `500 { "message": "Internal server error." }`

