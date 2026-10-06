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
