# BE_SKILLS.md — LiveKit Recording (Backend)

## Stack & môi trường

- **Runtime**: Node.js + ExpressJS (đã deploy trên EC2 t3.micro)
- **Database**: PostgreSQL (đã có — dùng cho sessions, users, classes, files)
- **Object storage**: MinIO (đã dùng cho `/api/files`) — sẽ dùng lại cho recording output
- **LiveKit SDK**: `livekit-server-sdk` (đã có trong `livekit_service.js`)
- **LiveKit Egress**: chạy trên EC2 t3.xlarge (cùng máy với LiveKit Server + Redis)
- **Auth**: JWT Bearer token — middleware đã có sẵn

---

## Kiến trúc hiện tại liên quan

```
livekit_service.js        → generateLiveKitToken, createRoom, deleteRoom, getActiveParticipants
config/livekit.js         → roomService (RoomServiceClient)
/api/sessions/:id/start   → tạo LiveKit room, trả livekit_room_id về DB
/api/sessions/:id/token   → cấp JWT cho participant join room
/api/files/...            → MinIO presigned URL pattern (tham khảo để làm recording)
```

---

## Kiến thức cần có để implement

### 1. LiveKit Egress API
- `EgressClient` từ `livekit-server-sdk` — khác với `RoomServiceClient` đang dùng
- `startRoomCompositeEgress(roomName, output, options)` — record toàn bộ room
- `stopEgress(egressId)` — dừng recording
- `listEgress({ roomName })` — kiểm tra egress đang chạy
- Output type cần dùng: `EncodedFileOutput` với `filepath` trỏ tới MinIO/S3

```js
// Khởi tạo EgressClient
const { EgressClient } = require('livekit-server-sdk');
const egressClient = new EgressClient(
  process.env.LIVEKIT_HOST,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);
```

### 2. Egress output config cho MinIO
Egress hỗ trợ S3-compatible storage. MinIO dùng đúng format này:

```js
const output = {
  fileOutputs: [{
    filepath: `recordings/{room_name}/{egress_id}.mp4`,
    s3: {
      accessKey: process.env.MINIO_ACCESS_KEY,
      secret: process.env.MINIO_SECRET_KEY,
      region: 'us-east-1',           // MinIO không quan trọng region
      bucket: process.env.MINIO_RECORDING_BUCKET,
      endpoint: process.env.MINIO_ENDPOINT, // http://minio-host:9000
      forcePathStyle: true,           // BẮT BUỘC cho MinIO
    }
  }]
};
```

### 3. LiveKit Webhook (egress_ended event)
- Egress gửi webhook HTTP POST khi recording kết thúc
- Payload chứa `egressId`, `fileResults[0].filename`, `fileResults[0].duration`
- Dùng `WebhookReceiver` từ SDK để verify signature
- Đây là cách duy nhất lấy được `s3_key` chính xác và `duration_seconds` sau khi stop

```js
const { WebhookReceiver } = require('livekit-server-sdk');
const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);
// req phải là raw body (không qua JSON parser)
const event = await receiver.receive(rawBody, req.headers['livekit-signature']);
if (event.event === 'egress_ended') { /* cập nhật DB */ }
```

### 4. MinIO Presigned URL cho video
Pattern đã có sẵn ở `/api/files` — áp dụng y chang cho recordings:

```js
const url = await minioClient.presignedGetObject(
  process.env.MINIO_RECORDING_BUCKET,
  s3Key,
  4 * 60 * 60  // TTL 4 giờ (đủ cho video dài)
);
```

### 5. Role check trong recording context
- Dùng `req.user.role` từ JWT middleware đã có
- Chỉ `teacher` (owner của class) được start/stop
- `teacher` + `student` member đều được xem list recordings
- Map với pattern hiện tại: giống `/api/sessions/:id/start` chỉ cho `teacher`

### 6. DB schema mới cần thêm — bảng `session_recordings`

```sql
CREATE TABLE session_recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  egress_id       TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'recording',
  -- 'recording' | 'completed' | 'failed'
  s3_key          TEXT,           -- null cho đến khi webhook egress_ended về
  duration_seconds INT,           -- null cho đến khi webhook về
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  started_by      UUID REFERENCES users(id)
);
```

---

## Conventions & patterns cần tuân thủ

- **Response format**: giống toàn bộ API hiện tại — `{ message, <entity> }` hoặc `{ <entities>[] }`
- **Error format**: `{ message: "..." }` với HTTP status phù hợp
- **Auth middleware**: `authenticate` (đã có) + `requireRole(['teacher'])` nếu cần
- **Naming**: snake_case trong DB và response JSON, camelCase trong JS
- **Không dùng** `multipart/form-data` cho recording endpoints — tất cả là JSON
- **Webhook endpoint** cần `express.raw()` thay vì `express.json()` để verify signature
- **MinIO bucket** cho recordings nên tách riêng khỏi bucket `class-files` hiện tại