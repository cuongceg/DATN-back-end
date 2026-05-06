# CLAUDE.md — Backend: Meeting Feature (LiveKit)

## Tổng quan dự án
Ứng dụng lớp học trực tuyến dành cho **học sinh khiếm thính**, tương tự Microsoft Teams.
Backend sử dụng **ExpressJS + PostgreSQL**, tích hợp **LiveKit** để xử lý video/audio meeting.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** ExpressJS
- **Database:** PostgreSQL (sử dụng `pg` hoặc ORM như Sequelize/Knex)
- **Video/Audio:** LiveKit Server (self-hosted trên EC2)
- **Auth:** JWT
- **Architecture:** MVC

## Folder Structure
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

## Quy tắc code

### Naming Convention
- **Files:** `kebab-case` hoặc `camelCase.type.js` (nhất quán với codebase hiện tại)
- **Functions:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **DB columns:** `snake_case`

### Controller Pattern
```js
// Luôn dùng try/catch và gọi next(err) khi có lỗi
export const createMeeting = async (req, res, next) => {
  try {
    const result = await meetingService.create(req.body, req.user);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
```

### Service Pattern
```js
// Business logic thuần túy, không đụng req/res
export const generateToken = async (roomName, userId, role) => {
  // logic ở đây
};
```

### Response Format (nhất quán toàn app)
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "message": "Mô tả lỗi" }
```

## Environment Variables liên quan đến Meeting
```env
# Server
PORT=

# PostgreSQL
DATABASE_URL=

# JWT
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=7d

# LiveKit
LIVEKIT_URL=wss://dev-monitor.id.vn
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

## Nguyên tắc quan trọng
1. **Không hardcode** API key/secret — luôn đọc từ `process.env`
2. **Validate input** tại middleware trước khi vào controller
3. **Phân quyền rõ ràng** — teacher (host) vs student (participant)
4. **Meeting gắn với Class** — không tạo meeting độc lập, phải thuộc 1 classroom
5. **Ghi log** trạng thái meeting vào DB để tracking lịch sử