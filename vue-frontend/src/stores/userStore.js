import { defineStore } from 'pinia';
import { mockApi } from '../services/mockApi';
import { processBatchChunks, validateUserRow } from '../utils/batchProcessor';
import { exportErrorReportExcel } from '../utils/excelHelper';
import { message } from 'ant-design-vue';

export const useUserStore = defineStore('userStore', {
  state: () => ({
    users: [],
    totalUsers: 0,
    loading: false,
    
    // Pagination & Search
    pagination: {
      current: 1,
      pageSize: 10,
    },
    searchQuery: '',
    filters: {
      department: null,
      role: null,
    },
    sorter: {
      field: null,
      order: null,
    },

    // Import Modal & Handsontable State
    isImportModalOpen: false,
    importRawRows: [], // Data loaded into Handsontable
    importingProgress: 0,
    importingStatus: 'idle', // 'idle' | 'parsing' | 'validating' | 'importing' | 'completed' | 'error'
    batchStats: {
      total: 0,
      processed: 0,
      successCount: 0,
      failedCount: 0,
      speed: 0,
    },
    lastFailedRows: [], // Stores failed rows for error reporting

    // Form Edit/Add Modal State
    isFormModalOpen: false,
    editingUser: null,
  }),

  actions: {
    async fetchUsers() {
      this.loading = true;
      try {
        const res = await mockApi.getUsers({
          page: this.pagination.current,
          pageSize: this.pagination.pageSize,
          search: this.searchQuery,
          department: this.filters.department,
          role: this.filters.role,
          sortBy: this.sorter.field,
          sortOrder: this.sorter.order,
        });

        this.users = res.data;
        this.totalUsers = res.total;
      } catch (err) {
        message.error('Lỗi khi tải danh sách người dùng: ' + err.message);
      } finally {
        this.loading = false;
      }
    },

    setSearchQuery(query) {
      this.searchQuery = query;
      this.pagination.current = 1;
      this.fetchUsers();
    },

    setPagination(page, pageSize) {
      this.pagination.current = page;
      this.pagination.pageSize = pageSize;
      this.fetchUsers();
    },

    setTableChange(pagination, filters, sorter) {
      if (pagination) {
        this.pagination.current = pagination.current;
        this.pagination.pageSize = pagination.pageSize;
      }
      if (filters) {
        this.filters.department = filters.department?.[0] || null;
        this.filters.role = filters.role?.[0] || null;
      }
      if (sorter && sorter.field) {
        this.sorter.field = sorter.field;
        this.sorter.order = sorter.order;
      } else {
        this.sorter.field = null;
        this.sorter.order = null;
      }
      this.fetchUsers();
    },

    async createUser(userData) {
      try {
        await mockApi.createUser(userData);
        message.success('Thêm người dùng mới thành công!');
        this.fetchUsers();
        return true;
      } catch (err) {
        message.error('Lỗi khi thêm người dùng: ' + err.message);
        return false;
      }
    },

    async updateUser(id, userData) {
      try {
        await mockApi.updateUser(id, userData);
        message.success('Cập nhật người dùng thành công!');
        this.fetchUsers();
        return true;
      } catch (err) {
        message.error('Lỗi khi cập nhật người dùng: ' + err.message);
        return false;
      }
    },

    async deleteUser(id) {
      try {
        await mockApi.deleteUser(id);
        message.success('Đã xóa người dùng!');
        this.fetchUsers();
      } catch (err) {
        message.error('Lỗi khi xóa người dùng: ' + err.message);
      }
    },

    // --- IMPORT EXCEL & BATCH PROCESSOR ACTIONS ---
    openImportModal() {
      this.isImportModalOpen = true;
      this.importRawRows = [];
      this.importingStatus = 'idle';
      this.importingProgress = 0;
      this.lastFailedRows = [];
    },

    closeImportModal() {
      this.isImportModalOpen = false;
    },

    setImportRows(rows) {
      this.importRawRows = rows;
      this.importingStatus = 'idle';
    },

    /**
     * ⚡ THỰC THI TRICK IMPORT HÀNG LOẠT VỚI BATCH CHUNKING & BÁO LỖI
     */
    async executeBatchImport(editedRows) {
      if (!editedRows || editedRows.length === 0) {
        message.warning('Không có dữ liệu để import!');
        return;
      }

      this.importingStatus = 'importing';
      this.importingProgress = 0;
      this.batchStats = { total: editedRows.length, processed: 0, successCount: 0, failedCount: 0, speed: 0 };

      // Lấy danh sách mã nhân viên hiện tại để kiểm tra trùng lặp
      const existingStaffCodes = await mockApi.getExistingStaffCodes();

      // Thực thi Batch Processing qua Microtask Loop
      const result = await processBatchChunks(
        editedRows,
        500, // Batch size 500
        (row, index) => validateUserRow(row, index, existingStaffCodes),
        (progressInfo) => {
          this.importingProgress = progressInfo.percent;
          this.batchStats = { ...progressInfo };
        }
      );

      this.lastFailedRows = result.failedRows;

      if (result.successRows.length > 0) {
        await mockApi.importUsersBatch(result.successRows);
        message.success(`Đã import thành công ${result.successRows.length}/${editedRows.length} bản ghi!`);
        this.fetchUsers();
      }

      if (result.failedRows.length > 0) {
        message.error(`Phát hiện ${result.failedRows.length} dòng dữ liệu bị lỗi! Bạn có thể tải file báo cáo lỗi.`);
        this.importingStatus = 'completed_with_errors';
      } else {
        this.importingStatus = 'completed';
        setTimeout(() => this.closeImportModal(), 1200);
      }
    },

    downloadErrorReport() {
      if (!this.lastFailedRows || this.lastFailedRows.length === 0) {
        message.info('Không có bản ghi bị lỗi!');
        return;
      }
      exportErrorReportExcel(this.lastFailedRows);
      message.success('Đã xuất file báo cáo lỗi Excel thành công!');
    }
  },
});
