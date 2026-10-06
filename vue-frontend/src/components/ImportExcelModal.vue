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

          <!-- Search Gần Đúng trong Bảng Excel -->
          <div class="excel-search-box" v-if="parsedRows.length > 0">
            <a-input-search
              v-model:value="searchQuery"
              placeholder="🔍 Tìm gần đúng trong file (Họ tên, Mã NV, Email...)"
              style="width: 320px"
              allow-clear
              @search="handleFuzzySearch"
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
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { message } from 'ant-design-vue';
import {
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

import { useUserStore } from '../stores/userStore';
import { parseExcelFile, downloadSampleExcelTemplate } from '../utils/excelHelper';
import { fuzzySearchList } from '../utils/fuzzySearch';

const store = useUserStore();

const hotContainer = ref(null);
let hotInstance = null;

const parsedRows = ref([]);
const filteredRows = ref([]);
const searchQuery = ref('');

// --- HANDSONTABLE LAZY LOAD & VIRTUALIZATION CONFIGURATION ---
const initHandsontable = (data) => {
  if (!hotContainer.value) return;

  if (hotInstance) {
    hotInstance.destroy();
  }

  // Chuyển đổi dữ liệu JSON thành mảng mảng (array of arrays) cho Handsontable
  const tableData = data.map((row, index) => [
    index + 1,
    row['Họ và tên'] || row.full_name || '',
    row['Mã nhân viên'] || row.staff_code || '',
    row['Email'] || row.email || '',
    row['Số điện thoại'] || row.phone || '',
    row['Địa chỉ'] || row.address || '',
    row['Chức danh'] || row.job_title || 'Kỹ sư',
    row['Đơn vị'] || row.department || 'CNM-VAI',
    row['Vai trò'] || row.role || 'User',
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
      { type: 'dropdown', source: ['CNM-VAI', 'VTNet', 'VAI', 'VTS'], width: 120 },
      { type: 'dropdown', source: ['Admin', 'User', 'Editor'], width: 100 },
    ],
    // 💡 LAZY LOAD & VIRTUALIZATION OPTIMIZATION CONFIG:
    renderAllRows: false,              // Chỉ render các row hiển thị trong Viewport
    viewportRowRenderingOffset: 15,    // Buffer 15 rows khi cuộn mượt
    viewportColumnRenderingOffset: 5,
    height: '420px',
    rowHeaders: true,
    contextMenu: true,
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

// Trích xuất dữ liệu đã chỉnh sửa từ Handsontable để Import
const startImportProcess = () => {
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

  store.executeBatchImport(formattedRows);
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
