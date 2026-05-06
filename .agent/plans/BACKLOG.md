# CURRENT_TASKS.md — Session (Meeting) Feature Backend

> Cập nhật lần cuối: 2026-05-06
> Trạng thái: 🚧 Đang phát triển

---

## ✅ Đã hoàn thành (existing)
- [x] Auth API (login/register + JWT middleware)
- [x] User management API
- [x] Class/Classroom management API
- [x] Schema DB: `sessions`, `messages`, `session_artifacts`, `class_members` (đã có sẵn)

---

## 🎯 Sprint hiện tại: Session Core

### TASK-01 — Cài đặt & Config LiveKit SDK
- [x] `npm install livekit-server-sdk`
- [x] Tạo `src/config/livekit.js` — khởi tạo `RoomServiceClient`
- [x] Thêm vào `.env` và `.env.example`:
  ```env
  LIVEKIT_URL=wss://dev-monitor.id.vn
  LIVEKIT_API_KEY=
  LIVEKIT_API_SECRET=
  ```

---

### TASK-02 — LiveKit Service
**File:** `src/services/livekit.service.js`

- [x] `generateLiveKitToken(roomName, identity, grants)` — tạo JWT token cho client
  - Teacher → `roomAdmin: true`
  - Student → `roomAdmin: false`
  - Gắn `token.metadata = { name: user.full_name, role }`
- [x] `createLiveKitRoom(roomName)` — tạo room với `maxParticipants: 50`, `emptyTimeout: 300`
- [x] `deleteLiveKitRoom(roomName)` — xóa room khi end session, bắt lỗi nếu room đã tự xóa
- [x] `getActiveParticipants(roomName)` — lấy danh sách người đang online

---

### TASK-03 — Session Service
**File:** `src/services/session.service.js`

- [x] `createSession(classId, teacherId, { title, scheduledAt })`
  - Verify `classes.teacher_id = teacherId` trước khi tạo
  - Insert vào `sessions` với `status = 'scheduled'`
- [x] `getSessionsByClass(classId)` — lấy danh sách sessions của 1 lớp
- [x] `getSessionById(sessionId)` — lấy chi tiết 1 session
- [x] `startSession(sessionId, teacherId)`
  - UPDATE `status = 'ongoing'`, `start_time = NOW()`, `livekit_room_id = id::text`
  - Chỉ cho phép khi `status = 'scheduled'`
- [x] `endSession(sessionId, teacherId)`
  - UPDATE `status = 'completed'`, `end_time = NOW()`
  - Gọi `deleteLiveKitRoom(session.livekit_room_id)` sau khi update
  - Chỉ cho phép khi `status = 'ongoing'`
- [x] `verifyUserCanJoin(userId, sessionId)`
  - JOIN `sessions` + `classes` để lấy `teacher_id`
  - Nếu `userId = teacher_id` → role `'teacher'`
  - Nếu có trong `class_members` → role `'student'`
  - Nếu không thuộc lớp → throw error
  - Nếu `status = 'completed'` → throw error

---

### TASK-04 — Session Controller
**File:** `src/controllers/session.controller.js`

- [x] `createSession` — `POST /sessions`
  - Chỉ `user_role = 'teacher'` mới được tạo
  - Body: `{ classId, title, scheduledAt? }`
- [x] `getSessionsByClass` — `GET /sessions/class/:classId`
  - Trả về list sessions kèm `status`, `start_time`, số người (nếu cần)
- [x] `getSessionById` — `GET /sessions/:sessionId`
- [x] `startSession` — `PATCH /sessions/:sessionId/start`
  - Chỉ teacher của lớp mới được start
- [x] `endSession` — `PATCH /sessions/:sessionId/end`
  - Chỉ teacher của lớp mới được end
- [x] `joinSession` — `POST /sessions/:sessionId/token`
  - Gọi `verifyUserCanJoin` → xác định role
  - Gọi `generateLiveKitToken` với grants phù hợp
  - Trả về `{ token, livekit_url, room_name }`

---

### TASK-05 — Messages Controller
**File:** `src/controllers/session.controller.js` *(hoặc tách riêng)*

> Bảng `messages` đã có sẵn, không cần migration.

- [x] `getMessages` — `GET /sessions/:sessionId/messages`
  - Verify user thuộc lớp trước khi trả data
  - Hỗ trợ pagination (limit/offset)
- [x] `sendMessage` — `POST /sessions/:sessionId/messages`
  - Verify session đang `ongoing`
  - Insert vào `messages (session_id, sender_id, content)`

---

### TASK-06 — Routes
**File:** `src/routes/session.routes.js`

- [x] Khai báo đầy đủ các routes (xem SKILLS.md phần API Endpoints)
- [x] Gắn `authMiddleware` cho tất cả routes
- [x] Mount vào `app.js`: `app.use('/api/sessions', sessionRoutes)`

---

### TASK-07 — Validation Middleware
- [x] Validate body `createSession`: `classId` (UUID), `title` (string, required), `scheduledAt` (ISO date, optional)
- [x] Validate params `sessionId`: UUID hợp lệ
- [x] Validate body `sendMessage`: `content` (string, không rỗng)

---

### TASK-08 — Testing
- [ ] `POST /sessions` — teacher tạo thành công
- [ ] `POST /sessions` — student tạo → trả lỗi 403
- [ ] `PATCH /sessions/:id/start` — teacher start thành công, `livekit_room_id` được gán
- [ ] `POST /sessions/:id/token` — teacher nhận token với `roomAdmin: true`
- [ ] `POST /sessions/:id/token` — student thuộc lớp → nhận token thành công
- [ ] `POST /sessions/:id/token` — user không thuộc lớp → trả lỗi 403
- [ ] `POST /sessions/:id/token` — session `completed` → trả lỗi 400
- [ ] `PATCH /sessions/:id/end` — teacher end, `deleteLiveKitRoom` được gọi
- [ ] `POST /sessions/:id/messages` — gửi tin nhắn khi session `ongoing`
- [ ] Dùng `meet.livekit.io` verify token thật sự connect được vào `wss://dev-monitor.id.vn`

---

## 📋 Backlog (làm sau)

### TASK-09 — Session Schedule & Notification
- [ ] Gửi notification cho học sinh trước khi session bắt đầu
- [ ] API lấy sessions sắp diễn ra trong 24h tới

### TASK-10 — Recording (LiveKit Egress)
- [ ] Tích hợp LiveKit Egress API để record session
- [ ] Lưu `video_file_path` vào bảng `session_artifacts`
- [ ] Cập nhật `artifact_status`: `processing → completed | failed`

### TASK-11 — AI Summary
- [ ] Sau khi session kết thúc, chạy transcription
- [ ] Lưu `transcript_file_path` vào `session_artifacts`
- [ ] Gọi AI để tóm tắt, lưu vào `ai_summary_content (JSONB)`

### TASK-12 — Realtime Captions (đặc thù khiếm thính)
- [ ] Tích hợp Speech-to-Text (Google STT hoặc Whisper)
- [ ] Stream caption qua LiveKit Data Channel (`canPublishData: true`)

---

## 📝 Ghi chú
- LiveKit server: `wss://dev-monitor.id.vn` (EC2 t3.micro — chỉ dùng dev/test)
- Không có bảng `meeting_participants` riêng — dùng `class_members` để verify quyền
- `livekit_room_id` được gán bằng `session.id::text` lúc start (unique, không cần generate thêm)
- Mỗi khi thay đổi `livekit.yaml` trên EC2: `docker-compose restart livekit`