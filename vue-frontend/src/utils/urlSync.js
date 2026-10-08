/**
 * ⚡ BI-DIRECTIONAL URL QUERY PARAMETER SYNCHRONIZATION
 * Tự động đồng bộ 2 chiều giữa trạng thái Bảng (Search, Filter, Sort, Pagination) và URL Browser (Deep Linking).
 * Giúp người dùng có thể copy và chia sẻ URL cho người khác mở lên xem ĐÚNG TRẠNG THÁI đang tìm kiếm/lọc/sắp xếp.
 */

export function syncStateToUrl(state) {
  try {
    const params = new URLSearchParams();

    // 1. Pagination Params
    if (state.pagination?.current && state.pagination.current > 1) {
      params.set('page', state.pagination.current);
    }
    if (state.pagination?.pageSize && state.pagination.pageSize !== 10) {
      params.set('pageSize', state.pagination.pageSize);
    }

    // 2. Search Query Params (Đồng bộ cả searchValue và search)
    if (state.searchQuery && state.searchQuery.trim()) {
      const q = state.searchQuery.trim();
      params.set('search', q);
      params.set('searchValue', q); // Hỗ trợ đúng chuẩn tên param như trong hình ảnh người dùng yêu cầu
    }

    // 3. Filter Params
    if (state.filters?.department) {
      params.set('department', state.filters.department);
    }
    if (state.filters?.jobTitle) {
      params.set('jobTitle', state.filters.jobTitle);
    }
    if (state.filters?.role) {
      params.set('role', state.filters.role);
    }

    // 4. Sorter Params
    if (state.sorter?.field) {
      params.set('sortBy', state.sorter.field);
      params.set('sort', state.sorter.field);
    }
    if (state.sorter?.order) {
      params.set('sortOrder', state.sorter.order);
      params.set('order', state.sorter.order);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    // Cập nhật thanh địa chỉ URL của trình duyệt không làm reload trang
    window.history.replaceState(null, '', newUrl);
  } catch (err) {
    console.error('Error syncing state to URL:', err);
  }
}

export function syncUrlToState(store) {
  try {
    const params = new URLSearchParams(window.location.search);

    const pageRaw = params.get('page') || params.get('pageIndex');
    const pageSizeRaw = params.get('pageSize');
    const searchRaw = params.get('search') || params.get('searchValue') || params.get('q') || '';
    const departmentRaw = params.get('department');
    const jobTitleRaw = params.get('jobTitle') || params.get('job_title');
    const roleRaw = params.get('role');
    const sortByRaw = params.get('sortBy') || params.get('sort');
    const sortOrderRaw = params.get('sortOrder') || params.get('order');

    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 10;

    store.pagination.current = isNaN(page) || page < 1 ? 1 : page;
    store.pagination.pageSize = isNaN(pageSize) || pageSize < 1 ? 10 : pageSize;
    store.searchQuery = searchRaw || '';

    store.filters.department = departmentRaw || null;
    store.filters.jobTitle = jobTitleRaw || null;
    store.filters.role = roleRaw || null;

    store.sorter.field = sortByRaw || null;
    store.sorter.order = sortOrderRaw || null;

    return {
      page: store.pagination.current,
      pageSize: store.pagination.pageSize,
      search: store.searchQuery,
      department: store.filters.department,
      jobTitle: store.filters.jobTitle,
      role: store.filters.role,
      sortBy: store.sorter.field,
      sortOrder: store.sorter.order,
    };
  } catch (err) {
    console.error('Error syncing URL to state:', err);
    return null;
  }
}
