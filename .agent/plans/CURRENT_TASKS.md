# BE_TASKS.md — LiveKit Recording (Backend)

## Tổng quan việc cần làm

Thêm tính năng recording vào session đang `ongoing`. Teacher start/stop, file lưu MinIO, list trả về presigned URL cho Flutter.

---

## TASK BE-1 — Khởi tạo EgressClient & cấu hình MinIO bucket

**File**: `config/livekit.js` (đã có và config), `config/minio.js` (thêm bucket recording)

### Việc cần làm
1. Thêm `EgressClient` vào `config/livekit.js`:
```js
const { EgressClient } = require('livekit-server-sdk');
const egressClient = new EgressClient(
  process.env.LIVEKIT_HOST,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);
module.exports = { roomService, egressClient };
```

2. Thêm env vars vào `.env`:
```
LIVEKIT_HOST=wss://dev-monitor.id.vn
MINIO_RECORDING_BUCKET=session-recordings
```

3. Tạo bucket `session-recordings` trên MinIO nếu chưa có (có thể dùng startup script).

**Acceptance**: `egressClient` import được từ các file khác, không throw lúc khởi động.

---

## TASK BE-2 — Migration: tạo bảng `session_recordings`

**File**: `migrations/YYYYMMDD_create_session_recordings.sql`

```sql
CREATE TABLE session_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  egress_id        TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'recording',
  s3_key           TEXT,
  duration_seconds INT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  started_by       UUID REFERENCES users(id)
);

CREATE INDEX idx_session_recordings_session_id ON session_recordings(session_id);
```

**Acceptance**: Migration chạy thành công, bảng tồn tại trong Postgres.

---

## TASK BE-3 — Service: `recording.service.js`

**File**: `services/recording.service.js`

### Hàm cần implement

#### `startRecording(sessionId, startedByUserId)`
1. Query DB lấy session → kiểm tra `status === 'ongoing'`, lấy `livekit_room_id`
2. Kiểm tra không có recording nào đang `status = 'recording'` cho session này (tránh duplicate)
3. Gọi `egressClient.startRoomCompositeEgress(roomName, output, options)`:
   - `output`: `EncodedFileOutput` trỏ MinIO với `filepath = recordings/{sessionId}/{egressId}.mp4`
   - `options`: layout mặc định (`speaker` hoặc `grid`)
4. Insert row vào `session_recordings` với `egress_id`, `status = 'recording'`
5. Return `{ id, egress_id, started_at }`

#### `stopRecording(sessionId, egressId)`
1. Kiểm tra `session_recordings` tồn tại và thuộc đúng `sessionId`
2. Gọi `egressClient.stopEgress(egressId)`
3. Update `status = 'stopping'` trong DB (file chưa flush xong ngay)
4. Return `{ egress_id, status: 'stopping' }`

> **Lưu ý**: `status = 'completed'` và `s3_key` chỉ được set bởi webhook (TASK BE-4), không set ở đây.

#### `listRecordings(sessionId)`
1. Query `session_recordings` WHERE `session_id = $1` AND `status = 'completed'`
2. Với mỗi row có `s3_key`, generate presigned URL từ MinIO (TTL 4h)
3. Return array:
```js
[{
  id, egress_id, duration_seconds,
  started_at, ended_at,
  download_url,         // presigned URL
  expires_in_seconds: 14400
}]
```

**Acceptance**: Unit test 3 hàm với mock egressClient và mock DB.

---

## TASK BE-4 — Webhook handler: `egress_ended`

**File**: `routes/webhook.routes.js`, `controllers/webhook.controller.js`

### Route
```
POST /api/webhooks/livekit
```
- **QUAN TRỌNG**: Route này phải dùng `express.raw({ type: '*/*' })` thay vì `express.json()` vì cần raw body để verify signature.
- Không cần Bearer token (LiveKit tự ký bằng HMAC).

### Logic controller
```js
const rawBody = req.body; // Buffer
const sig = req.headers['livekit-signature'];
const event = await receiver.receive(rawBody, sig);

if (event.event === 'egress_ended') {
  const { egressId, fileResults, error } = event.egressInfo;
  if (error) {
    // UPDATE session_recordings SET status='failed' WHERE egress_id=$1
  } else {
    const s3Key = fileResults[0]?.filename;      // path trong MinIO
    const duration = fileResults[0]?.duration;   // nanoseconds → chia 1e9
    // UPDATE session_recordings
    //   SET status='completed', s3_key=$1, duration_seconds=$2, ended_at=NOW()
    //   WHERE egress_id=$3
  }
}
res.sendStatus(200);
```

### Đăng ký webhook trong LiveKit Server config
Thêm vào `livekit.yaml` trên EC2 t3.xlarge:
```yaml
webhook:
  urls:
    - https://<backend-domain>/api/webhooks/livekit
  api_key: <LIVEKIT_API_KEY>
```

**Acceptance**: Gửi mock POST đúng format → DB update `status = 'completed'`, `s3_key` có giá trị.

---

## TASK BE-5 — Controller & Routes: recording endpoints

**File**: `controllers/recording.controller.js`, `routes/recording.routes.js`

### Endpoints cần tạo

#### `POST /api/sessions/:sessionId/recordings/start`
- Auth: Bearer token, role `teacher`
- Kiểm tra teacher là owner của class chứa session này
- Gọi `recordingService.startRecording(sessionId, req.user.id)`
- Response `201`:
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
- Errors:
  - `400` — Session không phải `ongoing`
  - `409` — Đã có recording đang chạy
  - `403` — Không phải teacher owner

#### `POST /api/sessions/:sessionId/recordings/stop`
- Auth: Bearer token, role `teacher`
- Body: `{ "egress_id": "EG_xxx" }`
- Kiểm tra teacher là owner
- Gọi `recordingService.stopRecording(sessionId, egressId)`
- Response `200`:
```json
{
  "message": "Recording stopped.",
  "recording": {
    "egress_id": "EG_xxx",
    "status": "stopping"
  }
}
```
- Errors:
  - `404` — egressId không tồn tại hoặc không thuộc session
  - `403` — Không phải teacher owner

#### `GET /api/classes/:classId/recordings`
- Auth: Bearer token, teacher owner hoặc student member của class
- Gọi `recordingService.listRecordings(classId)`
- Response `200`:
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
      "download_url": "http://minio:9000/session-recordings/...?X-Amz-Signature=...",
      "expires_in_seconds": 14400
    }
  ]
}
```
- Errors:
  - `403` — Không có quyền truy cập session
  - `404` — Session không tồn tại

### Đăng ký route vào `app.js`
```js
const recordingRoutes = require('./routes/recording.routes');
app.use('/api', recordingRoutes);
```

**Acceptance**: Test với Postman/curl đủ 3 endpoints, response đúng format.

---

## TASK BE-6 — Cập nhật API docs

**File**: `api-docs.md`

Thêm section `4.7 Recordings` với 3 endpoints mới, theo đúng format hiện tại của file.

---

## Thứ tự thực hiện

```
BE-1 (config) → BE-2 (migration) → BE-3 (service) → BE-4 (webhook) → BE-5 (routes) → BE-6 (docs)
```

BE-3 và BE-4 có thể làm song song sau khi BE-1 và BE-2 xong.