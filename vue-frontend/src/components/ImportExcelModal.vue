<template>
  <a-modal
    v-model:open="store.isImportModalOpen"
    title="Nhập dữ liệu người dùng từ file Excel (Handsontable)"
    width="90%"
    :style="{ top: '20px' }"
    :footer="null"
    @cancel="store.closeImportModal"
  >
    <div class="import-modal-container">
      <!-- Top Action Bar -->
      <div class="top-action-bar">
        <div class="left-actions">
          <a-upload
            :before-upload="handleFileSelect"
            :show-upload-list="false"
            accept=".xlsx, .xls, .csv"
          >
            <a-button type="primary" size="large" icon="upload">
              <template #icon><UploadOutlined /></template>
              Tải file Excel lên Web
            </a-button>
          </a-upload>

          <a-button size="large" @click="downloadSampleExcelTemplate">
            <template #icon><DownloadOutlined /></template>
            Tải file mẫu
          </a-button>

          <!-- Button Xóa dòng chọn trong Bảng Handsontable -->
          <a-button
            v-if="parsedRows.length > 0"
            size="large"
            danger
            @click="handleDeleteSelectedRow"
          >
            <template #icon><DeleteOutlined /></template>
            Xóa dòng chọn
          </a-button>

          <!-- Search Gần Đúng + AutoComplete trong Bảng Excel -->
          <div class="excel-search-box" v-if="parsedRows.length > 0">
            <a-auto-complete
              v-model:value="searchQuery"
              :options="modalAutoCompleteOptions"
              placeholder="🔍 Tìm gần đúng trong file (Họ tên, Mã NV...)"
              style="width: 340px"
              allow-clear
              @select="handleFuzzySearch"
              @change="handleFuzzySearch"
            />
            <span v-if="filteredRows.length !== parsedRows.length" class="search-result-count">
              Tìm thấy {{ filteredRows.length }}/{{ parsedRows.length }} dòng
            </span>
          </div>

        </div>

        <div class="right-actions">
          <a-tag color="blue" v-if="parsedRows.length > 0">
            Tổng: {{ parsedRows.length }} dòng
          </a-tag>
        </div>
      </div>

      <!-- Batch Import Progress Status -->
      <div v-if="store.importingStatus === 'importing' || store.importingStatus === 'completed_with_errors'" class="progress-section">
        <a-card size="small" style="margin-bottom: 16px; background: #fafafa">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
            <span><strong>Đang xử lý Import hàng loạt (Chunked Batch Trick):</strong></span>
            <span>⚡ Tốc độ: <strong>{{ store.batchStats.speed }} dòng/giây</strong></span>
          </div>
          <a-progress :percent="store.importingProgress" :status="store.importingStatus === 'completed_with_errors' ? 'exception' : 'active'" />
          <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 13px">
            <span style="color: #52c41a">✔ Thành công: {{ store.batchStats.successCount }}</span>
            <span style="color: #f5222d">✖ Thất bại (Lỗi): {{ store.batchStats.failedCount }}</span>
          </div>
        </a-card>
      </div>

      <!-- Handsontable Spreadsheet View -->
      <div v-if="parsedRows.length > 0" class="handsontable-wrapper">
        <div class="table-info-note">
          💡 <strong>Hướng dẫn:</strong> Bạn có thể double-click trực tiếp vào từng ô bên dưới để xem/chỉnh sửa dữ liệu trước khi import vào hệ thống.
        </div>
        <div ref="hotContainer" class="hot-container"></div>
      </div>

      <!-- Upload Placeholder -->
      <div v-else class="upload-placeholder">
        <a-upload-dragger
          :before-upload="handleFileSelect"
          :show-upload-list="false"
          accept=".xlsx, .xls, .csv"
        >
          <p class="ant-upload-drag-icon">
            <FileExcelOutlined style="font-size: 48px; color: #52c41a" />
          </p>
          <p class="ant-upload-text">Kéo thả file Excel vào đây hoặc click để chọn file</p>
          <p class="ant-upload-hint">
            Hỗ trợ định dạng .xlsx, .xls, .csv. Cho phép xem, lọc tìm kiếm gần đúng và chỉnh sửa dữ liệu trực tiếp trên Web bằng Handsontable trước khi Import.
          </p>
        </a-upload-dragger>
      </div>

      <!-- Modal Footer Action Buttons -->
      <div class="modal-footer-actions">
        <div class="left-footer">
          <a-button
            v-if="store.lastFailedRows && store.lastFailedRows.length > 0"
            type="primary"
            danger
            icon="download"
            @click="store.downloadErrorReport"
          >
            <template #icon><FileExcelOutlined /></template>
            Tải file báo cáo {{ store.lastFailedRows.length }} dòng bị lỗi (.xlsx)
          </a-button>
        </div>

        <div class="right-footer">
          <a-button @click="store.closeImportModal">Đóng</a-button>
          <a-button
            v-if="parsedRows.length > 0"
            type="primary"
            size="large"
            style="background: #1890ff"
            :loading="store.importingStatus === 'importing'"
            @click="startImportProcess"
          >
            <template #icon><CheckCircleOutlined /></template>
            Import trực tiếp vào Hệ thống ({{ filteredRows.length }} dòng)
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

