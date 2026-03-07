import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

import '../css/styles.css'
import App from './App.vue'

const app = createApp(App)

app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.dark', // Let's keep it dark or system
            cssLayer: false
        }
    }
})

app.mount('#app')
