# 📋 Current Tasks — Session Scheduling Feature

---

## ✅ ĐÃ HOÀN THÀNH

### Backend
| Task | Mô tả |
|---|---|
| B-1 | Migration thêm cột `scheduled_at TIMESTAMPTZ` vào bảng `sessions` |
| B-2 | `POST /api/sessions` lưu và trả về `scheduled_at` |
| B-3 | `PATCH /api/sessions/:id` — cập nhật `title`, `scheduledAt` (chỉ status `scheduled`) |
| B-4 | `DELETE /api/sessions/:id` — chỉ xoá được session status `scheduled` |
| B-5 | `GET /api/sessions/my?from=&to=` — trả về sessions kèm `class_name` (JOIN `classes`) |
| B-6 | Tất cả response sessions đều trả về `scheduled_at` |

### Frontend
| Task | Mô tả |
|---|---|
| F-1 | `SessionModel` thêm `scheduledAt`, `className`, `displayTime`, `isEditable`, `isOngoing`, `copyWith` |
| F-2 | `SessionService` — đủ 5 methods: fetch range, fetch by class, create, update, delete |
| F-3 | `SessionProvider` — `loadSessionsForRange`, `createSession`, `updateSession`, `deleteSession`, `startSession` (trả về `SessionModel?`) |
| F-4 | `SessionDataSource` — map `SessionModel` → `Appointment` dùng `displayTime`, `SessionStatus` enum, fallback `endTime = startTime + 1h` |
| F-5 | `CreateSessionDialog` — glassmorphism, create/edit mode, `scheduledAt` gửi lên `.toUtc()` |
| F-6 | `SessionDetailPopup` — read-only cho student, Edit/Delete/Start cho teacher, callback `onStart(SessionModel)` |
| F-7 | `CalendarDesktopScreen` — inject `SessionProvider`, load theo tuần, `onTap` mở popup, loading overlay |
| UI-1 | Xoá sidebar (`CalendarSidebar`, `_MiniMonthCalendar`) khỏi `CalendarDesktopScreen` |
| UI-2 | `CalendarTopBar` — bỏ Work week dropdown, More button, `_CalendarMoreAction` enum |
| UI-3 | Filter lớp — `_ClassFilterButton` + `_ClassFilterPopup`, state `_filteredClassId` |
| UI-4 | "Meet now" — `_MeetNowClassPickerDialog` chọn lớp active, `_startMeetNow` tạo + start session ngay |
| UI-5 | `SessionProvider.createSession` — dùng cho Meet now flow |
| BUG-1 | Timezone: thêm `.toLocal()` trong `SessionModel.fromJson`, `.toUtc()` khi gửi API |
| BUG-2 | `startSession` trả về `SessionModel?`, `SessionDetailPopup` callback `onStart`, navigate sau start |

---

## 🐛 BUG CẦN SỬA

### BUG-3 · Filter lớp không thể reset về "Tất cả lớp"

**Triệu chứng:** Sau khi chọn filter 1 lớp cụ thể, không có cách nào quay lại xem tất cả lớp.

**Nguyên nhân:** `PopupMenuButton` không fire `onSelected` khi `value == null` — đây là behaviour mặc định của Flutter, item có `value: null` bị bỏ qua.

**File:** `lib/features/calendar/screens/calendar_screen.dart` (class `_ClassFilterPopup`)

**Fix:** Chuyển item "Tất cả lớp" sang dùng `onTap` trực tiếp thay vì `onSelected`:

```dart
// Trước — không hoạt động vì value: null bị Flutter bỏ qua
PopupMenuItem<String?>(
  value: null,
  child: ...,
)

// Sau — dùng onTap để gọi callback trực tiếp
PopupMenuItem<String?>(
  onTap: () => onFilterChanged(null),
  child: Row(
    children: [
      Icon(Icons.layers_outlined, size: 18, color: filteredClassId == null ? scheme.primary : scheme.onSurfaceVariant),
      const SizedBox(width: 10),
      Text(
        'Tất cả lớp',
        style: TextStyle(
          color: filteredClassId == null ? scheme.primary : null,
          fontWeight: filteredClassId == null ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      if (filteredClassId == null) ...[
        const Spacer(),
        Icon(Icons.check, size: 16, color: scheme.primary),
      ],
    ],
  ),
),
```

> Các item lớp cụ thể giữ nguyên dùng `value: cls.id` qua `onSelected` — chỉ item "Tất cả lớp" cần fix.

---

### BUG-4 · Session đặt lịch trước không có `end_time` — calendar chip hiển thị sai thời lượng

**Triệu chứng:** Session `scheduled` chưa có `end_time` (DB null). `SessionDataSource` đang fallback `endTime = displayTime + 1 giờ` cứng — teacher muốn tự chọn thời lượng khi đặt lịch.

---

#### BUG-4a · Backend — thêm cột `scheduled_end_at`

**File:** `migrations/add_scheduled_end_at_to_sessions.sql`

```sql
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

ALTER TABLE sessions
  ADD CONSTRAINT chk_sessions_scheduled_time
    CHECK (
      scheduled_end_at IS NULL
      OR scheduled_at IS NULL
      OR scheduled_end_at > scheduled_at
    );
```

