# CURRENT_TASKS.md — Backend Implementation

> Đọc `SKILLS.md` trước khi bắt đầu bất kỳ task nào.
> Làm tuần tự theo thứ tự task. Mỗi task hoàn thành thì đánh dấu `[x]`.

---

## TASK-BE-01 — DB Migration: Bảng `posts`

**Mục tiêu:** Tạo bảng lưu posts của lớp học, gồm cả post thường và session card.

**Việc cần làm:**
Thêm vào `init.sql` hoặc tạo `migrations/002_posts.sql`:

```sql
CREATE TYPE post_type AS ENUM ('normal', 'session');

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    author_id UUID NOT NULL,
    type post_type NOT NULL DEFAULT 'normal',
    title VARCHAR(500),
    body_delta JSONB,
    body_plain TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_posts_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_posts_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT chk_posts_session_type CHECK (
        (type = 'session' AND session_id IS NOT NULL) OR
        (type = 'normal' AND session_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_session_id ON posts(session_id);
```

**Acceptance criteria:**
- [x] Migration chạy không lỗi trên DB hiện tại
- [x] CHECK constraint ngăn tạo post `normal` có `session_id` và ngược lại

---

## TASK-BE-02 — DB Migration: Bảng `categories`, `folders`, `class_files`

**Mục tiêu:** Cấu trúc 2 cấp cho file management: Category → Folder → File.

Tạo `migrations/003_files.sql`:

```sql
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_categories_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT uq_categories_class_name UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL,
    class_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_folders_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT uq_folders_category_name UNIQUE (category_id, name)
);

CREATE TABLE IF NOT EXISTS class_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL,
    class_id UUID NOT NULL,
    uploaded_by UUID NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    minio_object_key VARCHAR(1000) NOT NULL UNIQUE,
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class_files_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_files_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_files_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_class_id ON categories(class_id);
CREATE INDEX IF NOT EXISTS idx_folders_category_id ON folders(category_id);
CREATE INDEX IF NOT EXISTS idx_class_files_folder_id ON class_files(folder_id);
```

**Acceptance criteria:**
- [x] Migration chạy không lỗi
- [x] UNIQUE constraint ngăn trùng tên category trong cùng class, trùng tên folder trong cùng category

---

## TASK-BE-03 — MinIO Client Setup