import { useUserStore } from '../stores/userStore';
import { realApi as mockApi } from '../services/realApi';
import { parseExcelFile, downloadSampleExcelTemplate } from '../utils/excelHelper';
import { fuzzySearchList, binarySearchRow } from '../utils/fuzzySearch';
import { getValueFromRow, removeVietnameseAccents } from '../utils/vietnamese';

const store = useUserStore();

const hotContainer = ref(null);
let hotInstance = null;

const parsedRows = ref([]);
const filteredRows = ref([]);
const searchQuery = ref('');

// Mảng danh sách STT các dòng bị lỗi đã được sắp xếp để phục vụ Thuật toán Binary Search O(log N)
const sortedFailedIndices = computed(() => {
  if (!store.lastFailedRows || store.lastFailedRows.length === 0) return [];
  return store.lastFailedRows.map(r => r.rowIndex).sort((a, b) => a - b);
});

// Tự động re-render lại Handsontable để cập nhật dấu cảnh báo đỏ khi phát hiện lỗi
watch(sortedFailedIndices, () => {
  if (hotInstance) {
    hotInstance.render();
  }
});

// 💡 Gợi ý AutoComplete thông minh cho ô tìm kiếm trong Modal Excel
const modalAutoCompleteOptions = computed(() => {
  if (!searchQuery.value || !searchQuery.value.trim() || !parsedRows.value || parsedRows.value.length === 0) return [];

  const normQuery = removeVietnameseAccents(searchQuery.value).toLowerCase();
  const suggestions = new Set();
  const options = [];

  for (const row of parsedRows.value) {
    const name = getValueFromRow(row, ['full_name', 'Họ và tên', 'Họ tên', 'Full Name']);
    const code = getValueFromRow(row, ['staff_code', 'Mã nhân viên', 'Mã NV', 'Staff Code']);
    const email = getValueFromRow(row, ['email', 'Email', 'Mail']);
    const dept = getValueFromRow(row, ['department', 'Đơn vị', 'Department']);

    const fields = [
      { text: name, label: `👤 ${name} (${code})` },
      { text: code, label: `💳 Mã NV: ${code}` },
      { text: email, label: `✉ ${email}` },
      { text: dept, label: `🏢 Đơn vị: ${dept}` },
    ];

    for (const f of fields) {
      if (f.text && removeVietnameseAccents(f.text).toLowerCase().includes(normQuery)) {
        if (!suggestions.has(f.text)) {
          suggestions.add(f.text);
          options.push({ value: f.text, label: f.label });
        }
      }
    }
  }

  return options.slice(0, 8); // Tối đa 8 gợi ý phù hợp nhất
});

