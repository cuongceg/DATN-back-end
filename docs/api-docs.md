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

Join session và lấy LiveKit token.

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
			"session_id": "uuid",
			"sender_id": "uuid",
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

## 5) Error chung

- Endpoint không tồn tại:
	- `404 { "message": "Route not found." }`
- Lỗi hệ thống chưa xử lý riêng:
	- `500 { "message": "Internal server error." }`