**Mục tiêu:** Khởi tạo MinIO client singleton và đảm bảo bucket tồn tại khi app start.
Cập nhật file docker-compose.yml để tạo một container minio và có volumes
Tạo `src/services/minio.client.js`:
- Đọc config từ env: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_USE_SSL` (default `false`)
- Bucket name constant: `BUCKET_NAME = 'class-files'`
- Export async `ensureBucket()` — tạo bucket nếu chưa tồn tại
- Export `minioClient` instance

Gọi `ensureBucket()` trong app startup (`src/app.js` hoặc `src/index.js`).

Thêm vào `.env.example`:
```
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
```

**Acceptance criteria:**
- [x] App start không crash khi MinIO chưa có bucket
- [x] Nếu MinIO không kết nối được thì log warning, không crash toàn app

---

## TASK-BE-04 — Posts API: GET list & GET detail

**Mục tiêu:** Lấy danh sách posts của lớp (phân trang) và chi tiết 1 post.

Tạo `src/features/posts/posts.routes.js`, `posts.controller.js`, `posts.service.js`.
Đăng ký trong `src/app.js`: `app.use('/api/posts', postsRouter)`

### GET `/api/posts/class/:classId`

- **Auth:** Bắt buộc. Teacher sở hữu lớp HOẶC student là thành viên lớp.
- **Query params:** `limit` (default 20, max 100), `offset` (default 0)
- **Service:** JOIN posts với users (lấy `author_name`), JOIN sessions (lấy `session_title`, `session_status`, `scheduled_at` khi type = session). Sắp xếp `created_at DESC`.

Response `200`:
```json
{
  "posts": [
    {
      "id": "uuid",
      "type": "normal",
      "title": "Thông báo bài tập",
      "body_delta": { "ops": [] },
      "body_plain": "Nội dung...",
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

Errors: `403` không có quyền truy cập lớp, `404` lớp không tồn tại.

### GET `/api/posts/:postId`

- **Auth:** Bắt buộc. Kiểm tra quyền theo `class_id` của post.
- Response `200`: object post đầy đủ (single item).
- Errors: `404` post không tồn tại, `403` không có quyền.

**Acceptance criteria:**
- [x] Pagination đúng với `limit` và `offset`
- [x] Session post trả về đầy đủ `session_*` fields
- [x] Student không thuộc lớp nhận `403`

---

## TASK-BE-05 — Posts API: CREATE normal post

**Mục tiêu:** Teacher hoặc student tạo post mới trong lớp.

### POST `/api/posts`

- **Auth:** Bắt buộc. Teacher sở hữu lớp HOẶC student thành viên lớp.
- **Body:**
```json
{
  "classId": "uuid",
  "title": "Thông báo",
  "bodyDelta": { "ops": [{ "insert": "Nội dung..." }] },
  "bodyPlain": "Nội dung..."
}
```
- **Validation:** `classId` UUID bắt buộc; `bodyDelta` hoặc `bodyPlain` ít nhất 1 không rỗng; `title` optional max 500 ký tự.
- **Service:** Insert post với `type = 'normal'`, `author_id = req.user.id`. Trả về post kèm `author_name`.

Response `201`:
```json
{
  "message": "Post created successfully.",
  "post": { "...post object..." }
}
```

Errors: `400` thiếu field bắt buộc, `403` không phải thành viên lớp, `404` lớp không tồn tại.

**Acceptance criteria:**
- [x] Admin không tạo được post (403)
- [x] Student không thuộc lớp nhận 403

---

## TASK-BE-06 — Posts API: Auto-create session post

**Mục tiêu:** Khi teacher tạo session, backend tự động tạo 1 post loại `session` trong lớp.

**Việc cần làm:**
Trong `sessions.service.js`, ngay sau khi INSERT session thành công, thêm:

```js
await pool.query(
  `INSERT INTO posts (class_id, author_id, type, session_id)
   VALUES ($1, $2, 'session', $3)`,
  [classId, teacherId, newSession.id]
);
```

Không tạo endpoint riêng. Đây là side-effect nội bộ của sessions service.

**Acceptance criteria:**
- [x] Sau khi tạo session, GET `/api/posts/class/:classId` trả về post mới với `type = 'session'`
- [x] Xóa session → post tương ứng tự xóa theo (ON DELETE CASCADE đã có)
- [x] Không có duplicate post nếu retry

---

## TASK-BE-07 — Posts API: UPDATE & DELETE

**Mục tiêu:** Tác giả sửa/xóa bài của mình. Session post không được phép sửa/xóa trực tiếp.

### PATCH `/api/posts/:postId`

- **Auth:** Bắt buộc. Chỉ `author_id = req.user.id`.
- **Body** (ít nhất 1 field): `title`, `bodyDelta`, `bodyPlain`
- **Service:** Verify `type = 'normal'`, verify tác giả, update fields + `updated_at = NOW()`.

Response `200`: `{ "message": "Post updated successfully.", "post": {...} }`

Errors: `400` không có field update hoặc post là `type = 'session'`, `403` không phải tác giả, `404` không tồn tại.

### DELETE `/api/posts/:postId`

- **Auth:** Bắt buộc. Tác giả HOẶC teacher sở hữu lớp.
- **Service logic:**
  1. Fetch post lấy `class_id` và `author_id`
  2. Không cho xóa post `type = 'session'` (trả `400`)
  3. Nếu requester là teacher sở hữu lớp → xóa bất kỳ normal post nào trong lớp
  4. Nếu requester là student → chỉ xóa post của chính mình

Response `200`: `{ "message": "Post deleted successfully.", "post": { "id": "uuid" } }`

Errors: `400` cố xóa session post, `403` không có quyền, `404` không tồn tại.

**Acceptance criteria:**
- [x] Student A không xóa được post của Student B
- [x] Teacher xóa được bất kỳ normal post nào trong lớp của mình
- [x] Session post không bị xóa qua endpoint này

---

## TASK-BE-08 — Files API: Categories CRUD

**Mục tiêu:** Teacher quản lý categories (cấp 1) trong lớp.

Tạo `src/features/files/files.routes.js`, `files.controller.js`, `files.service.js`.
Đăng ký: `app.use('/api/files', filesRouter)`

### GET `/api/files/class/:classId/categories`
- **Auth:** Teacher sở hữu lớp hoặc student thành viên.
- Response `200`:
```json
{
  "categories": [
    { "id": "uuid", "name": "General", "folder_count": 2, "created_at": "..." }
  ]
}
```
`folder_count` đếm từ bảng `folders`.

### POST `/api/files/class/:classId/categories`
- **Auth:** Teacher sở hữu lớp.
- **Body:** `{ "name": "General" }`
- **Validation:** `name` bắt buộc, không rỗng, max 255 ký tự.
- Response `201`: `{ "message": "Category created successfully.", "category": {...} }`
- Error `409` nếu tên đã tồn tại trong lớp.

### DELETE `/api/files/class/:classId/categories/:categoryId`
- **Auth:** Teacher sở hữu lớp.
- **Service:** Xóa DB record (CASCADE xóa folders + class_files). Thêm TODO comment để xử lý MinIO cleanup sau bằng background job — không block request này.
- Response `200`: `{ "message": "Category deleted successfully." }`

**Acceptance criteria:**
- [x] Student không tạo/xóa được category (403)
- [x] Trùng tên trong cùng lớp trả về 409

---

## TASK-BE-09 — Files API: Folders CRUD

**Mục tiêu:** Teacher quản lý folders (cấp 2) trong category.

### GET `/api/files/class/:classId/categories/:categoryId/folders`
- **Auth:** Teacher sở hữu lớp hoặc student thành viên.
- Response `200`:
```json
{
  "folders": [
    { "id": "uuid", "name": "Tài liệu lớp học", "file_count": 3, "created_at": "..." }
  ]
}
```

### POST `/api/files/class/:classId/categories/:categoryId/folders`
- **Auth:** Teacher sở hữu lớp.
- **Body:** `{ "name": "Tài liệu lớp học" }`
- Response `201`: `{ "message": "Folder created successfully.", "folder": {...} }`
- Error `409` nếu tên folder đã tồn tại trong category.

### DELETE `/api/files/class/:classId/categories/:categoryId/folders/:folderId`
- **Auth:** Teacher sở hữu lớp.
- **Service:** Xóa DB record (CASCADE). TODO MinIO cleanup.
- Response `200`: `{ "message": "Folder deleted successfully." }`

**Acceptance criteria:**
- [x] `404` nếu `categoryId` không thuộc `classId` đang request

---

## TASK-BE-10 — Files API: Upload file

**Mục tiêu:** Teacher upload file vào folder.

Cài dependency nếu chưa có: `npm install multer`

### POST `/api/files/class/:classId/folders/:folderId/upload`

- **Auth:** Teacher sở hữu lớp.
- **Content-Type:** `multipart/form-data`, field `file` (single file), max 50MB.
- **Service logic:**
  1. Verify teacher sở hữu lớp
  2. Verify `folderId` tồn tại và thuộc lớp đó
  3. Generate object key: `{classId}/{folderId}/{uuid}_{originalname}`
  4. Upload buffer lên MinIO với content-type từ multer
  5. Insert record vào `class_files`

Response `201`:
```json
{
  "message": "File uploaded successfully.",
  "file": {
    "id": "uuid",
    "original_name": "Bai_tap.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 204800,
    "created_at": "..."
  }
}
```

Errors: `400` không có file, `413` quá 50MB, `403` không phải teacher sở hữu lớp, `404` folder không tồn tại.

**Acceptance criteria:**
- [x] File xuất hiện trên MinIO sau upload thành công
- [x] `class_files` record có đúng `minio_object_key`

---

## TASK-BE-11 — Files API: List files & Download URL

**Mục tiêu:** Lấy danh sách file trong folder và tạo presigned URL để download.

### GET `/api/files/class/:classId/folders/:folderId/files`
- **Auth:** Teacher sở hữu lớp hoặc student thành viên.
- Response `200`:
```json
{
  "files": [
    {
      "id": "uuid",
      "original_name": "Bai_tap.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 204800,
      "uploaded_by_name": "Nguyen Van A",
      "created_at": "..."
    }
  ]
}
```

### GET `/api/files/:fileId/download-url`
- **Auth:** Teacher sở hữu lớp hoặc student thành viên lớp chứa file.
- **Service:**
  1. Fetch file record lấy `minio_object_key` và `class_id`
  2. Verify quyền truy cập lớp
  3. Gọi `minioClient.presignedGetObject(BUCKET_NAME, objectKey, 3600)`

Response `200`:
```json
{
  "download_url": "http://localhost:9000/class-files/...?X-Amz-Signature=...",
  "expires_in_seconds": 3600
}
```

**Acceptance criteria:**
- [x] Presigned URL hoạt động khi truy cập trực tiếp trong browser
- [x] URL hết hạn sau 1 giờ

---

## TASK-BE-12 — Files API: Delete file

**Mục tiêu:** Teacher xóa file khỏi folder.

### DELETE `/api/files/:fileId`

- **Auth:** Teacher sở hữu lớp chứa file.
- **Service:**
  1. Fetch file record lấy `minio_object_key` và `class_id`
  2. Verify teacher sở hữu lớp
  3. Xóa object trên MinIO: `minioClient.removeObject(BUCKET_NAME, objectKey)`
  4. Nếu MinIO xóa thành công → xóa DB record
  5. Nếu MinIO lỗi → không xóa DB, trả `500`

Response `200`: `{ "message": "File deleted successfully." }`
Errors: `403`, `404`, `500` nếu MinIO lỗi.

**Acceptance criteria:**
- [x] File không còn trên MinIO sau khi xóa
- [x] DB record bị xóa
- [x] Nếu MinIO lỗi, DB record vẫn còn (không xóa nửa chừng)

---

## TASK-BE-13 — Swagger Documentation

**Mục tiêu:** Cập nhật Swagger annotations cho tất cả endpoints mới (TASK-BE-04 đến BE-12).

Mỗi endpoint cần có `@swagger` JSDoc comment với: summary, request body schema, response schemas (200/201/400/403/404), security `bearerAuth`.

Verify bằng cách truy cập `GET /api-docs` sau khi restart server.

**Acceptance criteria:**
- [x] Tất cả endpoints mới hiển thị trên Swagger UI
- [x] Có thể test trực tiếp từ Swagger UI

---

## Thứ tự thực hiện

```
BE-01 → BE-02 → BE-03   (song song được)
         ↓
BE-04 → BE-05 → BE-06 → BE-07   (posts, tuần tự)
         ↓
BE-08 → BE-09 → BE-10 → BE-11 → BE-12   (files, tuần tự, cần BE-03)
         ↓
BE-13   (cuối cùng)
```