// 🗑️ CHỨC NĂNG XÓA DÒNG ĐÃ CHỌN TRONG BẢNG HANDSONTABLE
const handleDeleteSelectedRow = () => {
  if (!hotInstance) return;

  const selection = hotInstance.getSelected();
  if (!selection || selection.length === 0) {
    message.warning('Vui lòng click chọn ít nhất 1 dòng trong bảng để xóa!');
    return;
  }

  // selection[0] = [startRow, startCol, endRow, endCol]
  const startRow = Math.min(selection[0][0], selection[0][2]);
  const endRow = Math.max(selection[0][0], selection[0][2]);
  const amount = endRow - startRow + 1;

  hotInstance.alter('remove_row', startRow, amount);
  message.success(`Đã xóa ${amount} dòng thành công!`);

  // Cập nhật lại state dữ liệu
  const currentData = hotInstance.getData();
  parsedRows.value = currentData;
  filteredRows.value = currentData;
};

// --- HANDSONTABLE LAZY LOAD & VIRTUALIZATION CONFIGURATION ---
const initHandsontable = (data) => {
  if (!hotContainer.value) return;

  if (hotInstance) {
    hotInstance.destroy();
  }

  // Chuyển đổi dữ liệu JSON thành mảng mảng (array of arrays) cho Handsontable với getValueFromRow linh hoạt
  const tableData = data.map((row, index) => [
    index + 1,
    getValueFromRow(row, ['full_name', 'Họ và tên', 'Họ tên', 'Họ Và Tên', 'Họ và tên *', 'Full Name', 'fullName', 'Tên', 'name']),
    getValueFromRow(row, ['staff_code', 'Mã nhân viên', 'Mã NV', 'Mã số NV', 'Mã nhân viên *', 'Staff Code', 'staffCode', 'MNV', 'code']),
    getValueFromRow(row, ['email', 'Email', 'Mail', 'Thư điện tử']),
    getValueFromRow(row, ['phone', 'Số điện thoại', 'SĐT', 'Số ĐT', 'Điện thoại', 'Phone', 'Mobile']),
    getValueFromRow(row, ['address', 'Địa chỉ', 'Address', 'Nơi ở']),
    getValueFromRow(row, ['job_title', 'Chức danh', 'jobTitle', 'Chức vụ', 'Position', 'Job Title']),
    getValueFromRow(row, ['department', 'Đơn vị', 'Department', 'Phòng ban', 'Bộ phận', 'Unit']),
    getValueFromRow(row, ['role', 'Vai trò', 'Role', 'Quyền'], 'User'),
  ]);

  hotInstance = new Handsontable(hotContainer.value, {
    data: tableData,
    colHeaders: ['STT', 'Họ và tên *', 'Mã nhân viên *', 'Email', 'Số điện thoại', 'Địa chỉ', 'Chức danh', 'Đơn vị', 'Vai trò'],
    columns: [
      { readOnly: true, width: 60 },
      { type: 'text', width: 160 },
      { type: 'text', width: 130 },
      { type: 'text', width: 200 },
      { type: 'text', width: 130 },
      { type: 'text', width: 160 },
      { type: 'text', width: 150 },
      { type: 'autocomplete', source: ['CNM-VAI', 'VTNet', 'VAI', 'VTS', 'TT Phần mềm', 'Khối Công nghệ', 'Khối Kinh doanh'], strict: false, width: 140 },
      { type: 'autocomplete', source: ['Admin', 'User', 'Editor'], strict: false, width: 100 },
    ],
    // 💡 ALGORITHM NOTE: DÙNG BINARY SEARCH O(log N) ĐỂ ĐÁNH DẤU ĐỎ CẢNH BÁO CÁC DÒNG LỖI
    cells: function (row, col) {
      const cellProperties = {};
      const stt = row + 1;

      if (sortedFailedIndices.value && sortedFailedIndices.value.length > 0) {
        // Thuật toán Binary Search kiểm tra xem STT dòng này có bị lỗi hay không
        if (binarySearchRow(sortedFailedIndices.value, stt)) {
          cellProperties.renderer = function (instance, td, r, c, prop, value, cellProperties) {
            Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.backgroundColor = '#fff1f0'; // Nền đỏ nhạt cảnh báo
            td.style.color = '#cf1322';           // Chữ màu đỏ
            td.style.fontWeight = 'bold';

            if (c === 0) { // Cột STT
              td.innerHTML = `<span style="color: #ff4d4f; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px;">🚨 ${value}</span>`;
              td.title = "🚨 Dòng này chứa dữ liệu không hợp lệ (Bị lỗi)!";
            }
          };
        }
      }

      return cellProperties;
    },
    // 💡 LAZY LOAD & VIRTUALIZATION OPTIMIZATION CONFIG:
    renderAllRows: false,              // Chỉ render các row hiển thị trong Viewport
    viewportRowRenderingOffset: 15,    // Buffer 15 rows khi cuộn mượt
    viewportColumnRenderingOffset: 5,
    height: '420px',
    rowHeaders: true,
    contextMenu: {
      items: {
        'remove_row': { name: '❌ Xóa các dòng đã chọn' },
        'row_above': { name: '➕ Chèn 1 dòng phía trên' },
        'row_below': { name: '➕ Chèn 1 dòng phía dưới' },
        'hsep1': '---------',
        'undo': { name: '↩️ Hoàn tác (Undo)' },
        'redo': { name: '↪️ Làm lại (Redo)' },
      }
    },
    afterRemoveRow: function (index, amount) {
      if (hotInstance) {
        const data = hotInstance.getData();
        parsedRows.value = data;
        filteredRows.value = data;
      }
    },
    manualColumnResize: true,
    manualRowResize: true,
    stretchH: 'all',
    licenseKey: 'non-commercial-and-evaluation',
  });
};

