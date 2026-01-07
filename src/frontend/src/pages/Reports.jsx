import React, { useState } from 'react';

const styles = {
  container: {
    animation: 'fadeIn 0.3s ease-out',
  },
  header: {
    marginBottom: 32,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 24,
    marginBottom: 32,
  },
  reportCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  reportCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 8,
  },
  reportDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 1.5,
    marginBottom: 16,
  },
  reportMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTop: '1px solid #f3f4f6',
  },
  reportFormat: {
    fontSize: 12,
    color: '#9ca3af',
  },
  generateButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #635bff 0%, #7c3aed 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  scheduledSection: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 20,
  },
  scheduleList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  scheduleItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  scheduleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  scheduleFrequency: {
    fontSize: 12,
    color: '#6b7280',
  },
  scheduleActions: {
    display: 'flex',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 6,
    color: '#6b7280',
    transition: 'all 0.2s',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  },
  statusActive: {
    background: '#dcfce7',
    color: '#16a34a',
  },
  statusPaused: {
    background: '#f3f4f6',
    color: '#6b7280',
  },
  recentSection: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  recentList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  recentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
  },
  recentName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  recentDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  downloadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    color: '#333',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
  },
};

// Mock report types
const reportTypes = [
  {
    id: 1,
    title: 'User Activity Report',
    description: 'Comprehensive overview of user login patterns, session durations, and activity metrics.',
    format: 'PDF, CSV',
    color: '#635bff',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 2,
    title: 'Security Audit Report',
    description: 'Detailed analysis of security events, failed authentication attempts, and potential threats.',
    format: 'PDF, CSV',
    color: '#ef4444',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 3,
    title: 'Compliance Summary',
    description: 'Overview of compliance status for SOC 2, GDPR, HIPAA, and other regulatory requirements.',
    format: 'PDF',
    color: '#22c55e',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: 4,
    title: 'Access Control Report',
    description: 'Summary of role assignments, permission changes, and access patterns across teams.',
    format: 'PDF, CSV, JSON',
    color: '#f59e0b',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: 5,
    title: 'API Usage Analytics',
    description: 'Metrics on API calls, response times, error rates, and quota utilization.',
    format: 'PDF, CSV',
    color: '#06b6d4',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 6,
    title: 'Team Performance Report',
    description: 'Analysis of team productivity, collaboration metrics, and resource utilization.',
    format: 'PDF',
    color: '#8b5cf6',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

// Mock scheduled reports
const scheduledReports = [
  { id: 1, name: 'Weekly Security Audit', frequency: 'Every Monday at 9:00 AM', status: 'active', color: '#ef4444' },
  { id: 2, name: 'Monthly Compliance Summary', frequency: '1st of each month', status: 'active', color: '#22c55e' },
  { id: 3, name: 'Daily User Activity', frequency: 'Every day at 6:00 AM', status: 'paused', color: '#635bff' },
];

// Mock recent reports
const recentReports = [
  { id: 1, name: 'Security Audit Report - Jan 2024', date: 'Generated on Jan 15, 2024', size: '2.4 MB' },
  { id: 2, name: 'User Activity Report - Jan 2024', date: 'Generated on Jan 14, 2024', size: '1.8 MB' },
  { id: 3, name: 'Compliance Summary - Q4 2023', date: 'Generated on Jan 10, 2024', size: '3.1 MB' },
  { id: 4, name: 'Access Control Report - Jan 2024', date: 'Generated on Jan 8, 2024', size: '1.2 MB' },
];

const Reports = () => {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(null);

  const handleGenerate = (reportId, e) => {
    e.stopPropagation();
    setGeneratingReport(reportId);
    // Simulate report generation
    setTimeout(() => setGeneratingReport(null), 2000);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Reports</h1>
        <p style={styles.subtitle}>
          Generate compliance reports and analytics for your organization
        </p>
      </div>

      {/* Report Types Grid */}
      <div style={styles.grid}>
        {reportTypes.map((report) => (
          <div
            key={report.id}
            style={{
              ...styles.reportCard,
              ...(hoveredCard === report.id ? styles.reportCardHover : {}),
            }}
            onMouseEnter={() => setHoveredCard(report.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={{ ...styles.reportIcon, background: report.color }}>
              {report.icon}
            </div>
            <h3 style={styles.reportTitle}>{report.title}</h3>
            <p style={styles.reportDescription}>{report.description}</p>
            <div style={styles.reportMeta}>
              <span style={styles.reportFormat}>Format: {report.format}</span>
              <button
                style={{
                  ...styles.generateButton,
                  opacity: generatingReport === report.id ? 0.7 : 1,
                }}
                onClick={(e) => handleGenerate(report.id, e)}
                disabled={generatingReport === report.id}
              >
                {generatingReport === report.id ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Scheduled Reports */}
      <div style={styles.scheduledSection}>
        <h2 style={styles.sectionTitle}>Scheduled Reports</h2>
        <ul style={styles.scheduleList}>
          {scheduledReports.map((schedule) => (
            <li key={schedule.id} style={styles.scheduleItem}>
              <div style={styles.scheduleInfo}>
                <div style={{ ...styles.scheduleIcon, background: `${schedule.color}20` }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={schedule.color}
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <div style={styles.scheduleName}>{schedule.name}</div>
                  <div style={styles.scheduleFrequency}>{schedule.frequency}</div>
                </div>
              </div>
              <div style={styles.scheduleActions}>
                <span
                  style={{
                    ...styles.statusBadge,
                    ...(schedule.status === 'active' ? styles.statusActive : styles.statusPaused),
                  }}
                >
                  {schedule.status === 'active' ? 'Active' : 'Paused'}
                </span>
                <button
                  style={styles.iconButton}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title="Edit schedule"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  style={styles.iconButton}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title="Delete schedule"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Recent Reports */}
      <div style={styles.recentSection}>
        <h2 style={styles.sectionTitle}>Recent Reports</h2>
        <ul style={styles.recentList}>
          {recentReports.map((report) => (
            <li key={report.id} style={styles.recentItem}>
              <div style={styles.recentInfo}>
                <div style={styles.recentIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div>
                  <div style={styles.recentName}>{report.name}</div>
                  <div style={styles.recentDate}>{report.date} - {report.size}</div>
                </div>
              </div>
              <button
                style={styles.downloadButton}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Reports;
