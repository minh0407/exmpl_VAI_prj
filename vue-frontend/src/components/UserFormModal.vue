<template>
  <a-modal
    v-model:open="store.isFormModalOpen"
    :title="store.editingUser ? 'Cập nhật thông tin người dùng' : 'Thêm mới người dùng'"
    width="600px"
    @ok="handleOk"
    @cancel="store.isFormModalOpen = false"
    :confirmLoading="submitting"
  >
    <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="Họ và tên" name="full_name">
            <a-input v-model:value="formState.full_name" placeholder="Nhập họ và tên" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="Mã nhân viên" name="staff_code">
            <a-input v-model:value="formState.staff_code" placeholder="Nhập mã nhân viên" :disabled="!!store.editingUser" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="Email" name="email">
            <a-input v-model:value="formState.email" placeholder="example@viettel.com.vn" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="Số điện thoại" name="phone">
            <a-input v-model:value="formState.phone" placeholder="0988888888" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="Chức danh" name="job_title">
            <a-input v-model:value="formState.job_title" placeholder="Kỹ sư, Super Admin..." />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="Đơn vị" name="department">
            <a-select v-model:value="formState.department">
              <a-select-option value="CNM-VAI">CNM-VAI</a-select-option>
              <a-select-option value="CNM - VAI">CNM - VAI</a-select-option>
              <a-select-option value="VTNet">VTNet</a-select-option>
              <a-select-option value="VAI">VAI</a-select-option>
              <a-select-option value="VTS">VTS</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="Vai trò" name="role">
            <a-select v-model:value="formState.role">
              <a-select-option value="Admin">Admin</a-select-option>
              <a-select-option value="User">User</a-select-option>
              <a-select-option value="Editor">Editor</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="Địa chỉ" name="address">
            <a-input v-model:value="formState.address" placeholder="Hà Nội, TP.HCM..." />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch, reactive } from 'vue';
import { useUserStore } from '../stores/userStore';

const store = useUserStore();
const formRef = ref(null);
const submitting = ref(false);

const formState = reactive({
  full_name: '',
  staff_code: '',
  email: '',
  phone: '',
  address: 'Hà Nội',
  job_title: 'Kỹ sư',
  department: 'CNM-VAI',
  role: 'User',
});

const rules = {
  full_name: [{ required: true, message: 'Vui lòng nhập họ và tên', trigger: 'blur' }],
  staff_code: [{ required: true, message: 'Vui lòng nhập mã nhân viên', trigger: 'blur' }],
  email: [{ type: 'email', message: 'Email không đúng định dạng', trigger: 'blur' }],
};

watch(() => store.isFormModalOpen, (isOpen) => {
  if (isOpen) {
    if (store.editingUser) {
      Object.assign(formState, store.editingUser);
    } else {
      Object.assign(formState, {
        full_name: '',
        staff_code: '',
        email: '',
        phone: '',
        address: 'Hà Nội',
        job_title: 'Kỹ sư',
        department: 'CNM-VAI',
        role: 'User',
      });
    }
  }
});

const handleOk = async () => {
  try {
    await formRef.value.validate();
    submitting.value = true;

    let success = false;
    if (store.editingUser) {
      success = await store.updateUser(store.editingUser.id, formState);
    } else {
      success = await store.createUser(formState);
    }

    if (success) {
      store.isFormModalOpen = false;
    }
  } catch (err) {
    console.error(err);
  } finally {
    submitting.value = false;
  }
};
</script>
