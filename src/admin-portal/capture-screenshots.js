const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Ensure assets directory exists
    const assetsDir = path.resolve(__dirname, '../../docs/assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const routes = [
        { path: 'dashboard', name: '01_dashboard.png' },
        { path: 'organizations', name: '02_organizations.png' },
        { path: 'users', name: '03_users.png' },
        { path: 'audit-logs', name: '04_audit_logs.png' },
        { path: 'compliance', name: '05_compliance.png' }
    ];

    const baseUrl = 'http://localhost:4200';

    console.log('Starting screenshot capture...');

    for (const route of routes) {
        try {
            console.log(`Navigating to ${route.path}...`);
            await page.goto(`${baseUrl}/${route.path}`, { waitUntil: 'networkidle0' });

            // Wait a bit for animations/rendering
            await new Promise(r => setTimeout(r, 2000));

            const filePath = path.join(assetsDir, route.name);
            await page.screenshot({ path: filePath, fullPage: true });
            console.log(`Captured ${route.name}`);
        } catch (error) {
            console.error(`Failed to capture ${route.path}:`, error);
        }
    }

    await browser.close();
    console.log('All screenshots captured.');
    process.exit(0);
})();
