# Chiến lược mở rộng Danh mục học phần (`/courses`)

Tài liệu này ghi nhận thiết kế kiến trúc và UX đã triển khai sẵn cho trang `/courses` để vận hành mượt từ **6 học phần hiện tại** lên **vài chục hoặc hàng trăm học phần** mà vẫn giữ kiến trúc static frontend thuần (không cần backend/server).

---

## 1. Giới hạn của mô hình quỹ đạo đơn khi quy mô tăng

Thành phần `OrbitalCourseUniverse` đặt các thẻ học phần (`248px`) quay quanh `Hạt nhân tìm kiếm` trung tâm:

- **Giới hạn thị giác:** Quá ~6–8 thẻ trên cùng một ellipse sẽ gây chồng lấn giữa các thẻ hoặc che hạt nhân trung tâm.
- **Giới hạn DOM/GPU:** Giữ hàng trăm thẻ ẩn (`opacity: 0`) kèm `backdrop-blur` và animation trôi nổi trong DOM sẽ gây tốn bộ nhớ và giảm FPS khi gõ tìm kiếm.

---

## 2. Cơ chế đã triển khai sẵn trong mã nguồn

Toàn bộ logic quy mô nằm ở lớp core thuần TypeScript (`src/core/courses/search.ts`), tách khỏi React để dễ kiểm thử và tái sử dụng:

| Hằng số / Hàm | Giá trị mặc định | Vai trò |
| --- | --- | --- |
| `DEFAULT_ORBIT_PAGE_SIZE` | `6` | Số lượng thẻ tối đa hiển thị đồng thời trên vòng quỹ đạo (**O(1) DOM nodes**). |
| `AUTO_LIST_THRESHOLD` | `18` | Ngưỡng tự động chuyển chế độ hiển thị mặc định sang `list` khi tổng số học phần `>= 18`. |
| `DEFAULT_LIST_PAGE_SIZE` | `24` | Số học phần hiển thị mỗi lượt trong chế độ danh sách, mở rộng dần qua nút `"Xem thêm học phần"`. |
| `filterCourses(...)` | Relevance ranking | Xếp hạng kết quả khớp từ khóa: khớp chính xác mã học phần (`100`) → tiền tố mã (`85`) → tiền tố tiêu đề (`70`) → chuỗi con tiêu đề (`55`) → tên lĩnh vực (`30`), cộng `+5` cho học phần `available`. |
| `paginateItems(...)` | Safe clamping | Cắt lát tập kết quả thành từng cửa sổ trang an toàn cho cả chế độ quỹ đạo và danh sách. |
| `recommendCoursesLayout(n)` | `'orbit' \| 'list'` | Chọn layout khởi tạo tối ưu theo quy mô danh mục; người dùng luôn có thể chuyển qua lại thủ công. |

### Cách `OrbitalCourseUniverse` thích ứng tự động

1. **Danh mục gọn (`<= 6` học phần — hiện tại):**
   - Toàn bộ học phần nằm trong pool quỹ đạo; khi gõ từ khóa, các môn không khớp bay mượt sang trái/phải và mờ dần, các môn khớp lướt vào vị trí trái/phải cạnh hạt nhân tìm kiếm.
   - Không hiển thị thanh chuyển trang quỹ đạo để giữ giao diện tối giản.
2. **Danh mục trung bình & lớn (`> 6` học phần — vài chục đến hàng trăm môn):**
   - Quỹ đạo tự động chuyển sang **O(1) bounded window**: chỉ mount đúng **6 học phần phù hợp nhất** của trang quỹ đạo hiện tại.
   - Thanh điều hướng **`Trước` · `Quỹ đạo X/Y` · `Sau`** tự động xuất hiện bên trong `Hạt nhân tìm kiếm`.
   - Mỗi khi từ khóa hoặc bộ lọc thay đổi, trang quỹ đạo tự động quay về trang 1 để luôn hiển thị top kết quả có điểm xếp hạng cao nhất.
   - Khi tổng số học phần đạt `>= 18`, `/courses` mặc định mở ở chế độ **Danh sách (`list`)** có phân trang tăng dần (`24` môn/lượt) để dễ quét nhanh, trong khi chế độ **Bản đồ nguyên tử (`orbit`)** vẫn sẵn sàng chỉ với một cú bấm.
3. **Trạng thái không tìm thấy (`0` kết quả khớp):**
   - `Hạt nhân tìm kiếm` trượt mượt lên trên (`lg:top-[32%]`) và hiển thị thẻ **`Không tìm thấy`** kèm nút đặt lại bộ lọc ngay bên dưới.
4. **Bộ gõ tiếng Việt (Windows Telex / IME):**
   - `SearchInput` giữ buffer cục bộ trong quá trình composition (`compositionstart` / `compositionend` / `isComposing`) và `CoursesPage` debounce đồng bộ URL `?q=` (`240ms`), tránh nhảy chữ kể cả khi danh mục có hàng trăm môn.

---

## 3. Lộ trình mở rộng tiếp theo (chỉ kích hoạt khi đạt ngưỡng thực tế)

Theo nguyên tắc YAGNI, các bước dưới đây **chưa cài thêm thư viện hay tạo boilerplate** cho tới khi dữ liệu thực tế đạt ngưỡng:

1. **Khi đạt ~30+ học phần có đầy đủ bài giảng Markdown (full-text search):**
   - Tách `search-index.ts` thành các chunk lazy-load theo lĩnh vực hoặc học phần, chỉ tải khi người dùng focus vào ô tìm kiếm hoặc gõ từ khóa để giữ bundle khởi động nhỏ.
2. **Khi đạt ~50+ học phần:**
   - Bổ sung bộ lọc học vụ trên `Course` (học kỳ, khối kiến thức đại cương / cơ sở ngành / chuyên ngành) để thu hẹp tập môn nhanh hơn.
3. **Khi đạt ~200+ học phần:**
   - Cân nhắc thêm 2 tầng quỹ đạo (Lĩnh vực → Học phần) hoặc list virtualization cho chế độ danh sách nếu người dùng thường xuyên mở toàn bộ danh mục.
