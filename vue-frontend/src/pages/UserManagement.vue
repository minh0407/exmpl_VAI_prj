<template>
  <div class="user-management-page">
    <div class="page-container">
      <!-- Header Title & Action Buttons -->
      <div class="header-section">
        <h1 class="page-title">Danh sách người dùng</h1>

        <div class="header-controls">
          <!-- Main Search Box with AutoComplete -->
          <div class="search-input-wrapper">
            <a-auto-complete
              v-model:value="searchInput"
              :options="autoCompleteOptions"
              placeholder="🔍 Tìm kiếm (gợi ý Họ tên, Mã NV, Email...)"
              allow-clear
              style="width: 320px"
              @select="onSearchSelect"
              @change="handleSearchChange"
            />
          </div>


          <div class="button-group">
            <a-button class="btn-secondary" @click="downloadSampleExcelTemplate">
              <template #icon><DownloadOutlined /></template>
              Tải xuống file mẫu
            </a-button>

            <a-button class="btn-secondary" @click="store.openImportModal">
              <template #icon><ImportOutlined /></template>
              Nhập dữ liệu
            </a-button>

            <a-button class="btn-secondary" @click="exportExcel">
              <template #icon><ExportOutlined /></template>
              Xuất file Excel
            </a-button>

            <a-button type="primary" class="btn-red-primary" icon="plus" @click="openAddModal">
              <template #icon><PlusCircleOutlined /></template>
              Thêm mới
            </a-button>
          </div>
        </div>
      </div>

      <!-- Main User Table -->
      <div class="table-card">
        <a-table
          :dataSource="store.users"
          :columns="columns"
          :loading="store.loading"
          :pagination="false"
          rowKey="id"
          size="middle"
          @change="handleTableChange"
        >
          <!-- Custom STT Column -->
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'stt'">
              {{ getSTT(index, record) }}
            </template>


            <template v-if="column.key === 'full_name'">
              <span class="user-name">{{ record.full_name }}</span>
            </template>

            <template v-if="column.key === 'staff_code'">
              <span class="staff-code">{{ record.staff_code }}</span>
            </template>

            <template v-if="column.key === 'role'">
              <a-tag :color="getRoleTagColor(record.role)">{{ record.role }}</a-tag>
            </template>

            <!-- Actions Column -->
            <template v-if="column.key === 'actions'">
              <a-dropdown :trigger="['click']">
                <a class="ant-dropdown-link" @click.prevent>
                  <MoreOutlined style="font-size: 18px; cursor: pointer; color: #8c8c8c" />
                </a>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="edit" @click="openEditModal(record)">
                      <EditOutlined /> Chỉnh sửa
                    </a-menu-item>
                    <a-menu-item key="delete" danger @click="confirmDelete(record)">
                      <DeleteOutlined /> Xóa người dùng
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
          </template>
        </a-table>

        <!-- Pagination Bar at Bottom Right -->
        <div class="pagination-footer">
          <a-pagination
            v-model:current="store.pagination.current"
            v-model:pageSize="store.pagination.pageSize"
            :total="store.totalUsers"
            :showSizeChanger="true"
            :pageSizeOptions="['10', '20', '50', '100']"
            size="small"
            @change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ImportExcelModal />
    <UserFormModal />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Modal } from 'ant-design-vue';
