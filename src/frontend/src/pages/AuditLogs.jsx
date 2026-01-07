import React, { useState, useMemo } from 'react';

const styles = {
  container: {
    animation: 'fadeIn 0.3s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: '#fff',
    color: '#333',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  filtersCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: 24,
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  filterInput: {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  filterSelect: {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    background: '#fff',
    cursor: 'pointer',
  },
  logsCard: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  logsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  logItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: '16px 20px',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.2s',
    cursor: 'pointer',
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logContent: {
    flex: 1,
    minWidth: 0,
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logAction: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  logTimestamp: {
    fontSize: 12,
    color: '#9ca3af',
    whiteSpace: 'nowrap',
  },
  logDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  logMeta: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  logMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  severityBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  severityInfo: {
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  severityWarning: {
    background: '#fef3c7',
    color: '#d97706',
  },
  severityError: {
    background: '#fef2f2',
    color: '#dc2626',
  },
  severitySuccess: {
    background: '#dcfce7',
    color: '#16a34a',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderTop: '1px solid #e5e7eb',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6b7280',
  },
  paginationButtons: {
    display: 'flex',
    gap: 8,
  },
  pageButton: {
    padding: '8px 12px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280',
  },
  searchHighlight: {
    background: '#fef3c7',
    padding: '0 2px',
    borderRadius: 2,
  },
};

// Mock audit log data
const mockLogs = [
  {
    id: 1,
    action: 'User Login',
    description: 'User john.doe@company.com successfully logged in from Chrome on Windows',
    user: 'john.doe@company.com',
    ip: '192.168.1.105',
    timestamp: '2024-01-15 14:32:18',
    severity: 'success',
    category: 'authentication',
  },
  {
    id: 2,
    action: 'Failed Login Attempt',
    description: 'Failed login attempt for user admin@company.com - invalid credentials',
    user: 'admin@company.com',
    ip: '203.45.67.89',
    timestamp: '2024-01-15 14:28:45',
    severity: 'warning',
    category: 'authentication',
  },
  {
    id: 3,
    action: 'User Created',
    description: 'New user emily.chen@company.com was created by administrator',
    user: 'system',
    ip: '10.0.0.1',
    timestamp: '2024-01-15 13:45:22',
    severity: 'info',
    category: 'user_management',
  },
  {
    id: 4,
    action: 'Permission Changed',
    description: 'User mike.johnson@company.com was granted admin privileges',
    user: 'admin@company.com',
    ip: '192.168.1.50',
    timestamp: '2024-01-15 12:15:33',
    severity: 'warning',
    category: 'authorization',
  },
  {
    id: 5,
    action: 'Password Reset',
    description: 'Password reset initiated for sarah.wilson@company.com',
    user: 'sarah.wilson@company.com',
    ip: '172.16.0.45',
    timestamp: '2024-01-15 11:22:09',
    severity: 'info',
    category: 'authentication',
  },
  {
    id: 6,
    action: 'API Key Generated',
    description: 'New API key generated for application "Mobile App"',
    user: 'dev@company.com',
    ip: '10.0.0.15',
    timestamp: '2024-01-15 10:55:41',
    severity: 'info',
    category: 'api',
  },
  {
    id: 7,
    action: 'Suspicious Activity',
    description: 'Multiple failed login attempts detected from IP 203.45.67.89',
    user: 'system',
    ip: '203.45.67.89',
    timestamp: '2024-01-15 10:30:00',
    severity: 'error',
    category: 'security',
  },
  {
    id: 8,
    action: 'Team Membership Updated',
    description: 'User lisa.chen@company.com added to team "Engineering"',
    user: 'admin@company.com',
    ip: '192.168.1.50',
    timestamp: '2024-01-15 09:45:18',
    severity: 'info',
    category: 'user_management',
  },
  {
    id: 9,
    action: 'MFA Enabled',
    description: 'Multi-factor authentication enabled for robert.taylor@company.com',
    user: 'robert.taylor@company.com',
    ip: '192.168.1.78',
    timestamp: '2024-01-15 09:12:55',
    severity: 'success',
    category: 'authentication',
  },
  {
    id: 10,
    action: 'Session Terminated',
    description: 'Active session forcefully terminated for user david.lee@company.com',
    user: 'admin@company.com',
    ip: '192.168.1.50',
    timestamp: '2024-01-15 08:30:22',
    severity: 'warning',
    category: 'authentication',
  },
];

const getSeverityStyle = (severity) => {
  switch (severity) {
    case 'success':
      return styles.severitySuccess;
    case 'warning':
      return styles.severityWarning;
    case 'error':
      return styles.severityError;
    default:
      return styles.severityInfo;
  }
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'success':
      return '#22c55e';
    case 'warning':
      return '#f59e0b';
    case 'error':
      return '#ef4444';
    default:
      return '#3b82f6';
  }
};

const getActionIcon = (category) => {
  switch (category) {
    case 'authentication':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      );
    case 'user_management':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'authorization':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'security':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
};

const AuditLogs = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredLogs = useMemo(() => {
    return mockLogs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.ip.includes(searchQuery);
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
      return matchesSearch && matchesSeverity && matchesCategory;
    });
  }, [searchQuery, severityFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Audit Logs</h1>
          <p style={styles.subtitle}>
            Monitor and search all security and administrative events
          </p>
        </div>
        <button
          style={styles.exportButton}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filtersCard}>
        <div style={styles.filtersGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Search</label>
            <input
              type="text"
              placeholder="Search logs..."
              style={styles.filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Severity</label>
            <select
              style={styles.filterSelect}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Category</label>
            <select
              style={styles.filterSelect}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="authentication">Authentication</option>
              <option value="user_management">User Management</option>
              <option value="authorization">Authorization</option>
              <option value="security">Security</option>
              <option value="api">API</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date From</label>
            <input
              type="date"
              style={styles.filterInput}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Date To</label>
            <input
              type="date"
              style={styles.filterInput}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div style={styles.logsCard}>
        <ul style={styles.logsList}>
          {paginatedLogs.length > 0 ? (
            paginatedLogs.map((log) => (
              <li
                key={log.id}
                style={styles.logItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  style={{
                    ...styles.logIcon,
                    background: `${getSeverityColor(log.severity)}15`,
                    color: getSeverityColor(log.severity),
                  }}
                >
                  {getActionIcon(log.category)}
                </div>
                <div style={styles.logContent}>
                  <div style={styles.logHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={styles.logAction}>{log.action}</span>
                      <span style={{ ...styles.severityBadge, ...getSeverityStyle(log.severity) }}>
                        {log.severity}
                      </span>
                    </div>
                    <span style={styles.logTimestamp}>{log.timestamp}</span>
                  </div>
                  <p style={styles.logDescription}>{log.description}</p>
                  <div style={styles.logMeta}>
                    <span style={styles.logMetaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {log.user}
                    </span>
                    <span style={styles.logMetaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                        <line x1="6" y1="6" x2="6.01" y2="6" />
                        <line x1="6" y1="18" x2="6.01" y2="18" />
                      </svg>
                      {log.ip}
                    </span>
                    <span style={styles.logMetaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {log.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li style={styles.emptyState}>
              No audit logs found matching your criteria.
            </li>
          )}
        </ul>

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div style={styles.pagination}>
            <span style={styles.paginationInfo}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of{' '}
              {filteredLogs.length} logs
            </span>
            <div style={styles.paginationButtons}>
              <button
                style={styles.pageButton}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                style={styles.pageButton}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
