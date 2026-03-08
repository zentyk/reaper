import puppeteer from 'puppeteer';

(async () => {
    try {
        console.log("Starting headless browser test...");
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`BROWSER ${msg.type().toUpperCase()}:`, msg.text());
            } else {
                console.log(`BROWSER MSG:`, msg.text());
            }
        });

        page.on('pageerror', error => {
            console.log('BROWSER PAGE ERROR (Uncaught Exception):', error.message);
        });

        page.on('response', response => {
            if (response.status() >= 400) {
                console.log('FAILED RESPONSE:', response.status(), response.url());
            }
        });

        console.log("Navigating to http://localhost:5173...");
        const response = await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
        console.log("Navigation status:", response.status());

        await new Promise(r => setTimeout(r, 2000));

        console.log("Test complete. Closing browser.");
        await browser.close();
    } catch (e) {
        console.error("TEST SCRIPT ERROR:", e);
    }
})();
