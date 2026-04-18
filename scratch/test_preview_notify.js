const axios = require('axios');

async function testFetchSettings() {
    try {
        const response = await axios.post('http://localhost:3000/api/bot/preview', {
            commit_sha: 'test_sha_123',
            branch: 'feat/preview-testing',
            preview_url: 'https://bronx-site-preview-777.onrender.com',
            dashboard_url: 'https://dashboard.render.com/web/srv-test/previews'
        }, {
            headers: {
                'X-API-Key': 'VY5QYz1s%r1hcqDvX7%^',
                'Content-Type': 'application/json'
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Body:', response.data);
    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

testFetchSettings();
