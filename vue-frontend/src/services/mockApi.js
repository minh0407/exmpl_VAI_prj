import { fuzzySearchList } from '../utils/fuzzySearch';

// Pre-seeded initial data matching the user's screenshot exactly
const INITIAL_USERS = [
  { id: 1, full_name: 'Super Admin', staff_code: '999999', email: 'super_admin@viettelai.vn', phone: '', address: 'Hà Nội', job_title: 'Super Admin', department: 'CNM-VAI', role: 'Admin' },
  { id: 2, full_name: 'Trần Huy Hoàng', staff_code: '431452', email: 'hoangth33@viettel.com.vn', phone: '868695383', address: 'Hà Nội', job_title: 'Kỹ sư trí tuệ nhân tạo', department: 'CNM-VAI', role: 'Admin' },
  { id: 3, full_name: 'Nguyễn Khắc Minh', staff_code: '431451', email: 'minhnk2@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'AI Eng', department: 'CNM - VAI', role: 'User' },
  { id: 4, full_name: 'AI Service', staff_code: '888888', email: 'ai_service@viettelai.vn', phone: '', address: 'Hà Nội', job_title: 'AI Service', department: 'CNM-VAI', role: 'User' },
  { id: 5, full_name: 'Nguyễn Đức Huy', staff_code: '467055', email: 'huynd277@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'Kỹ sư', department: 'VTNet', role: 'Editor' },
  { id: 6, full_name: 'Đinh Quang Lâm', staff_code: '434831', email: 'lamdq3@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'Kỹ sư', department: 'VTNet', role: 'Admin' },
  { id: 7, full_name: 'Kiều Nhật Long', staff_code: '472777', email: 'longkn@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'BA', department: 'VAI', role: 'User' },
  { id: 8, full_name: 'TT KTKV2', staff_code: '222222', email: 'ktkv2@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'Kỹ sư', department: 'VTNet', role: 'Admin' },
  { id: 9, full_name: 'TT KTKV1', staff_code: '111111', email: 'ktkv1@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'Kỹ sư', department: 'VTNet', role: 'Admin' },
  { id: 10, full_name: 'TT KTKV3', staff_code: '333333', email: 'ktkv3@viettel.com.vn', phone: '', address: 'Hà Nội', job_title: 'Kỹ sư', department: 'VTNet', role: 'Admin' },
];

let usersDatabase = [...INITIAL_USERS];
let nextId = 11;

export const mockApi = {
  // Lấy danh sách phân trang, tìm kiếm fuzzy & sắp xếp
  async getUsers(params = {}) {
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulating network latency

    let list = [...usersDatabase];

    // Filter by Search Query (Fuzzy Search)
    if (params.search) {
      list = fuzzySearchList(list, params.search, ['full_name', 'staff_code', 'email', 'phone', 'job_title', 'department', 'role']);
    }

    // Filter by Department
    if (params.department) {
      list = list.filter(u => u.department === params.department);
    }

    // Filter by Role
    if (params.role) {
      list = list.filter(u => u.role === params.role);
    }

    // Sorting
    if (params.sortBy) {
      const field = params.sortBy;
      const isAsc = params.sortOrder !== 'descend';
      list.sort((a, b) => {
        const valA = String(a[field] || '');
        const valB = String(b[field] || '');
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    const total = list.length;
    const page = parseInt(params.page || 1, 10);
    const pageSize = parseInt(params.pageSize || 10, 10);

    const startIndex = (page - 1) * pageSize;
    const paginatedList = list.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedList,
      total,
      page,
      pageSize,
    };
  },

  // Tạo người dùng mới
  async createUser(userData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const newUser = {
      id: nextId++,
      ...userData,
    };
    usersDatabase.unshift(newUser);
    return newUser;
  },

  // Cập nhật người dùng
  async updateUser(id, userData) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const index = usersDatabase.findIndex(u => u.id === id);
    if (index !== -1) {
      usersDatabase[index] = { ...usersDatabase[index], ...userData };
      return usersDatabase[index];
    }
    throw new Error('Không tìm thấy người dùng');
  },

  // Xóa người dùng
  async deleteUser(id) {
    await new Promise(resolve => setTimeout(resolve, 100));
    usersDatabase = usersDatabase.filter(u => u.id !== id);
    return true;
  },

  // Import hàng loạt danh sách người dùng thành công
  async importUsersBatch(userList) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const createdUsers = userList.map(u => ({
      id: nextId++,
      ...u,
    }));
    usersDatabase = [...createdUsers, ...usersDatabase];
    return { count: createdUsers.length };
  },

  // Lấy tập hợp mã nhân viên hiện có (dùng kiểm tra trùng lặp)
  async getExistingStaffCodes() {
    return new Set(usersDatabase.map(u => u.staff_code));
  }
};