**Cập nhật `POST /api/sessions`** — nhận thêm `scheduledEndAt` (optional):

```json
{
  "classId": "uuid",
  "title": "Buoi hoc 1",
  "scheduledAt": "2026-05-05T08:00:00.000Z",
  "scheduledEndAt": "2026-05-05T09:30:00.000Z"
}
```

Validation server-side: nếu có cả hai thì `scheduledEndAt > scheduledAt`.

**Cập nhật `PATCH /api/sessions/:id`** — nhận thêm `scheduledEndAt` (optional).

**Cập nhật tất cả response chứa session object** — thêm `scheduled_end_at`:

```json
{
  "session": {
    "id": "uuid",
    "class_id": "uuid",
    "title": "Buoi hoc 1",
    "scheduled_at": "2026-05-05T08:00:00.000Z",
    "scheduled_end_at": "2026-05-05T09:30:00.000Z",
    "start_time": null,
    "end_time": null,
    "status": "scheduled"
  }
}
```

Endpoints cần cập nhật: `POST /api/sessions`, `PATCH /api/sessions/:id`, `GET /api/sessions/my`, `GET /api/sessions/class/:classId`, `GET /api/sessions/:id`.

---

#### BUG-4b · Frontend — thêm `scheduledEndAt` vào `SessionModel`

**File:** `lib/features/session/models/session_model.dart`

```dart
// Thêm field
final DateTime? scheduledEndAt;

// Trong fromJson — parse + toLocal()
scheduledEndAt: json['scheduled_end_at'] != null
    ? DateTime.parse(json['scheduled_end_at'] as String).toLocal() : null,

// Trong copyWith
DateTime? scheduledEndAt,
// ...
scheduledEndAt: scheduledEndAt ?? this.scheduledEndAt,

// Getter mới — display end time cho calendar chip
DateTime? get displayEndTime => scheduledEndAt ?? endTime;
```

---

#### BUG-4c · Frontend — cập nhật `SessionDataSource` dùng `displayEndTime`

**File:** `lib/features/session/screens/widgets/session_data_source.dart`

```dart
// Trước
endTime: s.displayTime!.add(const Duration(hours: 1)),

// Sau — dùng displayEndTime nếu có, chỉ fallback +1h khi không có
endTime: s.displayEndTime ?? s.displayTime!.add(const Duration(hours: 1)),
```

---

#### BUG-4d · Frontend — cập nhật `CreateSessionDialog` thêm trường "Giờ kết thúc"

**File:** `lib/features/session/screens/widgets/create_session_dialog.dart`

Thêm `DateTimePicker` thứ 2 cho `scheduledEndAt`, đặt ngay dưới picker giờ bắt đầu:
- Chỉ hiển thị khi `_scheduledAt != null`.
- Default: `_scheduledAt + 1 giờ` khi user vừa chọn giờ bắt đầu.
- Validate trước submit: `_scheduledEndAt` phải sau `_scheduledAt`.
- Gửi lên API dưới dạng UTC.

```dart
// State
DateTime? _scheduledAt;
DateTime? _scheduledEndAt;

// Khi user chọn _scheduledAt — auto-fill end
onScheduledAtChanged: (dt) {
  setState(() {
    _scheduledAt = dt;
    // Auto-fill giờ kết thúc nếu chưa có hoặc end <= start mới
    if (_scheduledEndAt == null || !_scheduledEndAt!.isAfter(dt)) {
      _scheduledEndAt = dt.add(const Duration(hours: 1));
    }
  });
},

// Validate trước khi submit
if (_scheduledAt != null &&
    _scheduledEndAt != null &&
    !_scheduledEndAt!.isAfter(_scheduledAt!)) {
  // Show error: "Giờ kết thúc phải sau giờ bắt đầu"
  return;
}

// Gửi API
await sessionProvider.createSession(
  classId: _selectedClassId!,
  title: _titleController.text.trim(),
  scheduledAt: _scheduledAt?.toUtc(),
  scheduledEndAt: _scheduledEndAt?.toUtc(),
);
```

---

#### BUG-4e · Frontend — cập nhật `SessionService` truyền `scheduledEndAt`

**File:** `lib/features/session/services/session_service.dart`

```dart
Future<SessionModel> createSession({
  required String classId,
  required String title,
  DateTime? scheduledAt,
  DateTime? scheduledEndAt,   // ← thêm
});

Future<SessionModel> updateSession({
  required String sessionId,
  String? title,
  DateTime? scheduledAt,
  DateTime? scheduledEndAt,   // ← thêm
});
```

---

## ✅ Thứ tự fix

**BUG-3** — 1 file, độc lập, fix ngay.

**BUG-4** — theo thứ tự:
```
BUG-4a (migration + backend endpoints)
  → BUG-4b (SessionModel thêm field + getter)
  → BUG-4e (SessionService thêm param)
  → BUG-4c (SessionDataSource dùng displayEndTime)
  → BUG-4d (CreateSessionDialog thêm picker giờ kết thúc)
```