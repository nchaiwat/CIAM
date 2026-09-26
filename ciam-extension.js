const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const PROTECTED_ACCOUNTS = ['administrator', 'krbtgt', 'guest', 'defaultaccount', 'svc_backup', 'svc_sql'];

function verifyManagementKey(req, res, next) {
    const apiKey = req.headers['x-management-api-key'] || req.headers['x-api-key'] || req.headers['x-secret-key'];
    if (
        apiKey !== 'mgmt_ciam_key_9a88b1c0d2e3f4a5' &&
        apiKey !== 'aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823'
    ) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Management API Key' });
    }
    next();
}

module.exports = (app) => {
    app.get('/health', (req, res) => {
        res.json({ status: 'healthy', service: 'AD Sync Agent', timestamp: new Date().toISOString() });
    });

    app.get('/api/v1/ad/users', verifyManagementKey, async (req, res) => {
        try {
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

            res.json({ total_accounts: accounts.length, accounts: accounts });
        } catch (error) {
            res.status(500).json({ error: 'AD Query failed: ' + error.message });
        }
    });

    app.patch('/api/v1/ad/users/:username/status', verifyManagementKey, async (req, res) => {
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
    });
};
