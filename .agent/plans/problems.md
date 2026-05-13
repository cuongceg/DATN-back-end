There has some bugs, I need you to improve it:
- Firsly, in api endpoint /api/sessions/{sessionId}/messages I think you should retun senderName instead of senderId and you don't need to return the session id
- Secondly, on the db there's no way to know how many person in sessions and their information


# Task 1 — Backend: Session Participants

## Mục tiêu
Thêm tính năng track người tham gia meeting vào hệ thống.
Gồm 3 phần: DB migration, sửa API `/token`, thêm 2 API mới.

---

## Bước 1 — DB Migration

Tạo file migration mới (đặt cạnh `init.sql` hoặc theo convention migration hiện tại của project).

**Tên file gợi ý:** `002_add_session_participants.sql`

```sql
CREATE TABLE IF NOT EXISTS session_participants (
    session_id  UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at     TIMESTAMPTZ,
    PRIMARY KEY (session_id, user_id),
    CONSTRAINT fk_sp_session
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session_id
    ON session_participants(session_id);

CREATE INDEX IF NOT EXISTS idx_session_participants_user_id
    ON session_participants(user_id);
```

**Lưu ý:** Chạy migration này trên DB trước khi deploy code.

---

## Bước 2 — Đọc codebase trước khi code

Trước khi viết bất kỳ dòng code nào, hãy đọc các file sau:
- src/controllers/sesion.controller.js
- src/services/session.service.js
- src/routes/session.routes.js
- src/config/livekit.js 
- src/config/db.js 

Đọc toàn bộ các file tìm được trước khi tiếp tục.

---

## Bước 3 — Sửa handler `/api/sessions/:sessionId/token`

Tìm file đang xử lý endpoint `POST /api/sessions/:sessionId/token`.

Sau đoạn code generate LiveKit token thành công, **thêm đoạn upsert sau** (không thay đổi bất kỳ logic nào khác, không thay đổi response):

```js
// Upsert participant — ghi nhận user đã join session
await pool.query(
  `INSERT INTO session_participants (session_id, user_id, joined_at, left_at)
   VALUES ($1, $2, NOW(), NULL)
   ON CONFLICT (session_id, user_id)
   DO UPDATE SET joined_at = NOW(), left_at = NULL`,
  [sessionId, userId]
);
```

> `pool` là db client hiện tại của project — thay tên biến cho đúng với codebase.
> Nếu project dùng ORM, viết lại query tương đương bằng ORM đó.

**Không thay đổi response shape của `/token`.**

---

## Bước 4 — Thêm `GET /api/sessions/:sessionId/participants`

### 4.1 — Authorization logic

Middleware/guard kiểm tra:
1. Session tồn tại → nếu không: `404 { "message": "Session not found." }`
2. Lấy `class_id` từ session → kiểm tra user có thuộc lớp không:
   - `teacher`: `classes.teacher_id = userId`
   - `student`: có record trong `class_members` với `class_id` và `student_id = userId`
   - `admin`: pass hết
   - Nếu không đủ điều kiện: `403 { "message": "You are not a member of this class." }`

### 4.2 — Query

```sql
SELECT
    u.id           AS user_id,
    u.full_name,
    u.role,
    sp.joined_at,
    sp.left_at,
    (sp.left_at IS NULL) AS is_online
FROM session_participants sp
JOIN users u ON u.id = sp.user_id
WHERE sp.session_id = $1
ORDER BY sp.joined_at ASC;
```

### 4.3 — Response `200`

```json
{
    "session_id": "uuid",
    "total_count": 3,
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

`total_count` = `participants.length` (không cần query COUNT riêng).

### 4.4 — Errors

| Status | Body |
|--------|------|
| `404` | `{ "message": "Session not found." }` |
| `403` | `{ "message": "You are not a member of this class." }` |

---

## Bước 5 — Thêm `PATCH /api/sessions/:sessionId/leave`

### 5.1 — Authorization logic

Giống Bước 4.1 — kiểm tra session tồn tại và user thuộc lớp.

### 5.2 — Business logic

1. Tìm record trong `session_participants` với `session_id` và `user_id`:
   - Không có record → `400 { "message": "You have not joined this session." }`
   - Có record nhưng `left_at IS NOT NULL` → `400 { "message": "You have already left this session." }`
2. Update `left_at = NOW()`:

```sql
UPDATE session_participants
SET left_at = NOW()
WHERE session_id = $1 AND user_id = $2
RETURNING session_id, user_id, joined_at, left_at;
```

### 5.3 — Response `200`

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

### 5.4 — Errors

| Status | Body |
|--------|------|
| `400` | `{ "message": "You have not joined this session." }` |
| `400` | `{ "message": "You have already left this session." }` |
| `404` | `{ "message": "Session not found." }` |
| `403` | `{ "message": "You are not a member of this class." }` |

---

## Bước 6 — Đăng ký routes

Trong file route sessions, đăng ký 2 route mới theo đúng thứ tự (đặt trước route `/:sessionId` nếu có để tránh conflict):

```js
router.get('/:sessionId/participants', authenticate, getParticipants);
router.patch('/:sessionId/leave', authenticate, leaveSession);
```
## Bước 7: Cập nhật response api endpoints GET /api/sessions/{sessionId}/messages
Trả về sender_name thay vì sender_id và bỏ session_id đi

## Bước 8: Cập nhật API docs 
Cập nhật API docs trong /docs/api-docs.md và swagger
---

## Checklist hoàn thành

- [ ] File migration `002_add_session_participants.sql` đã tạo
- [ ] Migration đã chạy trên DB
- [ ] Handler `/token` đã có upsert vào `session_participants`
- [ ] `GET /api/sessions/:sessionId/participants` hoạt động đúng
- [ ] `PATCH /api/sessions/:sessionId/leave` hoạt động đúng
- [ ] Routes đã đăng ký không conflict với routes cũ
- [ ] Không có breaking change nào với API đang tồn tại

---

## Constraint quan trọng

- **Không sửa** response shape của bất kỳ API đang tồn tại nào
- **Không xóa** bất kỳ field nào trong response hiện tại
- Nếu project có pattern validation riêng (Joi, Zod, express-validator...) thì áp dụng đúng pattern đó cho 2 API mới
- Nếu project có pattern error handler tập trung thì throw error qua đó, không tự `res.status().json()` riêng lẻ