const handleFileSelect = async (file) => {
  try {
    message.loading({ content: 'Đang đọc file Excel...', key: 'parseExcel' });
    const rows = await parseExcelFile(file);
    parsedRows.value = rows;
    filteredRows.value = rows;
    searchQuery.value = '';

    message.success({ content: `Đã nạp ${rows.length} dòng dữ liệu từ file Excel!`, key: 'parseExcel' });

    await nextTick();
    initHandsontable(filteredRows.value);
  } catch (err) {
    message.error({ content: err.message, key: 'parseExcel' });
  }
  return false; // Ngăn upload mặc định của antd
};

// 💡 ALGORITHM NOTE: Search Gần Đúng (Fuzzy Search) trong Bảng Handsontable
const handleFuzzySearch = () => {
  if (!searchQuery.value || !searchQuery.value.trim()) {
    filteredRows.value = parsedRows.value;
  } else {
    filteredRows.value = fuzzySearchList(
      parsedRows.value,
      searchQuery.value,
      ['Họ và tên', 'full_name', 'Mã nhân viên', 'staff_code', 'Email', 'email', 'Số điện thoại', 'phone', 'Chức danh', 'job_title', 'Đơn vị', 'department', 'Vai trò', 'role']
    );
  }
  nextTick(() => {
    initHandsontable(filteredRows.value);
  });
};

