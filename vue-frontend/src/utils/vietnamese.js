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
 * Smart Dynamic Key Extractor với thuật toán 3 Lớp Bảo Vệ:
 * 1. Khớp tên Key chính xác (Exact Header Match) - Tự động bỏ qua các cột thừa như "Thao tác", "Ghi chú".
 * 2. Khớp tên Key chuẩn hóa (Normalized Header Match) - Bỏ dấu, khoảng trắng, viết hoa/thường.
 * 3. Fallback lấy theo vị trí cột mảng linh hoạt (Positional Index Fallback) - Tự phát hiện file có hoặc không có cột STT.
 */
export function getValueFromRow(row, possibleKeys, defaultValue = '') {
  if (!row) return defaultValue;

  const rawArray = Array.isArray(row) ? row : row._rawArray;

  // 1. Exact key match on Object (Tự động bỏ qua các cột thừa như "Thao tác", "Ghi chú")
  if (!Array.isArray(row) && typeof row === 'object') {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }

    // 2. Normalized key match on Object
    const normalizedRow = {};
    for (const k of Object.keys(row)) {
      if (k === '_rawArray') continue;
      const normK = removeVietnameseAccents(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normK) {
        normalizedRow[normK] = row[k];
      }
    }

    for (const key of possibleKeys) {
      const normSearchKey = removeVietnameseAccents(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedRow[normSearchKey] !== undefined && normalizedRow[normSearchKey] !== null && String(normalizedRow[normSearchKey]).trim() !== '') {
        return String(normalizedRow[normSearchKey]).trim();
      }
    }
  }

  // 3. Positional column index fallback on Array (Linh hoạt tự phát hiện có hoặc không có cột STT)
  if (Array.isArray(rawArray) && rawArray.length > 0) {
    const col0Str = String(rawArray[0] || '').trim();
    // Phán đoán cột 0 có phải là cột STT không (chứa chữ STT hoặc là số tự nhiên)
    const hasSttCol = col0Str.toLowerCase().includes('stt') || /^\d+$/.test(col0Str);

    const offset = hasSttCol ? 1 : 0;
    const posMap = {
      full_name: 0 + offset,
      staff_code: 1 + offset,
      email: 2 + offset,
      phone: 3 + offset,
      address: 4 + offset,
      job_title: 5 + offset,
      department: 6 + offset,
      role: 7 + offset,
    };

    for (const key of possibleKeys) {
      const pos = posMap[key];
      if (pos !== undefined && rawArray[pos] !== undefined && rawArray[pos] !== null && String(rawArray[pos]).trim() !== '') {
        return String(rawArray[pos]).trim();
      }
    }
  }

  return defaultValue;
}
