export const MOCK_DATA = {
    stats: [
        { label: 'Organizations', value: '47', icon: 'business' },
        { label: 'Active Users', value: '1,284', icon: 'people' },
        { label: 'Active Sessions', value: '892', icon: 'devices' },
        { label: 'Compliance Score', value: '94%', icon: 'verified_user' }
    ],
    recentEvents: [
        { timestamp: '2024-01-15 14:30', user: 'admin@acme.com', event: 'Login Success', org: 'Acme Corporation', status: 'success' },
        { timestamp: '2024-01-15 14:25', user: 'bob@techstart.io', event: 'Login Success', org: 'Tech Startup', status: 'success' },
        { timestamp: '2024-01-15 14:20', user: 'unknown@test.com', event: 'Login Failed', org: '-', status: 'error' },
        { timestamp: '2024-01-15 14:15', user: 'admin@acme.com', event: 'Role Assigned', org: 'Acme Corporation', status: 'info' },
        { timestamp: '2024-01-15 14:10', user: 'carol@university.edu', event: 'MFA Enrolled', org: 'State University', status: 'success' }
    ],
    organizations: [
        { name: 'acme-corporation', displayName: 'Acme Corporation', tier: 'Enterprise', tierColor: 'success', members: 150, created: 'Jan 10, 2024' },
        { name: 'tech-startup-inc', displayName: 'Tech Startup Inc', tier: 'Professional', tierColor: 'info', members: 25, created: 'Jan 12, 2024' },
        { name: 'state-university', displayName: 'State University', tier: 'Education', tierColor: 'primary', members: 500, created: 'Jan 14, 2024' }
    ],
    users: [
        { name: 'Alice Admin', email: 'admin@acme.com', org: 'Acme Corporation', roles: ['Admin', 'Compliance'], status: 'Active', lastLogin: '2 min ago' },
        { name: 'Bob Manager', email: 'bob@acme.com', org: 'Acme Corporation', roles: ['Manager'], status: 'Active', lastLogin: '1 hour ago' },
        { name: 'Carol User', email: 'carol@techstart.io', org: 'Tech Startup', roles: ['Member'], status: 'Active', lastLogin: '3 hours ago' },
        { name: 'David Developer', email: 'david@acme.com', org: 'Acme Corporation', roles: ['Member'], status: 'Active', lastLogin: '1 day ago' },
        { name: 'Elena Founder', email: 'elena@techstart.io', org: 'Tech Startup', roles: ['Admin'], status: 'Active', lastLogin: '5 min ago' }
    ],
    complianceReports: [
        { id: 'RPT-001', framework: 'SOC 2', org: 'Acme Corporation', period: 'Q4 2024', score: '94%', color: 'success', status: 'Completed' },
        { id: 'RPT-002', framework: 'HIPAA', org: 'State University', period: 'Q4 2024', score: '87%', color: 'warning', status: 'Completed' },
        { id: 'RPT-003', framework: 'GDPR', org: 'Tech Startup', period: 'Q4 2024', score: '91%', color: 'success', status: 'Completed' }
    ]
};