import {
  DownloadOutlined,
  ImportOutlined,
  ExportOutlined,
  PlusCircleOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue';

import { useUserStore } from '../stores/userStore';
import { downloadSampleExcelTemplate, exportUsersToExcel } from '../utils/excelHelper';
import { removeVietnameseAccents } from '../utils/vietnamese';

import ImportExcelModal from '../components/ImportExcelModal.vue';
import UserFormModal from '../components/UserFormModal.vue';

const store = useUserStore();
const searchInput = ref('');

const handlePopState = () => {
  store.initFromUrl();
  searchInput.value = store.searchQuery;
};

onMounted(() => {
  store.initFromUrl();
  searchInput.value = store.searchQuery;
  window.addEventListener('popstate', handlePopState);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

// 💡 Gợi ý AutoComplete thông minh cho ô tìm kiếm
const autoCompleteOptions = computed(() => {
  if (!searchInput.value || !searchInput.value.trim()) return [];

  const normQuery = removeVietnameseAccents(searchInput.value).toLowerCase();
  const suggestions = new Set();
  const options = [];

  for (const user of store.users) {
    const fields = [
      { text: user.full_name, label: `👤 ${user.full_name} (${user.staff_code})` },
      { text: user.staff_code, label: `💳 Mã NV: ${user.staff_code}` },
      { text: user.email, label: `✉ ${user.email}` },
      { text: user.job_title, label: `💼 Chức danh: ${user.job_title}` },
      { text: user.department, label: `🏢 Đơn vị: ${user.department}` },
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

const onSearchSelect = (value) => {
  searchInput.value = value;
  store.setSearchQuery(value);
};

const handleSearchChange = () => {
  store.setSearchQuery(searchInput.value);
};


const handleTableChange = (pagination, filters, sorter) => {
  store.setTableChange(pagination, filters, sorter);
};

const handlePageChange = (page, pageSize) => {
  store.setPagination(page, pageSize);
};

const openAddModal = () => {
  store.editingUser = null;
  store.isFormModalOpen = true;
};

const openEditModal = (record) => {
  store.editingUser = { ...record };
  store.isFormModalOpen = true;
};

const confirmDelete = (record) => {
  Modal.confirm({
    title: 'Xác nhận xóa người dùng',
    content: `Bạn có chắc chắn muốn xóa người dùng "${record.full_name}" (${record.staff_code}) không?`,
    okText: 'Xóa',
    okType: 'danger',
    cancelText: 'Hủy',
    onOk() {
      store.deleteUser(record.id);
    },
  });
};

const exportExcel = () => {
  exportUsersToExcel(store.users, 'Danh_Sach_Nguoi_Dung_Viettel_VAI.xlsx');
};

const getSTT = (index, record) => {
  const page = Number(store.pagination?.current) || 1;
  const pageSize = Number(store.pagination?.pageSize) || 10;
  let idx = 0;
  if (typeof index === 'number' && !isNaN(index)) {
    idx = index;
  } else if (record && Array.isArray(store.users)) {
    idx = store.users.indexOf(record);
    if (idx < 0) idx = 0;
  }
  return (page - 1) * pageSize + idx + 1;
};

const getRoleTagColor = (role) => {
  if (role === 'Admin') return 'red';
  if (role === 'Editor') return 'blue';
  return 'default';
};

// Table Columns configuration matching UI screenshot with dynamic URL state bindings
const columns = computed(() => [
  {
    title: 'STT',
    key: 'stt',
    dataIndex: 'stt',
    width: 60,
    align: 'center',
    customRender: ({ index, record }) => getSTT(index, record),
  },

  {
    title: 'Họ và tên',
    dataIndex: 'full_name',
    key: 'full_name',
    sorter: true,
    sortOrder: store.sorter.field === 'full_name' ? store.sorter.order : null,
  },
  {
    title: 'Mã nhân viên',
    dataIndex: 'staff_code',
    key: 'staff_code',
    sorter: true,
    sortOrder: store.sorter.field === 'staff_code' ? store.sorter.order : null,
  },
  {
    title: 'Email',
    dataIndex: 'email',
    key: 'email',
  },
  {
    title: 'Số điện thoại',
    dataIndex: 'phone',
    key: 'phone',
    sorter: true,
    sortOrder: store.sorter.field === 'phone' ? store.sorter.order : null,
  },
  {
    title: 'Địa chỉ',
    dataIndex: 'address',
    key: 'address',
  },
  {
    title: 'Chức danh',
    dataIndex: 'job_title',
    key: 'job_title',
    filteredValue: store.filters.jobTitle ? [store.filters.jobTitle] : null,
    filters: [
      { text: 'Super Admin', value: 'Super Admin' },
      { text: 'Kỹ sư trí tuệ nhân tạo', value: 'Kỹ sư trí tuệ nhân tạo' },
      { text: 'AI Eng', value: 'AI Eng' },
      { text: 'Kỹ sư', value: 'Kỹ sư' },
      { text: 'BA', value: 'BA' },
    ],
  },
  {
    title: 'Đơn vị',
    dataIndex: 'department',
    key: 'department',
    filteredValue: store.filters.department ? [store.filters.department] : null,
    filters: [
      { text: 'CNM-VAI', value: 'CNM-VAI' },
      { text: 'CNM - VAI', value: 'CNM - VAI' },
      { text: 'VTNet', value: 'VTNet' },
      { text: 'VAI', value: 'VAI' },
    ],
  },
  {
    title: 'Vai trò',
    dataIndex: 'role',
    key: 'role',
    filteredValue: store.filters.role ? [store.filters.role] : null,
    filters: [
      { text: 'Admin', value: 'Admin' },
      { text: 'User', value: 'User' },
      { text: 'Editor', value: 'Editor' },
    ],
  },
  {
    title: 'Thao tác',
    key: 'actions',
    width: 80,
    align: 'center',
  },
]);
</script>

<style scoped>
.user-management-page {
  min-height: 100vh;
  background-color: #f4f6f8;
  padding: 24px;
}

.page-container {
  max-width: 1400px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f1f1f;
  margin: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-secondary {
  border-radius: 6px;
  font-weight: 500;
}

.btn-red-primary {
  background-color: #d32f2f !important;
  border-color: #d32f2f !important;
  border-radius: 6px;
  font-weight: 600;
}

.btn-red-primary:hover {
  background-color: #b71c1c !important;
  border-color: #b71c1c !important;
}

.table-card {
  border-radius: 8px;
  overflow: hidden;
}

.user-name {
  font-weight: 500;
  color: #1f1f1f;
}

.staff-code {
  font-family: monospace;
  font-weight: 600;
  color: #595959;
}

.pagination-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
}
</style>
