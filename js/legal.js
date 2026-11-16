// Văn bản pháp lý (tự soạn) – nên nhờ luật sư rà soát trước khi mở rộng ra công chúng.
(function () {
  const OWNER = 'Quản trị viên Học speaking (chưa đăng ký pháp lý với cơ quan chức năng)';
  const CONTACT = 'levitri2711@gmail.com';
  const UPDATED = '16/11/2026';
  const PAGES = {
    privacy: ['Chính sách bảo mật', `
      <p class="small">Áp dụng theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026) và văn bản hướng dẫn; với người dùng ở Liên minh châu Âu, áp dụng thêm các nguyên tắc của GDPR. Bên kiểm soát và xử lý dữ liệu: ${OWNER}.</p>
      <h2>1. Dữ liệu thu thập</h2>
      <ul><li><b>Email</b>: để gửi link đăng nhập và thông báo. Không có mật khẩu.</li>
      <li><b>Bản ghi âm giọng nói</b> câu trả lời Speaking, bản chép lời và kết quả chấm. Giọng nói <b>không</b> được dùng để nhận dạng hay xác thực danh tính.</li>
      <li><b>Cài đặt</b>: band mục tiêu, giọng đọc; câu hỏi bạn tự thêm.</li>
      <li><b>Nhật ký hệ thống</b>: đăng nhập, thay đổi quyền, lượt dùng AI, để bảo mật và chống lạm dụng.</li></ul>
      <p>Không thu thập: tên thật, số điện thoại, giấy tờ tuỳ thân, vị trí, dữ liệu thanh toán. Ứng dụng <b>không</b> thu phí và không quảng cáo.</p>
      <h2>2. Mục đích và căn cứ</h2>
      <p>Chỉ để vận hành việc luyện tập: chấm bài, lưu tiến bộ, giáo viên nhận xét, quản trị quyền. Căn cứ xử lý: <b>sự đồng ý</b> của bạn ở lần đăng nhập đầu tiên. Không bán, không cho thuê, không dùng cho quảng cáo hay mục đích khác.</p>
      <h2>3. Nơi lưu trữ, bên thứ ba và chuyển dữ liệu ra nước ngoài</h2>
      <ul><li>Dữ liệu và bản ghi âm lưu trên Google Sheets / Google Drive của quản trị viên (Google Apps Script). Máy chủ của Google có thể đặt ngoài Việt Nam.</li>
      <li><b>Chấm điểm</b>: bản ghi âm và câu hỏi được gửi tới <b>Google Gemini API</b> (Google LLC, Hoa Kỳ). Không gửi email hay tên kèm bản ghi. Ở gói miễn phí, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm, và người kiểm duyệt của Google có thể xem nội dung đó.</li>
      <li><b>Phụ đề tức thời</b> khi đang nói dùng bộ nhận giọng nói của trình duyệt (Chrome gửi âm thanh tới Google, Safari dùng dịch vụ của Apple).</li>
      <li>Giọng giám khảo là giọng đọc có sẵn của trình duyệt / hệ điều hành.</li></ul>
      <p>Vì vậy: <b>đừng nói dữ liệu nhạy cảm</b> (số giấy tờ, địa chỉ cụ thể, sức khoẻ, tôn giáo, chính trị, tài chính…) trong bài luyện.</p>
      <h2>4. Thời gian lưu</h2>
      <ul><li>File ghi âm: <b>tự xoá sau 180 ngày</b> (kết quả chấm vẫn giữ để theo dõi tiến bộ).</li>
      <li>Kết quả, cài đặt: khi tài khoản còn hoạt động. Khi quyền bị thu hồi hoặc bạn yêu cầu: xoá trong 30 ngày.</li>
      <li>Nhật ký bảo mật: tối đa 12 tháng.</li></ul>
      <h2>5. Quyền của bạn</h2>
      <p>Bạn có quyền được biết, đồng ý hoặc rút lại đồng ý, xem, chỉnh sửa, xoá, hạn chế xử lý, phản đối xử lý, nhận bản sao dữ liệu, khiếu nại và yêu cầu bồi thường theo pháp luật.</p>
      <ul><li>Tự xoá từng bài trong trang kết quả, hoặc <b>Cài đặt → Xoá toàn bộ dữ liệu của tôi</b> (xoá ngay, đồng thời rút lại đồng ý).</li>
      <li>Yêu cầu khác (xem, sửa, xuất dữ liệu): liên hệ ${CONTACT}; trả lời trong 72 giờ làm việc.</li>
      <li>Bạn có thể khiếu nại tới cơ quan chuyên trách bảo vệ dữ liệu cá nhân (Bộ Công an).</li></ul>
      <h2>6. Độ tuổi</h2>
      <p>Chỉ dành cho người <b>từ 18 tuổi trở lên</b>, vì điều khoản của Google Gemini API không cho phép dịch vụ dành cho người dưới 18 tuổi.</p>
      <h2>7. Bảo mật và sự cố</h2>
      <p>Link đăng nhập dùng một lần, hết hạn sau 15 phút; phiên đăng nhập ký điện tử, hết hạn sau 30 ngày; mọi thao tác được kiểm tra quyền ở máy chủ; chỉ bạn và giáo viên (Editor/Owner) nghe được bản ghi của bạn; khoá API chỉ nằm ở máy chủ, không có trong trang web. Nếu xảy ra sự cố lộ dữ liệu, quản trị viên báo cho người bị ảnh hưởng và cơ quan có thẩm quyền trong thời hạn luật định (72 giờ).</p>`],
    terms: ['Điều khoản sử dụng', `
      <h2>1. Tài khoản và quyền truy cập</h2>
      <p>Học speaking là ứng dụng luyện tập nội bộ, <b>miễn phí</b>, chỉ dành cho người từ 18 tuổi, do ${OWNER} vận hành. Quyền (Viewer, Học viên, Editor) do quản trị viên cấp và có thể thu hồi bất cứ lúc nào. Không chia sẻ link đăng nhập.</p>
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
      <li>Câu hỏi forecast và câu mẫu thuộc quyền của tác giả tài liệu gốc; chỉ dùng nội bộ để học, không công khai hay kinh doanh. Đây là dự đoán, không bảo đảm xuất hiện trong kỳ thi thật.</li>
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
