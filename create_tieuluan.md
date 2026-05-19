# Prompt tạo tiểu luận Phân tích thiết kế hệ thống thông tin

Bạn là trợ lý học thuật/kỹ thuật. Nhiệm vụ của bạn là đọc giáo trình, đọc tài liệu/mã nguồn của dự án hiện tại, rồi soạn một tiểu luận hoàn chỉnh dưới dạng Markdown và có thể xuất sang Word.

## 1. Đầu vào

Trong thư mục dự án hiện tại có thể có:

- Một file giáo trình PDF về **Phân tích thiết kế các hệ thống thông tin**.
- Mã nguồn dự án.
- README, docs, API docs, database schema hoặc các tài liệu kỹ thuật khác.

Hãy tự khảo sát các file hiện có để hiểu hệ thống. Nếu có nhiều tài liệu, ưu tiên:

1. README/tài liệu tổng quan.
2. Tài liệu kiến trúc.
3. Tài liệu API/giao thức.
4. Tài liệu CSDL.
5. Mã nguồn liên quan nghiệp vụ.
6. File cấu hình triển khai.

## 2. Nhiệm vụ

Tạo thư mục:

`docs/tieuluan/`

Tạo ít nhất các file:

1. `README.md` — tiểu luận chính.
2. `so-sanh-nen-tang.md` — phụ lục so sánh với các nền tảng/hệ thống tương tự.

Nếu được yêu cầu xuất Word, tạo thêm:

3. `<ten-de-tai-hoac-ten-du-an>_TieuLuan.docx`

## 3. Cách xác định đề tài

Nếu người dùng đã đưa đề tài, dùng đúng đề tài đó.

Nếu chưa có đề tài, hãy tự đặt đề tài theo mẫu:

**Phân tích và thiết kế hệ thống <tên/loại hệ thống của dự án>**

Ví dụ:

- Phân tích và thiết kế hệ thống quản lý nền tảng ảo hóa máy chủ.
- Phân tích và thiết kế hệ thống quản lý proxy nội bộ.
- Phân tích và thiết kế hệ thống quản lý bán hàng.
- Phân tích và thiết kế hệ thống quản lý học tập.

## 4. Bám sát giáo trình

Tiểu luận phải bám theo phương pháp phân tích thiết kế hệ thống thông tin trong giáo trình. Không cần chép dài giáo trình, nhưng phải vận dụng đúng các ý chính:

- Khái niệm hệ thống thông tin.
- Dữ liệu, thông tin, xử lý, lưu trữ, phân phối, biểu diễn thông tin.
- Vòng đời phát triển hệ thống thông tin.
- Khảo sát hiện trạng.
- Xác định vấn đề và mục tiêu hệ thống mới.
- Xác định yêu cầu chức năng/phi chức năng.
- Mô hình nghiệp vụ.
- Biểu đồ ngữ cảnh.
- Biểu đồ phân rã chức năng.
- Biểu đồ luồng dữ liệu DFD.
- Mô hình dữ liệu quan niệm/ERD.
- Thiết kế dữ liệu logic.
- Thiết kế kiến trúc hệ thống.
- Thiết kế xử lý chính.
- Thiết kế giao diện/báo cáo.
- Thiết kế kiểm soát, an toàn, vận hành.
- Đánh giá khả thi.
- Kết luận.

Bắt buộc có một mục riêng:

## Chứng minh hệ thống là một hệ thống thông tin

Trong mục này, đối chiếu hệ thống với định nghĩa HTTT:

| Tiêu chí HTTT | Biểu hiện trong dự án |
|---|---|
| Thu thập dữ liệu | ... |
| Xử lý dữ liệu | ... |
| Lưu trữ dữ liệu | ... |
| Phân phối thông tin | ... |
| Biểu diễn/trình diễn thông tin | ... |
| Hỗ trợ quyết định/kiểm soát | ... |

## 5. Cấu trúc tiểu luận chính

File `docs/tieuluan/README.md` nên có cấu trúc:

1. Mở đầu
   - Lý do chọn đề tài.
   - Phạm vi đề tài.
   - Phương pháp thực hiện.
2. Cơ sở lý thuyết theo giáo trình.
3. Chứng minh hệ thống là một hệ thống thông tin.
4. Khảo sát hiện trạng.
5. Xác định yêu cầu.
6. Mô hình nghiệp vụ.
7. Mô hình hóa tiến trình và luồng dữ liệu.
8. Mô hình dữ liệu quan niệm và logic.
9. Thiết kế kiến trúc hệ thống.
10. Thiết kế xử lý chính.
11. Thiết kế giao diện và báo cáo.
12. Thiết kế kiểm soát, an toàn và vận hành.
13. Đánh giá khả thi.
14. Kết luận.
15. Tài liệu tham khảo.

