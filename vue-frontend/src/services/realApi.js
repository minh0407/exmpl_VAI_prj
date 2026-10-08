/**
 * 🚀 REAL BACKEND API SERVICE (FastAPI + PostgreSQL)
 * Kết nối trực tiếp đến FastAPI Backend Server (http://localhost:8000)
 * Tích hợp tự động fallback về Mock API nếu Backend Server chưa khởi chạy.
 */
import { mockApi } from './mockApi';

const API_BASE_URL = 'http://localhost:8000/api';

export const realApi = {
  // 1. Lấy danh sách người dùng từ PostgreSQL (Phân trang, Search, Filter, Sort)
  async getUsers(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', params.page);
      if (params.pageSize) queryParams.set('pageSize', params.pageSize);
      if (params.search) queryParams.set('search', params.search);
      if (params.department) queryParams.set('department', params.department);
      if (params.jobTitle) queryParams.set('jobTitle', params.jobTitle);
      if (params.role) queryParams.set('role', params.role);
      if (params.sortBy) queryParams.set('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`${API_BASE_URL}/employees?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Không thể kết nối FastAPI Server');
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('⚡ FastAPI Server chưa bật hoặc gặp lỗi, tự động chuyển sang Mock API:', err.message);
      return await mockApi.getUsers(params);
    }
  },

  // 2. Tạo mới 1 người dùng vào PostgreSQL
  async createUser(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Lỗi khi tạo người dùng');
      }
      return await response.json();
    } catch (err) {
      console.warn('⚡ Fallback sang Mock API createUser:', err.message);
      return await mockApi.createUser(userData);
    }
  },

  // 3. Cập nhật thông tin người dùng trong PostgreSQL
  async updateUser(id, userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Lỗi khi cập nhật người dùng');
      }
      return await response.json();
    } catch (err) {
      console.warn('⚡ Fallback sang Mock API updateUser:', err.message);
      return await mockApi.updateUser(id, userData);
    }
  },

  // 4. Xóa người dùng khỏi PostgreSQL
  async deleteUser(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Lỗi khi xóa người dùng');
      return true;
    } catch (err) {
      console.warn('⚡ Fallback sang Mock API deleteUser:', err.message);
      return await mockApi.deleteUser(id);
    }
  },

  // 5. Import hàng loạt dữ liệu Excel xuống PostgreSQL (Upsert Batch)
  async importUsersBatch(userList, allowOverwrite = true) {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/batch-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: userList,
          allow_overwrite: allowOverwrite,
        }),
      });
      if (!response.ok) throw new Error('Lỗi khi Import hàng loạt xuống Database');
      const result = await response.json();
      return {
        updatedCount: result.updated_count,
        insertedCount: result.inserted_count,
        total: result.total_processed,
      };
    } catch (err) {
      console.warn('⚡ Fallback sang Mock API importUsersBatch:', err.message);
      return await mockApi.importUsersBatch(userList, allowOverwrite);
    }
  },

  // 6. Lấy tập hợp Mã nhân viên hiện có từ PostgreSQL
  async getExistingStaffCodes() {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/staff-codes`);
      if (!response.ok) throw new Error('Lỗi khi lấy danh sách mã nhân viên');
      const codes = await response.json();
      return new Set(codes.map(c => String(c)));
    } catch (err) {
      console.warn('⚡ Fallback sang Mock API getExistingStaffCodes:', err.message);
      return await mockApi.getExistingStaffCodes();
    }
  }
};
