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
 * Smart Dynamic Key Extractor with Triple Fallback:
 * 1. Exact key match
 * 2. Normalized key match (removes accents, spaces, special chars, lowercases)
 * 3. Positional array index fallback (Column 1=Full Name, 2=Staff Code, 3=Email, etc.)
 */
export function getValueFromRow(row, possibleKeys, defaultValue = '') {
  if (!row) return defaultValue;

  const rawArray = Array.isArray(row) ? row : row._rawArray;

  // 1. Exact key match on Object
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

  // 3. Positional column index fallback on Array
  if (Array.isArray(rawArray)) {
    const posMap = {
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
      const pos = posMap[key];
      if (pos !== undefined && rawArray[pos] !== undefined && rawArray[pos] !== null && String(rawArray[pos]).trim() !== '') {
        return String(rawArray[pos]).trim();
      }
    }
  }

  return defaultValue;
}
