import { getValueFromRow } from './vietnamese';

/**
 * ⚡ TRICK IMPORT HÀNG LOẠT (High-Performance Chunked Batch Import Trick)
 * 1. Chia mảng dữ liệu cực lớn (10.000+ bản ghi) thành các micro-chunks (VD: 500 bản ghi/chunk).
 * 2. Sử dụng requestAnimationFrame/setTimeout(0) tạo Microtask Loop trả lại quyền điều khiển cho Main Thread.
 *    -> Giúp giao diện web luôn mượt mượt (60 FPS), không bị đơ giật hay hiện thông báo "Page Unresponsive".
 * 3. Chạy xử lý song song từng chunk và báo cáo tiến độ (Progress, Speed rows/sec) thời gian thực.
 */

export async function processBatchChunks(items, batchSize = 500, processItemFn, onProgress) {
  const total = items.length;
  const successRows = [];
  const failedRows = [];

  let processedCount = 0;
  const startTime = performance.now();
  const seenInBatch = new Set();

  for (let i = 0; i < total; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);

    // Xử lý song song trong chunk hiện tại
    const results = await Promise.allSettled(
      chunk.map((item, index) => processItemFn(item, i + index + 1, seenInBatch))
    );

    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      processedCount++;

      if (res.status === 'fulfilled' && res.value.valid) {
        successRows.push(res.value.data);
      } else {
        const errorData = res.status === 'fulfilled' 
          ? res.value 
          : { 
              valid: false, 
              rowIndex: i + j + 1, 
              data: chunk[j], 
              errors: [res.reason?.message || 'Lỗi không xác định trong quá trình xử lý'],
              errorText: res.reason?.message || 'Lỗi không xác định trong quá trình xử lý' 
            };
        failedRows.push(errorData);
      }
    }

    // Báo cáo tiến độ thời gian thực
    const elapsedTime = (performance.now() - startTime) / 1000;
    const speed = Math.round(processedCount / (elapsedTime || 0.001));
    const percent = Math.min(100, Math.round((processedCount / total) * 100));

    if (onProgress) {
      onProgress({
        percent,
        processedCount,
        total,
        speed,
        successCount: successRows.length,
        failedCount: failedRows.length,
      });
    }

    // 💡 TRICK UI NON-BLOCKING: Nhường Main Thread cho trình duyệt render UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return {
    successRows,
    failedRows,
    totalProcessed: processedCount,
    executionTimeMs: Math.round(performance.now() - startTime),
  };
}

/**
 * 🛑 XỬ LÝ BÀI TOÁN XÁC MINH & BÁO LỖI HÀNG (Row-Level Validation)
 * Sử dụng getValueFromRow thông minh để tự động nhận dạng đúng cột bất kể tên header trong file Excel
 */
export function validateUserRow(row, rowIndex, existingStaffCodes = new Set(), seenInBatch = new Set()) {
  const errors = [];

  const rawFullName = getValueFromRow(row, ['full_name', 'Họ và tên', 'Họ tên', 'Họ Và Tên', 'Họ và tên *', 'Full Name', 'fullName', 'Tên', 'name']);
  const rawStaffCode = getValueFromRow(row, ['staff_code', 'Mã nhân viên', 'Mã NV', 'Mã số NV', 'Mã nhân viên *', 'Staff Code', 'staffCode', 'MNV', 'code']);
  const rawEmail = getValueFromRow(row, ['email', 'Email', 'Mail', 'Thư điện tử']);
  const rawPhone = getValueFromRow(row, ['phone', 'Số điện thoại', 'SĐT', 'Số ĐT', 'Điện thoại', 'Phone', 'Mobile']);
  const rawAddress = getValueFromRow(row, ['address', 'Địa chỉ', 'Address', 'Nơi ở']);
  const rawJobTitle = getValueFromRow(row, ['job_title', 'Chức danh', 'jobTitle', 'Chức vụ', 'Position', 'Job Title'], 'Kỹ sư');
  const rawDepartment = getValueFromRow(row, ['department', 'Đơn vị', 'Department', 'Phòng ban', 'Bộ phận', 'Unit'], 'CNM-VAI');
  const rawRole = getValueFromRow(row, ['role', 'Vai trò', 'Role', 'Quyền'], 'User');

  const fullName = String(rawFullName || '').trim();
  const staffCode = String(rawStaffCode || '').trim();
  const email = String(rawEmail || '').toLowerCase().trim();
  const phone = String(rawPhone || '').trim();
  const address = String(rawAddress || '').trim();
  const jobTitle = String(rawJobTitle || 'Kỹ sư').trim();
  const department = String(rawDepartment || 'CNM-VAI').trim();
  const role = String(rawRole || 'User').trim();

  if (!fullName) {
    errors.push('Họ và tên không được để trống');
  }

  if (!staffCode) {
    errors.push('Mã nhân viên không được để trống');
  } else if (existingStaffCodes.has(staffCode) || seenInBatch.has(staffCode)) {
    errors.push(`Mã nhân viên '${staffCode}' trùng lặp trong hệ thống/file`);
  } else {
    seenInBatch.add(staffCode);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email chưa đúng định dạng');
  }

  if (phone && !/^[0-9\s+()-]{8,15}$/.test(phone)) {
    errors.push('Số điện thoại không hợp lệ');
  }

  const isValid = errors.length === 0;
  const userData = {
    stt: rowIndex,
    full_name: fullName,
    staff_code: staffCode,
    email: email || (staffCode ? `${staffCode.toLowerCase()}@viettel.com.vn` : `user_${rowIndex}@viettel.com.vn`),
    phone: phone || '0988888888',
    address: address || 'Hà Nội',
    job_title: jobTitle,
    department: department,
    role: role,
  };

  return {
    valid: isValid,
    rowIndex,
    data: userData,
    errors,
    errorText: errors.join('; '),
  };
}
