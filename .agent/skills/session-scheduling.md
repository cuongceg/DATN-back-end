# SKILL.md — Session Scheduling Feature

## Mục đích

Skill này hướng dẫn implement chức năng **lên lịch buổi học (session scheduling)** trong ứng dụng desktop Flutter + Node.js/Express + PostgreSQL. Đọc file này trước khi viết bất kỳ code nào liên quan đến sessions/calendar.

---

## 1. Database

### Bảng `sessions` — schema đầy đủ sau migration

```sql
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  livekit_room_id  VARCHAR(255),
  title            VARCHAR(255) NOT NULL,
  scheduled_at     TIMESTAMPTZ,        -- ← cột mới, thêm bằng migration
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  status           session_status NOT NULL DEFAULT 'scheduled',
  CONSTRAINT chk_sessions_time
    CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time)
);
```

**Quy tắc:**
- `scheduled_at`: thời gian dự kiến, do teacher đặt khi tạo lịch.
- `start_time`: thời gian thực tế khi session được start (set bởi `PATCH /start`).
- Calendar hiển thị theo `scheduled_at`. Nếu null fallback về `start_time`.

---

## 3. API Endpoints (Sessions)

### Endpoints hiện có (giữ nguyên, cập nhật nhỏ)

| Method | Path | Role | Ghi chú |
|--------|------|------|---------|
| POST | `/api/sessions` | teacher | Thêm `scheduled_at` vào body và response |
| GET | `/api/sessions/class/:classId` | all | Thêm `scheduled_at` vào response |
| GET | `/api/sessions/:sessionId` | all | Thêm `scheduled_at` vào response |
| PATCH | `/api/sessions/:sessionId/start` | teacher | Không thay đổi |
| PATCH | `/api/sessions/:sessionId/end` | teacher | Không thay đổi |

### Endpoints mới cần thêm

| Method | Path | Role | Ghi chú |
|--------|------|------|---------|
| GET | `/api/sessions/my` | all | Query `?from=&to=` — cho calendar view |
| PATCH | `/api/sessions/:sessionId` | teacher | Update title/scheduledAt |
| DELETE | `/api/sessions/:sessionId` | teacher | Chỉ status `scheduled` |

### Body schemas

**POST/PATCH session:**
```json
{
  "classId": "uuid",        // chỉ bắt buộc khi POST
  "title": "string",
  "scheduledAt": "ISO8601"  // optional
}
```

**GET /api/sessions/my response:**
```json
{
  "sessions": [{
    "id": "uuid",
    "class_id": "uuid",
    "class_name": "string",   // JOIN từ classes
    "title": "string",
    "scheduled_at": "ISO8601 | null",
    "start_time": "ISO8601 | null",
    "end_time": "ISO8601 | null",
    "status": "scheduled | ongoing | completed"
  }]
}
```
---

## 4. Checklist trước khi ship

- [ ] Migration `add_scheduled_at_to_sessions.sql` đã chạy trên DB.
- [ ] `GET /api/sessions/my` trả về `class_name` (JOIN với `classes`).