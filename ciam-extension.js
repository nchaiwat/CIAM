const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// รายชื่อบัญชีระบบที่ห้ามแก้ไขสถานะเด็ดขาด
const PROTECTED_ACCOUNTS = ['administrator', 'krbtgt', 'guest', 'defaultaccount', 'svc_backup', 'svc_sql'];

const VALID_KEYS = [
    'mgmt_ciam_key_9a88b1c0d2e3f4a5',
    'aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823'
];

function verifyManagementKey(req, res, next) {
    // ดึง Key จากทุกช่องทาง: Headers, Authorization Bearer, Query Parameters และ Body
    const rawKey = (
        req.headers['x-management-api-key'] ||
        req.headers['x-api-key'] ||
        req.headers['x-secret-key'] ||
        (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) ||
        req.query.api_key ||
        req.query.secret_key ||
        req.query.management_key ||
        req.body?.api_key ||
        req.body?.secret_key
    );

    // Node.js Express จะรวม Header ที่ส่งมาซ้ำด้วยลูกน้ำ (เช่น 'key, key') -> ตัดเอา token ตัวแรก
    const firstToken = rawKey ? rawKey.toString().split(',')[0].trim() : '';
    const fullKeyStr = rawKey ? rawKey.toString().trim() : '';

    const clientIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
    console.log(`[CIAM AD] Incoming ${req.method} ${req.originalUrl || req.url} | Key: ${firstToken ? firstToken.substring(0, 10) + '...' : 'NONE'} | IP: ${clientIp}`);

    // ตรวจสอบว่าคีย์ตรงกับหนึ่งใน Valid Keys หรือมี Valid Key บรรจุอยู่
    const isValid = VALID_KEYS.some(k => fullKeyStr.includes(k) || firstToken === k);

    if (!isValid) {
        console.log(`[CIAM AD REJECTED 401] Invalid Key received: '${rawKey}'`);
        return res.status(401).json({
            error: 'Unauthorized: Invalid Management API Key',
            received_key: firstToken ? `${firstToken.substring(0, 8)}...` : null
        });
    }
    next();
}

module.exports = (app) => {
    // 1. Health Check
    app.get('/health', (req, res) => {
        res.json({ status: 'healthy', service: 'AD Sync Agent', timestamp: new Date().toISOString() });
    });

    // 2. ดึงรายชื่อบัญชีผู้ใช้ทั้งหมดจาก Active Directory (รองรับทั้ง GET และ POST)
    const handleGetUsers = async (req, res) => {
        try {
            console.log('[CIAM AD] Querying Active Directory users via PowerShell...');
            const psCmd = 'Get-ADUser -Filter * -Properties Enabled, DisplayName, EmailAddress, Department, EmployeeID | Select-Object sAMAccountName, DisplayName, EmailAddress, Department, EmployeeID, Enabled | ConvertTo-Json -Depth 2';
            const { stdout } = await execPromise('powershell -NoProfile -Command "' + psCmd + '"', { maxBuffer: 10 * 1024 * 1024 });
            const raw = stdout ? JSON.parse(stdout) : [];
            const rawArray = Array.isArray(raw) ? raw : [raw];

            const accounts = rawArray
                .map(u => {
                    const uname = u.sAMAccountName || u.username;
                    if (!uname) return null;
                    return {
                        username: uname,
                        full_name: u.DisplayName || u.full_name || uname,
                        email: u.EmailAddress || u.email || (uname.toLowerCase() + '@windowasia.com'),
                        department: u.Department || u.department || 'Active Directory',
                        employee_id: u.EmployeeID || u.employee_id || null,
                        is_active: u.Enabled !== undefined ? !!u.Enabled : (u.is_active !== undefined ? !!u.is_active : true),
                        group_name: 'Domain Users'
                    };
                })
                .filter(u => u && !['krbtgt', 'guest', 'defaultaccount'].includes(u.username.toLowerCase()));

            console.log(`[CIAM AD SUCCESS] Returning ${accounts.length} users to CIAM`);
            res.json({ total_accounts: accounts.length, accounts: accounts });
        } catch (error) {
            console.error('[CIAM AD ERROR]', error);
            res.status(500).json({ error: 'AD Query failed: ' + error.message });
        }
    };

    app.get('/api/v1/ad/users', verifyManagementKey, handleGetUsers);
    app.post('/api/v1/ad/users', verifyManagementKey, handleGetUsers);

    // 3. ปิด / เปิด การใช้งานบัญชีใน AD เมื่อพนักงานลาออกหรือคืนสิทธิ์
    const handleStatusPatch = async (req, res) => {
        const username = req.params.username.toLowerCase();
        const { is_active } = req.body;
        if (PROTECTED_ACCOUNTS.includes(username)) return res.status(403).json({ error: 'Protected account' });

        try {
            const action = is_active ? 'Enable-ADAccount' : 'Disable-ADAccount';
            const cmd = 'powershell -NoProfile -Command "' + action + ' -Identity \'' + username + '\'"';
            await execPromise(cmd);
            res.json({ success: true, username, is_active: !!is_active });
        } catch (error) {
            res.status(500).json({ error: 'Action failed: ' + error.message });
        }
    };

    app.patch('/api/v1/ad/users/:username/status', verifyManagementKey, handleStatusPatch);
    app.post('/api/v1/ad/users/:username/status', verifyManagementKey, handleStatusPatch);
};
