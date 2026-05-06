# SKILLS.md — Kỹ năng & Patterns cho Meeting Feature

> Dựa trên schema thực tế từ `init.sql`

---

## 1. LiveKit Token Generation

### Cài đặt
```bash
npm install livekit-server-sdk
```

### Config (`src/config/livekit.js`)
```js
import { RoomServiceClient } from 'livekit-server-sdk';

export const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);
```

### Tạo Token (`src/services/livekit.service.js`)
```js
import { AccessToken } from 'livekit-server-sdk';

/**
 * Tạo JWT token để client kết nối vào LiveKit room
 * @param {string} roomName  - livekit_room_id trong bảng sessions
 * @param {string} identity  - user UUID từ bảng users
 * @param {object} grants    - quyền trong room
 */
export const generateLiveKitToken = async (roomName, identity, grants = {}) => {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: String(identity),
      ttl: '4h',
    }
  );

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: grants.canPublish ?? true,
    canSubscribe: grants.canSubscribe ?? true,
    canPublishData: grants.canPublishData ?? true, // dùng cho caption/subtitle
    roomAdmin: grants.roomAdmin ?? false,
    ...grants,
  });

  return token.toJwt();
};
```

### Phân quyền theo role
```js
// Teacher — kiểm tra qua classes.teacher_id
const teacherGrants = {
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomAdmin: true,  // mute/kick participants
};

// Student — kiểm tra qua class_members (permission: 'Member' | 'Owner')
const studentGrants = {
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomAdmin: false,
};
```

---

## 2. Schema thực tế (tham chiếu từ init.sql)

### Enum types đã có
```sql
session_status:          'scheduled' | 'ongoing' | 'completed'
user_role:               'admin' | 'teacher' | 'student'
class_member_permission: 'Member' | 'Owner'
artifact_status:         'processing' | 'failed' | 'completed'
```

### Bảng `sessions` — đây là "meeting" trong dự án này
```sql
sessions (
  id               UUID PK
  class_id         UUID → classes(id)
  livekit_room_id  VARCHAR(255)   -- tên room trên LiveKit server
  title            VARCHAR(255)
  start_time       TIMESTAMPTZ    -- lúc bắt đầu thực tế (status → ongoing)
  end_time         TIMESTAMPTZ    -- lúc kết thúc (status → completed)
  status           session_status -- 'scheduled' | 'ongoing' | 'completed'
)
```
> ⚠️ `livekit_room_id` NULL khi mới tạo (scheduled). Nên gán `livekit_room_id = session.id::text` lúc start cho đơn giản và đảm bảo unique.

### Bảng `class_members` — verify quyền join session
```sql
class_members (
  class_id    UUID → classes(id)
  student_id  UUID → users(id)
  permission  class_member_permission  -- 'Member' | 'Owner'
  joined_at   TIMESTAMPTZ
)
```
> ⚠️ Teacher **không** có trong `class_members`. Kiểm tra teacher qua `classes.teacher_id`.

### Bảng `messages` — chat trong session (đã có sẵn)
```sql
messages (
  id          UUID PK
  session_id  UUID → sessions(id)
  sender_id   UUID → users(id)
  content     TEXT
  timestamp   TIMESTAMPTZ
)
```

### Bảng `session_artifacts` — recording & AI summary (đã có sẵn)
```sql
session_artifacts (
  id                    UUID PK
  session_id            UUID → sessions(id)
  video_file_path       VARCHAR(500)
  transcript_file_path  VARCHAR(500)
  ai_summary_content    JSONB
  status                artifact_status  -- 'processing' | 'failed' | 'completed'
)
```

---

## 3. Query Patterns

### Kiểm tra user có quyền join session không
```js
export const verifyUserCanJoin = async (userId, sessionId) => {
  const sessionRes = await db.query(
    `SELECT s.id, s.class_id, s.status, s.livekit_room_id,
            c.teacher_id
     FROM sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1`,
    [sessionId]
  );

  const session = sessionRes.rows[0];
  if (!session) throw new Error('Session không tồn tại');
  if (session.status === 'completed') throw new Error('Session đã kết thúc');

  // Teacher của lớp
  if (session.teacher_id === userId) {
    return { session, role: 'teacher' };
  }

  // Student trong class_members
  const memberRes = await db.query(
    `SELECT permission FROM class_members
     WHERE class_id = $1 AND student_id = $2`,
    [session.class_id, userId]
  );

  if (!memberRes.rows[0]) throw new Error('Bạn không thuộc lớp học này');
  return { session, role: 'student', permission: memberRes.rows[0].permission };
};
```

