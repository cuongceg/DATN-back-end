# BACKEND_SKILLS.md

Quy ước kỹ thuật cho Express.js backend.
Đọc file này trước khi viết code mới hoặc review PR.

---

## 1. Tổng quan kiến trúc

```
Flutter Desktop (Linux / Windows)
        │  HTTP REST (Bearer JWT)
        ▼
Express.js API  ──► PostgreSQL (pgcrypto, UUID)
        │
        ├──► MinIO  (file storage, presigned URLs)
        └──► Fuse.js suggestion (in-process, 1 file JSON)
```

**Nguyên tắc chung:**
- Mọi endpoint đều yêu cầu `Authorization: Bearer <jwt>` trừ `/api/auth/*`.
- Error response luôn có dạng `{ "message": "..." }`.
- UUID dùng `gen_random_uuid()` từ `pgcrypto` — không tự sinh ở app layer.
- Không bao giờ trả stack trace ra client trong production.

---

## 2. Cấu trúc thư mục

```
src/
├── config/           # db.js, minio.js, env validation
├── middleware/        # auth.js, role.js
├── routes/           # một file per resource
├── controllers/      # business logic, gọi services
├── services/         # truy vấn DB, MinIO operations
├── data/
│   └── questions.json  # toàn bộ ngân hàng câu hỏi — 1 file duy nhất
└── suggestion/
    ├── loader.js     # load + build Fuse instance khi server khởi động
    └── search.js     # hàm search(query, topic, limit)
```

---

## 3. Auth & Role middleware

```js
// middleware/auth.js
// Gắn req.user = { id, role, full_name, email } sau khi verify JWT
// Dùng: router.get('/...', authenticate, handler)

// middleware/role.js
// requireRole('teacher') — trả 403 nếu không đúng role
// Dùng: router.post('/...', authenticate, requireRole('teacher'), handler)
```

---

## 4. Response conventions

| Tình huống | HTTP code |
|---|---|
| Tạo thành công | 201 |
| Thao tác thành công | 200 |
| Validation lỗi | 400 |
| Sai / hết hạn token | 401 |
| Sai role hoặc không sở hữu resource | 403 |
| Không tìm thấy | 404 |
| Conflict (đã tồn tại) | 409 |
| File quá lớn | 413 |
| Lỗi server chưa xử lý | 500 |

---

## 5. PostgreSQL

- Dùng `pg` (node-postgres) với pool, không dùng ORM.
- Parameterized query bắt buộc: `query('SELECT ... WHERE id = $1', [id])`.
- Transaction: dùng `client.query('BEGIN') … COMMIT / ROLLBACK` khi có nhiều bước ghi.
- UUID input từ client phải validate format trước khi truyền vào query (`uuid` package hoặc regex).

---

## 6. MinIO

- Bucket `class-files`: tài liệu lớp học.
- Bucket `session-recordings`: video recording.
- Presigned URL TTL: 1 giờ cho files, 4 giờ cho recordings.
- Object key format: `<classId>/<path>` (files), `<sessionId>/<egressId>.mp4` (recordings).
- Không expose internal MinIO URL ra client — luôn qua presigned URL.

---

## 7. Suggestion / Question Bank

### 7.1 Lưu câu hỏi — 1 file JSON duy nhất

Dataset 3000+ câu → 1 file `src/data/questions.json`, không tách theo topic.

**Lý do dùng 1 file:**
- Fuse.js search 3000 câu < 5ms — không cần tách để tối ưu tốc độ.
- Filter theo `topic` làm ở tầng kết quả sau khi search, hoặc dùng `keys: ['q']` + filter kết quả.
- Tách nhiều file chỉ có lợi khi dataset > 50k câu hoặc cần maintain riêng theo người — không phải trường hợp này.

**Schema mỗi phần tử:**
```json
{ "id": "0001", "q": "IP là gì và vai trò của nó?", "topic": "ip" }
```

**Convention ID:** chuỗi số 4 chữ số tăng dần, unique toàn file — ví dụ `"0001"`, `"0042"`, `"3000"`.

**Lý do dùng file JSON thay vì DB:**
- 3000 câu × ~100 bytes ≈ 300KB RAM sau khi index — t3.micro chịu tốt.
- Cập nhật nội dung chỉ cần sửa file + restart, không cần migration DB.
- Tradeoff chấp nhận được ở MVP: thêm câu cần restart server; không hỗ trợ CRUD qua API.

### 7.2 Fuse.js loader — build index 1 lần khi server khởi động

```js
// suggestion/loader.js
const Fuse = require('fuse.js');
const fs   = require('fs');
const path = require('path');

const FUSE_OPTIONS = {
  keys: ['q'],
  threshold: 0.4,
  minMatchCharLength: 2,
  includeScore: true,
  shouldSort: true,
};

let _index = null;
let _items = [];

function buildIndex() {
  const filePath = path.join(__dirname, '../data/questions.json');
  if (!fs.existsSync(filePath)) {
    console.warn('[suggestion] questions.json not found — suggestion disabled.');
    return;
  }
  _items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  _index = new Fuse(_items, FUSE_OPTIONS);
  console.log(`[suggestion] index built: ${_items.length} questions`);
}

function getIndex() {
  return _index;
}

module.exports = { buildIndex, getIndex };
```

```js
// app.js — gọi trước app.listen()
const { buildIndex } = require('./suggestion/loader');
buildIndex();
```

### 7.3 search.js

```js
// suggestion/search.js
const { getIndex } = require('./loader');

function search(query, topic, limit = 5) {
  const index = getIndex();
  if (!index) return [];

  const safeLimit = Math.min(limit, 10);
  let results = index.search(query, { limit: safeLimit * 3 });

  if (topic) {
    results = results.filter(r => r.item.topic === topic);
  }

  return results.slice(0, safeLimit).map(r => r.item);
}

module.exports = { search };
```

### 7.4 Endpoint spec

```
GET /api/suggestions?q=<text>&topic=<topic>&limit=5
Authorization: Bearer <jwt>
```

- `q`: bắt buộc, >= 2 ký tự.
- `topic`: optional — nếu có thì filter sau khi search, nếu không thì trả toàn bộ top kết quả.
- `limit`: default 5, max 10.

Response:
```json
{
  "results": [
    { "id": "0001", "q": "IP là gì và vai trò của nó?", "topic": "ip" }
  ],
  "latency_ms": 2
}
```

---

## 8. Những gì KHÔNG làm ở MVP

- Không dùng Meilisearch — t3.micro 1GB RAM, Meilisearch ngốn ~200MB thường trực.
- Không lưu question bank vào PostgreSQL — overkill, không cần CRUD qua API.
- Không tách questions.json thành nhiều file theo topic — dataset chưa đủ lớn để cần thiết.
- Không build Fuse index theo từng request — tốn CPU, không cần thiết.
- Không dùng WebSocket cho chat — polling 5s đủ cho MVP.
- Không expose MinIO URL trực tiếp — luôn qua presigned URL.