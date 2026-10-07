import * as XLSX from 'xlsx';
import { removeVietnameseAccents } from './vietnamese';

/**
 * Tạo và tải xuống file Excel mẫu
 */
export function downloadSampleExcelTemplate() {
  const sampleData = [
    {
      'STT': 1,
      'Họ và tên': 'Super Admin Demo',
      'Mã nhân viên': '999999',
      'Email': 'super_admin@example.com',
      'Số điện thoại': '0988888888',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'Super Admin',
      'Đơn vị': 'CNM-VAI',
      'Vai trò': 'Admin',
    },
    {
      'STT': 2,
      'Họ và tên': 'Trần Huy Hoàng Demo',
      'Mã nhân viên': '431452',
      'Email': 'hoang.demo@example.com',
      'Số điện thoại': '900000002',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'Kỹ sư trí tuệ nhân tạo',
      'Đơn vị': 'CNM-VAI',
      'Vai trò': 'Admin',
    },
    {
      'STT': 3,
      'Họ và tên': 'Nguyễn Khắc Minh Demo',
      'Mã nhân viên': '431451',
      'Email': 'minhk.demo@example.com',
      'Số điện thoại': '900000003',
      'Địa chỉ': 'Hà Nội',
      'Chức danh': 'AI Engineer',
      'Đơn vị': 'CNM-VAI',
      'Vai trò': 'User',
    },
    {
      'STT': 4,
      'Họ và tên': 'AI Service Demo',
      'Mã nhân viên': '888888',
      'Email': 'ai_service@example.com',
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
 * Smart Excel File Parser:
 * 1. Đọc file dưới dạng mảng các hàng raw (Array of Arrays matrix).
 * 2. Tự động phát hiện hàng chứa Tiêu đề (Header row detection).
 * 3. Tạo dữ liệu JSON linh hoạt vừa có key tiêu đề vừa lưu mảng vị trí _rawArray để fallback.
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

        // 1. Đọc sheet dưới dạng mảng matrix các dòng (Array of Arrays)
        const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (!rawMatrix || rawMatrix.length === 0) {
          return resolve([]);
        }

        // 2. Tìm hàng tiêu đề (quét 15 hàng đầu tiên)
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(15, rawMatrix.length); i++) {
          const rowStr = rawMatrix[i].map(c => removeVietnameseAccents(String(c || '')).toLowerCase()).join(' ');
          if (rowStr.includes('ho va ten') || rowStr.includes('ma nhan vien') || rowStr.includes('ho ten') || rowStr.includes('email') || rowStr.includes('stt')) {
            headerRowIndex = i;
            break;
          }
        }

        // 3. Nếu tìm thấy hàng tiêu đề:
        if (headerRowIndex !== -1) {
          const headers = rawMatrix[headerRowIndex].map(h => String(h || '').trim());
          const dataRows = [];

          for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
            const rowArr = rawMatrix[i];
            // Bỏ qua các hàng hoàn toàn trống
            if (!rowArr || rowArr.every(cell => String(cell || '').trim() === '')) {
              continue;
            }

            const rowObj = {};
            for (let j = 0; j < headers.length; j++) {
              const headerKey = headers[j] || `__col_${j}`;
              rowObj[headerKey] = rowArr[j] !== undefined && rowArr[j] !== null ? String(rowArr[j]).trim() : '';
            }

            // Đính kèm _rawArray để fallback lấy giá trị theo chỉ số vị trí cột
            rowObj._rawArray = rowArr;
            dataRows.push(rowObj);
          }

          return resolve(dataRows);
        }

        // 4. Fallback mặc định
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonRows);
      } catch (err) {
        reject(new Error('Cấu trúc file Excel không hợp lệ hoặc file bị lỗi. ' + err.message));
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
