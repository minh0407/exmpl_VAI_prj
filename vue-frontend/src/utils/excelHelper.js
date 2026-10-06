import * as XLSX from 'xlsx';

/**
 * Tạo và tải xuống file Excel mẫu
 */
export function downloadSampleExcelTemplate() {
  const sampleData = [
    {
      'STT': 1,
      'Họ và tên': 'Super Admin',
      'Mã nhân viên': '999999',
      'Email': 'super_admin@viettelai.vn',
      'Số điện thoại': '0988888888',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'Super Admin',
      'Đơn vị': 'CNM-VAI',
      'Vai trò': 'Admin',
    },
    {
      'STT': 2,
      'Họ và tên': 'Trần Huy Hoàng',
      'Mã nhân viên': '431452',
      'Email': 'hoangth33@viettel.com.vn',
      'Số điện thoại': '868695383',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'Kỹ sư trí tuệ nhân tạo',
      'Đơn vị': 'CNM-VAI',
      'Vai trò': 'Admin',
    },
    {
      'STT': 3,
      'Họ và tên': 'Nguyễn Khắc Minh',
      'Mã nhân viên': '431451',
      'Email': 'minhnk2@viettel.com.vn',
      'Số điện thoại': '0977112233',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'AI Eng',
      'Đơn vị': 'CNM - VAI',
      'Vai trò': 'User',
    },
    {
      'STT': 4,
      'Họ và tên': 'AI Service',
      'Mã nhân viên': '888888',
      'Email': 'ai_service@viettelai.vn',
      'Số điện thoại': '0966554433',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'AI Service',
      'Đơn vị': 'CNM-VAI',
      'Vai trò': 'User',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh_Sach_Mau');
  XLSX.writeFile(workbook, 'File_Mau_Import_Nguoi_Dung.xlsx');
}

/**
 * Parse file Excel từ FileReader
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonRows);
      } catch (err) {
        reject(new Error('Khái niệm cấu trúc file Excel không đúng hoặc file bị lỗi.'));
      }
    };
    reader.onerror = () => reject(new Error('Đọc file thất bại.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Xuất danh sách người dùng thành file Excel
 */
export function exportUsersToExcel(users, filename = 'Danh_sach_nguoi_dung.xlsx') {
  const exportData = users.map((u, index) => ({
    'STT': index + 1,
    'Họ và tên': u.full_name,
    'Mã nhân viên': u.staff_code,
    'Email': u.email,
    'Số điện thoại': u.phone || '',
    'Địa chỉ': u.address || '',
    'Chức danh': u.job_title || '',
    'Đơn vị': u.department || '',
    'Vai trò': u.role || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh_Sach');
  XLSX.writeFile(workbook, filename);
}

/**
 * 🛑 XỬ LÝ BÀI TOÁN XUẤT FILE BÁO BẢNG LỖI IMPORT
 * Tạo file Excel chứa các dòng dữ liệu bị lỗi kèm cột "Lý do lỗi" để người dùng tải về chỉnh sửa.
 */
export function exportErrorReportExcel(failedRows) {
  const exportData = failedRows.map((item) => ({
    'Dòng lỗi': item.rowIndex,
    'Họ và tên': item.data?.full_name || '',
    'Mã nhân viên': item.data?.staff_code || '',
    'Email': item.data?.email || '',
    'Số điện thoại': item.data?.phone || '',
    'Địa chỉ': item.data?.address || '',
    'Chức danh': item.data?.job_title || '',
    'Đơn vị': item.data?.department || '',
    'Vai trò': item.data?.role || '',
    'LÝ DO LỖI (CẦN SỬA)': item.errorText || item.errors?.join('; ') || 'Dữ liệu không hợp lệ',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao_Cao_Loi_Import');
  XLSX.writeFile(workbook, `File_Bao_Cao_Loi_Import_${Date.now()}.xlsx`);
}
