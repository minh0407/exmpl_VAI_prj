/**
 * 💡 ALGORITHM NOTE: Bỏ dấu Tiếng Việt (Vietnamese Diacritics Removal)
 * Chuyển đổi ký tự tiếng Việt có dấu thành không dấu để hỗ trợ tìm kiếm không phân biệt dấu.
 * Ví dụ: "Trần Huy Hoàng" -> "tran huy hoang"
 */
export function removeVietnameseAccents(str) {
  if (!str) return '';
  let result = String(str).toLowerCase().trim();
  
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  result = result.replace(/đ/g, 'd');
  
  // Loại bỏ các ký tự kết hợp unicode (combining diacritical marks)
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return result;
}

/**
 * Smart Dynamic Key Extractor
 * Lấy giá trị trường từ đối tượng row bất kể tên tiêu đề Excel viết hoa/thường, có dấu/không dấu, có khoảng trắng thừa hay ký tự *.
 */
export function getValueFromRow(row, possibleKeys, defaultValue = '') {
  if (!row) return defaultValue;

  // Nếu row là Array (dữ liệu mảng từ Handsontable)
  if (Array.isArray(row)) {
    const keyMapIndex = {
      full_name: 1,
      staff_code: 2,
      email: 3,
      phone: 4,
      address: 5,
      job_title: 6,
      department: 7,
      role: 8,
    };
    for (const key of possibleKeys) {
      const idx = keyMapIndex[key];
      if (idx !== undefined && row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
        return String(row[idx]).trim();
      }
    }
    return defaultValue;
  }

  if (typeof row !== 'object') return defaultValue;

  // 1. Kiểm tra trực tiếp tên key chính xác
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }

  // 2. Chuẩn hóa tất cả các key trong row (bỏ dấu, viết thường, xóa khoảng trắng & ký tự đặc biệt)
  const normalizedRow = {};
  for (const k of Object.keys(row)) {
    const normK = removeVietnameseAccents(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normK) {
      normalizedRow[normK] = row[k];
    }
  }

  // So sánh với danh sách key cần tìm đã chuẩn hóa
  for (const key of possibleKeys) {
    const normSearchKey = removeVietnameseAccents(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedRow[normSearchKey] !== undefined && normalizedRow[normSearchKey] !== null && String(normalizedRow[normSearchKey]).trim() !== '') {
      return String(normalizedRow[normSearchKey]).trim();
    }
  }

  return defaultValue;
}