### Tạo session mới
```js
export const createSession = async (classId, teacherId, { title, scheduledAt }) => {
  const classRes = await db.query(
    `SELECT id FROM classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  if (!classRes.rows[0]) throw new Error('Không có quyền tạo session cho lớp này');

  const result = await db.query(
    `INSERT INTO sessions (class_id, title, start_time, status)
     VALUES ($1, $2, $3, 'scheduled')
     RETURNING *`,
    [classId, title, scheduledAt || null]
  );
  return result.rows[0];
};
```

### Start session (scheduled → ongoing)
```js
export const startSession = async (sessionId, teacherId) => {
  // Gán livekit_room_id = session UUID lúc start
  const result = await db.query(
    `UPDATE sessions
     SET status = 'ongoing',
         start_time = NOW(),
         livekit_room_id = id::text
     WHERE id = $1
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
       AND status = 'scheduled'
     RETURNING *`,
    [sessionId, teacherId]
  );
  if (!result.rows[0]) throw new Error('Không thể start session');
  return result.rows[0];
};
```

### End session (ongoing → completed)
```js
export const endSession = async (sessionId, teacherId) => {
  const result = await db.query(
    `UPDATE sessions
     SET status = 'completed', end_time = NOW()
     WHERE id = $1
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
       AND status = 'ongoing'
     RETURNING *`,
    [sessionId, teacherId]
  );
  if (!result.rows[0]) throw new Error('Không thể end session');
  return result.rows[0];
};
```

---

## 4. API Endpoints Pattern

### Routes (`src/routes/session.routes.js`)
```js
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as sessionController from '../controllers/session.controller.js';

const router = Router();
router.use(authMiddleware);

// Session CRUD
router.post('/',                  sessionController.createSession);
router.get('/class/:classId',     sessionController.getSessionsByClass);
router.get('/:sessionId',         sessionController.getSessionById);
router.patch('/:sessionId/start', sessionController.startSession);
router.patch('/:sessionId/end',   sessionController.endSession);

// LiveKit token — Flutter dùng để connect vào room
router.post('/:sessionId/token',  sessionController.joinSession);

// Messages (đã có bảng sẵn)
router.get('/:sessionId/messages',  sessionController.getMessages);
router.post('/:sessionId/messages', sessionController.sendMessage);

export default router;
```

### Response khi join session thành công
```js
res.json({
  success: true,
  data: {
    token: '<livekit_jwt>',
    livekit_url: process.env.LIVEKIT_URL,   // wss://dev-monitor.id.vn
    room_name: session.livekit_room_id,
  }
});
```

---

## 5. LiveKit Room Lifecycle

```js
import { roomService } from '../config/livekit.js';

// Tạo room trên LiveKit (optional — tự tạo khi có người join)
export const createLiveKitRoom = async (roomName) => {
  return roomService.createRoom({
    name: roomName,
    emptyTimeout: 300,   // tự xóa sau 5 phút không có ai
    maxParticipants: 50,
  });
};

// Xóa room khi end session
export const deleteLiveKitRoom = async (roomName) => {
  try {
    await roomService.deleteRoom(roomName);
  } catch (e) {
    // Room có thể đã tự xóa nếu trống — bỏ qua lỗi
    console.warn('deleteRoom warning:', e.message);
  }
};
```

---

## 6. Tips đặc thù cho học sinh khiếm thính

- **Không tắt cam mặc định** — học sinh cần nhìn thấy nhau để đọc khẩu hình / ngôn ngữ ký hiệu
- **`canPublishData: true`** — mở data channel, chuẩn bị cho caption realtime sau
- **Gắn metadata vào token** để Flutter hiển thị đúng tên:
  ```js
  token.metadata = JSON.stringify({
    name: user.full_name,  // cột full_name trong bảng users
    role: userRole,        // 'teacher' | 'student'
  });
  ```
- **`session_artifacts`** đã có `transcript_file_path` + `ai_summary_content (JSONB)` → sẵn sàng cho tính năng AI tóm tắt buổi học
- **`messages`** đã có sẵn → không cần thêm bảng, chỉ cần viết API GET/POST là dùng được ngay