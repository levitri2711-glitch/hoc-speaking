// Văn bản pháp lý (tự soạn) – nên nhờ luật sư rà soát trước khi mở rộng ra công chúng.
(function () {
  const OWNER = 'Quản trị viên Học speaking (cá nhân, dùng nội bộ, chưa đăng ký pháp lý với cơ quan chức năng)';
  const CONTACT = 'email của quản trị viên (trang Cài đặt → liên hệ người đã mời bạn)';
  const UPDATED = '16/11/2026';
  const PAGES = {
    privacy: ['Chính sách bảo mật', `
      <h2>1. Dữ liệu chúng tôi thu thập</h2>
      <ul><li><b>Email</b>: để gửi link đăng nhập và thông báo. Không có mật khẩu.</li>
      <li><b>Bản ghi âm</b> câu trả lời Speaking của bạn, bản chép lời và kết quả chấm (band, nhận xét, lỗi).</li>
      <li><b>Cài đặt</b>: band mục tiêu, giọng đọc; câu hỏi bạn tự thêm.</li>
      <li><b>Nhật ký hệ thống</b>: đăng nhập, thay đổi quyền, lượt dùng AI — để bảo mật và chống lạm dụng.</li></ul>
      <h2>2. Mục đích</h2>
      <p>Chỉ để vận hành việc luyện tập: chấm bài, lưu tiến bộ, giáo viên nhận xét, quản trị quyền. Không bán, không cho thuê, không dùng cho quảng cáo.</p>
      <h2>3. Nơi lưu trữ và bên thứ ba</h2>
      <ul><li>Dữ liệu và bản ghi âm lưu trên Google Sheets / Google Drive của quản trị viên (Google Apps Script).</li>
      <li><b>Chấm điểm</b>: bản ghi âm và câu hỏi được gửi tới <b>Google Gemini API</b> để nghe và chấm. Ở gói miễn phí, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm của Google. Không gửi email hay tên của bạn kèm bản ghi.</li>
      <li><b>Phụ đề tức thời</b> khi đang nói dùng bộ nhận giọng nói của trình duyệt (Chrome gửi âm thanh tới Google, Safari dùng dịch vụ của Apple).</li>
      <li>Giọng giám khảo là giọng đọc có sẵn của trình duyệt / hệ điều hành.</li></ul>
      <p>Vì vậy: <b>đừng nói thông tin nhạy cảm</b> (số giấy tờ, địa chỉ cụ thể, thông tin sức khoẻ…) trong bài luyện.</p>
      <h2>4. Thời gian lưu</h2>
      <p>Lưu khi tài khoản còn hoạt động. Bạn tự xoá được từng bài (xoá cả file ghi âm) trong trang kết quả. Khi quyền bị thu hồi hoặc bạn yêu cầu, dữ liệu được xoá trong 30 ngày; nhật ký bảo mật giữ tối đa 12 tháng.</p>
      <h2>5. Quyền của bạn</h2>
      <p>Yêu cầu xem, sửa, xuất hoặc xoá dữ liệu bằng cách liên hệ ${CONTACT}.</p>
      <h2>6. Bảo mật</h2>
      <p>Link đăng nhập dùng một lần, hết hạn sau 15 phút; phiên đăng nhập ký điện tử, hết hạn sau 30 ngày; mọi thao tác được kiểm tra quyền ở máy chủ; chỉ bạn và giáo viên (Editor/Owner) nghe được bản ghi của bạn.</p>`],
    terms: ['Điều khoản sử dụng', `
      <h2>1. Tài khoản và quyền truy cập</h2>
      <p>Học speaking là ứng dụng luyện tập nội bộ do ${OWNER} vận hành. Quyền (Viewer, Học viên, Editor) do quản trị viên cấp và có thể thu hồi bất cứ lúc nào. Không chia sẻ link đăng nhập.</p>
      <h2>2. Nội dung</h2>
      <ul><li>Ngân hàng câu hỏi và câu mẫu chỉ dùng cho việc học cá nhân, không sao chép để kinh doanh hay đăng lại.</li>
      <li>Bạn chịu trách nhiệm về câu hỏi bạn thêm và nội dung bạn nói; không đưa nội dung vi phạm pháp luật hoặc bản quyền.</li></ul>
      <h2>3. Hạn mức</h2>
      <p>Mỗi tài khoản có số lượt chấm AI mỗi ngày do quản trị viên đặt (để dùng miễn phí bền vững). Hết lượt thì bài được lưu và chấm vào ngày hôm sau.</p>
      <h2>4. Hành vi bị cấm</h2>
      <p>Truy cập trái phép, gửi yêu cầu tự động hàng loạt, cố tình làm cạn hạn mức chung, giả mạo người khác.</p>
      <h2>5. Thay đổi dịch vụ</h2>
      <p>Tính năng có thể thay đổi, tạm dừng để bảo trì; chấm AI có thể tự tắt nếu dịch vụ bên thứ ba có dấu hiệu tính phí.</p>`],
    disclaimer: ['Miễn trừ trách nhiệm', `
      <ul><li>Band điểm là <b>ước lượng của AI</b> dựa trên band descriptors công khai, chỉ để tham khảo; không phải điểm IELTS chính thức và không thay thế giám khảo được cấp phép.</li>
      <li>IELTS là thương hiệu của British Council, IDP: IELTS Australia và Cambridge University Press &amp; Assessment. Học speaking không liên kết hay được bảo trợ bởi các tổ chức này.</li>
      <li>Câu hỏi forecast là dự đoán từ tài liệu tham khảo, không bảo đảm xuất hiện trong kỳ thi thật.</li>
      <li>Kết quả học tập phụ thuộc vào việc luyện tập; chúng tôi không cam kết điểm số cụ thể.</li>
      <li>Dịch vụ bên thứ ba (Google Gemini, Google Drive, trình duyệt) có chính sách riêng; chúng tôi không chịu trách nhiệm khi các dịch vụ đó gián đoạn.</li></ul>`],
    complaints: ['Tiếp nhận và xử lý khiếu nại', `
      <h2>Bước 1</h2><p>Gửi email tới ${CONTACT}: email tài khoản, mô tả vấn đề, ảnh chụp màn hình (nếu có). Muốn phúc khảo điểm: ghi rõ bài nào — giáo viên sẽ nghe lại và chấm tay.</p>
      <h2>Bước 2</h2><p>Xác nhận đã nhận trong 2 ngày làm việc.</p>
      <h2>Bước 3</h2><p>Lỗi kỹ thuật: 2–5 ngày làm việc. Điểm, nội dung, quyền truy cập: 7 ngày làm việc.</p>
      <h2>Bước 4</h2><p>Kết quả gửi lại qua email.</p>`],
  };

  function view(key, shell, loggedIn) {
    const p = PAGES[key];
    const body = p ? `<div class="narrow"><h1>${p[0]}</h1><p class="small muted">Cập nhật: ${UPDATED} · Đơn vị vận hành: ${OWNER}</p>${p[1]}
      <p class="small"><a href="#/legal/privacy">Bảo mật</a> · <a href="#/legal/terms">Điều khoản</a> · <a href="#/legal/disclaimer">Miễn trừ</a> · <a href="#/legal/complaints">Khiếu nại</a> · <a href="#/">Trang chủ</a></p></div>`
      : '<div class="notice bad">Không tìm thấy trang.</div>';
    if (loggedIn) shell('settings', body);
    else document.getElementById('app').innerHTML = `<main>${body}</main>`;
  }
  window.HSLegal = { view };
})();
