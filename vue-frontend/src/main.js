import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import 'ant-design-vue/dist/reset.css';

import App from './App.vue';

const app = createApp(App);

app.use(createPinia());
app.use(Antd);
app.use(VueQueryPlugin);

app.mount('#app');
