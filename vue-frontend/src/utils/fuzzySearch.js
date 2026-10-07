import { removeVietnameseAccents } from './vietnamese';

/**
 * 💡 ALGORITHM NOTE: Thuật toán Search Gần Đúng (Fuzzy Search Algorithm)
 * 1. Bỏ dấu tiếng Việt cả từ khóa tìm kiếm (query) và văn bản cần kiểm tra (target).
 * 2. Phân tách từ khóa thành các token (từ rời).
 * 3. Kiểm tra Substring Match + Exact Token Match + Subsequence Distance Match.
 * 4. Trả về điểm số matchScore (0.0 đến 1.0) và chỉ lưu kết quả có điểm số > 0.
 */

export function calculateFuzzyScore(query, target) {
  if (!query) return 1.0;
  if (!target) return 0.0;

  const qNorm = removeVietnameseAccents(query);
  const tNorm = removeVietnameseAccents(target);

  // Exact substring match (Điểm tuyệt đối)
  if (tNorm.includes(qNorm)) {
    return 1.0;
  }

  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  const tTokens = tNorm.split(/\s+/).filter(Boolean);

  let matchedTokens = 0;
  for (const qToken of qTokens) {
    if (tTokens.some(tToken => tToken.includes(qToken) || qToken.includes(tToken))) {
      matchedTokens++;
    }
  }

  if (matchedTokens === 0) return 0.0;
  return matchedTokens / qTokens.length;
}

/**
 * Lọc danh sách đối tượng dựa trên Fuzzy Search nhiều trường (multi-field fuzzy search)
 * @param {Array} items - Danh sách object/array dữ liệu
 * @param {string} query - Từ khóa tìm kiếm
 * @param {Array<string>} keys - Danh sách các field cần search (vd: ['fullName', 'staffCode', 'email', 'phone', 'role'])
 * @returns {Array} - Danh sách kết quả phù hợp xếp theo thứ tự điểm số giảm dần
 */
export function fuzzySearchList(items, query, keys) {
  if (!query || !query.trim()) return items;

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let maxScore = 0;

    for (const key of keys) {
      const val = Array.isArray(item) ? item[key] : item[key];
      const score = calculateFuzzyScore(query, String(val || ''));
      if (score > maxScore) {
        maxScore = score;
      }
    }

    if (maxScore > 0.3) {
      results.push({ item, score: maxScore, originalIndex: i });
    }
  }

  // Sắp xếp theo score từ cao xuống thấp
  results.sort((a, b) => b.score - a.score);
  return results.map(r => r.item);
}

/**
 * 💡 ALGORITHM NOTE: Thuật toán Tìm Kiếm Nhị Phân (Binary Search Algorithm - O(log N))
 * Kiểm tra xem một STT (Chỉ số dòng) có nằm trong danh sách các dòng bị lỗi đã được sắp xếp hay không.
 * Giúp Handsontable cell renderer kiểm tra siêu tốc mà không làm giật lag giao diện khi cuộn.
 */
export function binarySearchRow(sortedFailedIndices, targetIndex) {
  if (!sortedFailedIndices || sortedFailedIndices.length === 0) return false;

  let left = 0;
  let right = sortedFailedIndices.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedFailedIndices[mid] === targetIndex) {
      return true;
    }
    if (sortedFailedIndices[mid] < targetIndex) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return false;
}