// ⚡ XỬ LÝ TRÙNG LẶP DỮ LIỆU & HỎI Ý KIẾN NGƯỜI DÙNG TRƯỚC KHI IMPORT
const startImportProcess = async () => {
  if (!hotInstance) return;

  const currentTableData = hotInstance.getData();
  const formattedRows = currentTableData.map((row) => ({
    full_name: row[1],
    staff_code: row[2],
    email: row[3],
    phone: row[4],
    address: row[5],
    job_title: row[6],
    department: row[7],
    role: row[8],
  }));

  // Kiểm tra trùng lặp với DB & trùng lặp nội bộ trong file Excel
  const existingStaffCodes = await mockApi.getExistingStaffCodes();
  const duplicateList = [];
  const seenInFile = new Set();

  formattedRows.forEach((row, idx) => {
    const code = String(row.staff_code || '').trim();
    if (code) {
      if (existingStaffCodes.has(code)) {
        duplicateList.push({ stt: idx + 1, staff_code: code, name: row.full_name || 'Chưa đặt tên', type: 'Đã có trong Hệ thống' });
      } else if (seenInFile.has(code)) {
        duplicateList.push({ stt: idx + 1, staff_code: code, name: row.full_name || 'Chưa đặt tên', type: 'Bị lặp lại trong File Excel' });
      } else {
        seenInFile.add(code);
      }
    }
  });

  // Nếu phát hiện có dòng bị trùng Mã nhân viên
  if (duplicateList.length > 0) {
    Modal.confirm({
      title: `⚠️ Phát hiện ${duplicateList.length} dòng bị trùng dữ liệu (Mã NV)!`,
      width: 580,
      icon: h(ExclamationCircleOutlined, { style: { color: '#faad14' } }),
      content: h('div', { style: 'margin-top: 12px;' }, [
        h('p', { style: 'margin-bottom: 8px; font-weight: 500;' }, 
          `Hệ thống phát hiện ${duplicateList.length} dòng trùng Mã nhân viên với dữ liệu hiện tại/trong file.`
        ),
        h('div', { 
          style: 'max-height: 180px; overflow-y: auto; background: #fffbe6; padding: 10px; border: 1px solid #ffe58f; border-radius: 6px; font-size: 13px; margin-bottom: 12px;' 
        }, duplicateList.slice(0, 100).map(d => 
          h('div', { key: d.stt, style: 'margin-bottom: 4px;' }, 
            `• Dòng ${d.stt}: Mã NV [${d.staff_code}] - ${d.name} (${d.type})`
          )
        )),
        h('p', { style: 'color: #d48806; font-size: 13px; margin: 0;' }, 
          '💡 Dữ liệu từ file Excel sẽ TỰ ĐỘNG CẬP NHẬT GHI ĐÈ thay cho thông tin cũ nếu bạn chọn Đồng ý.'
        )
      ]),
      okText: '🟢 Đồng ý Cập nhật (Ghi đè) & Thêm mới',
      cancelText: '🟡 Chỉ thêm dòng mới (Bỏ qua trùng)',
      closable: true,
      maskClosable: false,
      onOk() {
        // Ghi đè dữ liệu mới thay cho dữ liệu cũ bị trùng bất cứ thông tin nào
        store.executeBatchImport(formattedRows, true);
      },
      onCancel(e) {
        if (e?.triggerCancel) {
          // Bấm X hoặc bấm ra ngoài -> Hủy thao tác import
          return;
        }
        // Chọn "Chỉ thêm dòng mới (Bỏ qua trùng)"
        store.executeBatchImport(formattedRows, false);
      },
    });
  } else {
    // Không có bản ghi bị trùng, import trực tiếp
    store.executeBatchImport(formattedRows, true);
  }
};

onBeforeUnmount(() => {
  if (hotInstance) {
    hotInstance.destroy();
  }
});
</script>

<style scoped>
.import-modal-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.left-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.excel-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-result-count {
  font-size: 12px;
  color: #8c8c8c;
}

.handsontable-wrapper {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 8px;
  background: #fff;
}

.table-info-note {
  font-size: 12px;
  color: #595959;
  margin-bottom: 8px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  padding: 6px 12px;
  border-radius: 4px;
}

.hot-container {
  width: 100%;
  height: 420px;
  overflow: hidden;
}

.upload-placeholder {
  padding: 40px;
  background: #fafafa;
  border-radius: 8px;
}

.modal-footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.right-footer {
  display: flex;
  gap: 12px;
}
</style>
