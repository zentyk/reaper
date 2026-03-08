import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        {
            name: 'level-editor-save',
            configureServer(server) {
                server.middlewares.use('/api/save-level', async (req, res) => {
                    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', () => {
                        try {
                            const { level, data } = JSON.parse(body);
                            const filePath = resolve(__dirname, `js/levels/level${level}.json`);
                            writeFileSync(filePath, JSON.stringify(data, null, 2));
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ ok: true }));
                        } catch (e) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                });
            }
        }
    ],
})