## 6. Yêu cầu biểu đồ

Dùng Mermaid cho các biểu đồ trong Markdown. Tối thiểu nên có:

- Biểu đồ vòng đời phát triển HTTT.
- Biểu đồ ngữ cảnh.
- Biểu đồ phân rã chức năng.
- DFD mức 0.
- DFD mức 1 cho một quy trình nghiệp vụ chính.
- Sequence diagram cho quy trình nghiệp vụ chính.
- Sequence diagram hoặc flowchart cho cập nhật/trạng thái/đồng bộ dữ liệu.
- ERD.
- Kiến trúc tổng thể.
- Flow xử lý nghiệp vụ quan trọng.
- Flow kiểm soát truy cập.

Nếu xuất Word, cần render Mermaid thành ảnh và chèn vào Word. Ảnh biểu đồ phải:

- Nền trắng.
- Chữ đen.
- Đường nét đen/xám.
- Dễ đọc khi in trắng đen.

## 7. Phụ lục so sánh nền tảng/hệ thống tương tự

Tạo file:

`docs/tieuluan/so-sanh-nen-tang.md`

Nội dung:

- Xác định 5–8 nền tảng/hệ thống tương tự với dự án.
- So sánh theo các tiêu chí phù hợp.
- Chỉ ra dự án giống gì và khác gì.
- Chỉ ra điểm mạnh, điểm yếu, kịch bản phù hợp.
- Không viết chung chung; phải gắn với tính năng thực tế của dự án.

Gợi ý tiêu chí:

| Tiêu chí | Ý nghĩa |
|---|---|
| Đối tượng phục vụ | Dự án phục vụ ai |
| Chức năng chính | Hệ thống giải quyết bài toán nào |
| Kiến trúc | Tập trung, phân tán, client-server, agent-based... |
| Quản lý dữ liệu | Dữ liệu nào, lưu ở đâu |
| Tự động hóa | Có tự động hóa nghiệp vụ/vận hành không |
| Phân quyền | User/admin/role |
| Mở rộng | Khả năng thêm module/plugin/node/tính năng |
| Độ phức tạp | Dễ/khó triển khai vận hành |

## 8. Yêu cầu format Word nếu xuất DOCX

Nếu tạo file Word `.docx`, áp dụng chuẩn:

- Khổ giấy: A4.
- Lề: trái 3cm, phải 2cm, trên 2.5cm, dưới 2.5cm.
- Font toàn bộ: Times New Roman.
- Tiêu đề bài: 15pt, in đậm, căn giữa.
- Tên tác giả: 14pt, in đậm, căn giữa.
- Cơ quan/đơn vị: 14pt, in nghiêng, căn giữa.
- Sa-pô/tóm tắt: 14pt, in nghiêng, căn đều hai bên, có viền trên/dưới.
- Từ khóa: 14pt; nhãn “Từ khóa:” in đậm; nội dung thường.
- Tiêu đề mục cấp 1/2/3: 14pt, in đậm, căn trái, spacing before 160 / after 80.
- Thân bài: 14pt, căn đều hai bên, giãn dòng 1.5, thụt đầu dòng 1.27cm.
- Tài liệu tham khảo: 14pt, hanging indent, dòng thứ hai trở đi thụt vào.
- Bảng: Times New Roman 12–14pt, viền rõ, nội dung dễ đọc.
- Biểu đồ: render thành ảnh nền trắng, chữ đen, đường nét đen/xám.

## 9. Phong cách viết

- Viết tiếng Việt.
- Văn phong tiểu luận đại học.
- Rõ ràng, mạch lạc, có bảng, có biểu đồ.
- Không quá ngắn.
- Không lan man quá sâu vào code.
- Luôn liên hệ với giáo trình phân tích thiết kế HTTT.
- Bám sát dự án thực tế, nhưng trình bày ở mức phân tích/thiết kế hệ thống.

## 10. Kiểm tra sau khi tạo

Sau khi tạo xong:

1. Kiểm tra các file tồn tại.
2. Kiểm tra Mermaid fence đầy đủ.
3. Kiểm tra nội dung không bịa quá xa so với dự án.
4. Kiểm tra thuật ngữ dùng nhất quán.
5. Kiểm tra phụ lục so sánh có chiều sâu.
6. Nếu có DOCX, kiểm tra format Word đúng chuẩn và biểu đồ đã là ảnh.
7. In danh sách file đã tạo.
