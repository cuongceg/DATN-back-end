# SKILLS.md — Backend Agent

## Stack & Conventions

### Runtime & Framework
- **Node.js** với **Express.js**, cấu trúc MVC (có `routes/`, `controllers/`, `services/`, tham khảo phía dưới)
- **PostgreSQL** qua `pg` (node-postgres), dùng raw SQL — không dùng ORM
- **MinIO** (S3-compatible) cho file storage, dùng `minio` npm package
- **JWT** Bearer token cho auth — middleware `authenticate` đã có sẵn, attach `req.user = { id, role, ... }`
- **Swagger** JSDoc annotations — mọi endpoint mới phải có `@swagger` comment để `GET /api-docs` tự cập nhật

### Cấu trúc file convention (MVC)
```
src/
├── config/           # Cấu hình DB, LiveKit, env
│   ├── database.js
│   └── livekit.js    # LiveKit client config
├── controllers/      # Xử lý request/response
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── class.controller.js
│   └── meeting.controller.js   ← MỚI
├── models/           # Tương tác với PostgreSQL
│   ├── user.model.js
│   ├── class.model.js
│   └── meeting.model.js        ← MỚI
├── routes/           # Định nghĩa endpoints
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── class.routes.js
│   └── meeting.routes.js       ← MỚI
├── services/         # Business logic
│   ├── livekit.service.js      ← MỚI (core)
│   └── meeting.service.js      ← MỚI
├── middleware/       # Auth, validation, error handling
│   ├── auth.middleware.js
│   └── validate.middleware.js
└── utils/            # Helper functions
    └── response.util.js
```

### Response format chuẩn
```json
// Success
{ "message": "...", "data_key": { ... } }

// Error
{ "message": "Human-readable error." }
```
HTTP status: `200` GET/PATCH, `201` POST tạo mới, `400` validation, `401/403` auth, `404` not found, `409` conflict, `500` server error.

### SQL conventions
- Dùng `$1, $2, ...` parameterized queries — tuyệt đối không string interpolation
- UUID primary key: `gen_random_uuid()` (pgcrypto đã enable)
- Timestamp: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Tên cột: `snake_case`
- Foreign key constraint đặt tên: `fk_<table>_<ref>`, check constraint: `chk_<table>_<field>`

### Auth & Authorization pattern
```js
router.post('/', authenticate, authorize('teacher', 'student'), controller.create);
// authorize đã có sẵn, nhận rest params là allowed roles
```

### Error handling pattern
```js
// Trong controller — dùng try/catch, delegate lên global error handler
try {
  const result = await service.doSomething(params);
  res.status(201).json({ message: '...', post: result });
} catch (err) {
  next(err);
}
```

### Validation pattern
```js
// Inline validation trong controller trước khi gọi service
if (!body.content?.trim()) {
  return res.status(400).json({ message: 'content is required.' });
}
```

## MinIO conventions
- Bucket name: `class-files` (tạo nếu chưa tồn tại khi app start)
- Object key pattern: `{classId}/{categoryId}/{folderId}/{uuid}_{originalFilename}`
- Dùng `presignedGetObject` với expiry 1 giờ cho download URL
- Upload từ FE: FE gọi endpoint backend → backend stream lên MinIO (dùng `multer` + `memoryStorage`)
- Content-Type lưu vào MinIO object metadata

## Database patterns

### Kiểm tra membership (student thuộc lớp)
```sql
SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2
```

### Kiểm tra teacher sở hữu lớp
```sql
SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2
```

### Pagination
```sql
SELECT ... FROM posts WHERE class_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```
Response luôn kèm `total_count` để FE tính số trang.