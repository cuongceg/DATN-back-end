# Raise Hand & Reaction feature (Backend)

## SKILLS

### Coding conventions
- Node.js + Express, CommonJS (`require`/`module.exports`)
- Pattern: `routes → controller → service → model` — không viết business logic trong controller, không viết SQL trong service
- Controller chỉ làm: validate input, gọi service, trả response
- Model chỉ làm: query PostgreSQL qua `pg` pool, trả raw rows
- Tất cả lỗi throw `new Error(message)` từ service/model, controller catch và `res.status(...).json({ message })`
- Auth middleware inject `req.user = { id, role }` — dùng trực tiếp, không query lại users table
- Validate middleware dùng `express-validator` — xem pattern trong `src/middleware/validate.middleware.js`
- Không dùng ORM. SQL thuần, parameterized queries (`$1, $2, ...`)
- File mới đặt đúng layer: `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`

### Database conventions
- UUID primary key: `gen_random_uuid()`
- Timestamp: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Foreign key luôn có `ON DELETE CASCADE` trừ khi có lý do giữ lại
- Migration: viết thêm vào `init.sql` — KHÔNG xóa bảng cũ, chỉ thêm `CREATE TABLE IF NOT EXISTS` mới
- Index cho mọi FK column và các cột thường dùng trong WHERE

### Auth & permission pattern
- `requireAuth` middleware: bắt buộc mọi endpoint
- Role check trong controller: `if (req.user.role !== 'teacher') return res.status(403)...`
- Ownership check trong service: query DB xác nhận `session.class.teacher_id === req.user.id`

---

## CURRENT_TASKS

### BE-01 · Migration: tạo bảng `session_reactions`
**File:** `init.sql`
**Mô tả:** Thêm bảng lưu trạng thái reaction hiện tại của từng participant trong session. Mỗi user chỉ có 1 reaction active tại một thời điểm — upsert khi set, hard delete khi clear.

Schema cần thêm vào cuối `init.sql`:
```sql
CREATE TABLE IF NOT EXISTS session_reactions (
    session_id  UUID NOT NULL,
    user_id     UUID NOT NULL,
    type        VARCHAR(20) NOT NULL,
    raised_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, user_id),
    CONSTRAINT fk_sr_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    CONSTRAINT chk_sr_type   CHECK (type IN ('raise_hand','agree','repeat','pause','confused'))
);

CREATE INDEX IF NOT EXISTS idx_session_reactions_session_id ON session_reactions(session_id);
```

---

### BE-02 · Model: `src/models/reaction.model.js`
**File:** `src/models/reaction.model.js` *(file mới)*
**Mô tả:** 3 query functions cho bảng `session_reactions`.

Cần implement:
- `upsertReaction(sessionId, userId, type)` — INSERT ... ON CONFLICT (session_id, user_id) DO UPDATE SET type=$3, raised_at=NOW(). Trả về row vừa upsert.
- `deleteReaction(sessionId, userId)` — DELETE WHERE session_id=$1 AND user_id=$2. Trả về deleted row hoặc null.
- `getReactionsBySession(sessionId)` — SELECT session_reactions.*, users.full_name FROM session_reactions JOIN users ON users.id = user_id WHERE session_id=$1 ORDER BY raised_at ASC. Trả về array rows.

---

### BE-03 · Service: `src/services/reaction.service.js`
**File:** `src/services/reaction.service.js` *(file mới)*
**Mô tả:** Business logic — validate quyền truy cập session, gọi model. Không có logic phức tạp ở layer này, chủ yếu là permission guard.

Cần implement:
- `setReaction(sessionId, userId, type)` — kiểm tra session tồn tại và đang `ongoing` (query bảng `sessions`), gọi `upsertReaction`. Throw nếu session không `ongoing`.
- `clearReaction(sessionId, userId)` — gọi `deleteReaction`, không throw nếu không tìm thấy row (idempotent).
- `listReactions(sessionId, requesterId)` — kiểm tra requester là teacher của class hoặc là participant của session (query `session_participants`), gọi `getReactionsBySession`.

---

### BE-04 · Controller: `src/controllers/reaction.controller.js`
**File:** `src/controllers/reaction.controller.js` *(file mới)*
**Mô tả:** 3 handlers, pattern giống `meeting.controller.js`.

Cần implement:
- `setReaction` — POST handler. Lấy `sessionId` từ `req.params`, `type` từ `req.body`, `userId` từ `req.user.id`. Validate `type` nằm trong enum. Gọi service, trả `201 { reaction: { session_id, user_id, type, raised_at } }`.
- `clearReaction` — DELETE handler. Gọi service, trả `200 { message: "Reaction cleared." }`.
- `listReactions` — GET handler. Chỉ cho phép teacher. Trả `200 { reactions: [...], raise_hand_count: N }` trong đó `raise_hand_count` là số item có `type === 'raise_hand'`.

---

### BE-05 · Routes: `src/routes/reaction.routes.js`
**File:** `src/routes/reaction.routes.js` *(file mới)*
**Mô tả:** Mount 3 endpoints dưới prefix `/api/sessions/:sessionId/reactions`. Tất cả đều qua `requireAuth`.

Endpoints:
```
POST   /api/sessions/:sessionId/reactions        → reaction.controller.setReaction
DELETE /api/sessions/:sessionId/reactions        → reaction.controller.clearReaction
GET    /api/sessions/:sessionId/reactions        → reaction.controller.listReactions
```

Sau khi tạo file, mount vào `src/app.js` (hoặc `index.js` — file entry point đăng ký routes):
```js
const reactionRoutes = require('./routes/reaction.routes');
app.use('/api', reactionRoutes);
```

---

### BE-06 · Cập nhật `api-docs.md`
**File:** `api-docs.md`
**Mô tả:** Thêm section `4.9 Reactions` vào cuối phần endpoints. Ghi đủ 3 endpoint với method, path, auth, roles, request body/params, success response, error responses — theo đúng format các section trước.