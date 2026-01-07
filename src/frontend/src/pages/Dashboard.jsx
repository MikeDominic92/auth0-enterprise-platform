import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 24,
    marginBottom: 32,
  },
  metricCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  metricCardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
  },
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricChange: {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 20,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: 24,
    marginBottom: 32,
  },
  chartCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 20,
  },
  chartPlaceholder: {
    height: 200,
    background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: 14,
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 200,
    paddingTop: 20,
  },
  bar: {
    width: 32,
    background: 'linear-gradient(180deg, #635bff 0%, #7c3aed 100%)',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.5s ease-out',
  },
  recentActivityCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  activityList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: '16px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
};

// Mock data for demonstration
const mockMetrics = [
  {
    id: 1,
    label: 'Total Users',
    value: '12,847',
    change: '+12%',
    positive: true,
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
    label: 'Active Sessions',
    value: '3,421',
    change: '+8%',
    positive: true,
    color: '#22c55e',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    id: 3,
    label: 'Teams',
    value: '156',
    change: '+3%',
    positive: true,
    color: '#f59e0b',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <circle cx="19" cy="11" r="2" />
        <path d="M19 8v6" />
        <path d="M16 11h6" />
      </svg>
    ),
  },
  {
    id: 4,
    label: 'Failed Logins (24h)',
    value: '47',
    change: '-23%',
    positive: true,
    color: '#ef4444',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
];

const mockBarData = [65, 85, 45, 90, 75, 60, 80, 95, 70, 85, 55, 88];

const mockActivity = [
  {
    id: 1,
    text: 'New user registration: john.doe@company.com',
    time: '2 minutes ago',
    type: 'success',
  },
  {
    id: 2,
    text: 'Password reset requested for sarah.wilson@company.com',
    time: '15 minutes ago',
    type: 'warning',
  },
  {
    id: 3,
    text: 'Team "Engineering" updated - 3 members added',
    time: '1 hour ago',
    type: 'info',
  },
  {
    id: 4,
    text: 'Failed login attempt from IP 192.168.1.100',
    time: '2 hours ago',
    type: 'error',
  },
  {
    id: 5,
    text: 'Compliance report generated successfully',
    time: '3 hours ago',
    type: 'success',
  },
];

const getActivityColor = (type) => {
  switch (type) {
    case 'success':
      return '#22c55e';
    case 'warning':
      return '#f59e0b';
    case 'error':
      return '#ef4444';
    default:
      return '#635bff';
  }
};

const Dashboard = () => {
  const { user } = useAuth0();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [animatedBars, setAnimatedBars] = useState(false);

  useEffect(() => {
    // Trigger bar animation after mount
    const timer = setTimeout(() => setAnimatedBars(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          {greeting()}, {user?.given_name || user?.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p style={styles.subtitle}>
          Here is what is happening with your organization today.
        </p>
      </div>

      {/* Metrics Grid */}
      <div style={styles.metricsGrid}>
        {mockMetrics.map((metric) => (
          <div
            key={metric.id}
            style={{
              ...styles.metricCard,
              ...(hoveredCard === metric.id ? styles.metricCardHover : {}),
            }}
            onMouseEnter={() => setHoveredCard(metric.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: metric.color }}>
                {metric.icon}
              </div>
              <span
                style={{
                  ...styles.metricChange,
                  background: metric.positive ? '#dcfce7' : '#fef2f2',
                  color: metric.positive ? '#16a34a' : '#dc2626',
                }}
              >
                {metric.change}
              </span>
            </div>
            <div style={styles.metricValue}>{metric.value}</div>
            <div style={styles.metricLabel}>{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Login Activity (Last 12 Months)</h3>
          <div style={styles.barChart}>
            {mockBarData.map((value, index) => (
              <div
                key={index}
                style={{
                  ...styles.bar,
                  height: animatedBars ? `${value * 2}px` : '0px',
                  transitionDelay: `${index * 50}ms`,
                }}
                title={`Month ${index + 1}: ${value}% activity`}
              />
            ))}
          </div>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Authentication Methods</h3>
          <div style={styles.chartPlaceholder}>
            [Chart visualization - integrate with charting library]
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={styles.recentActivityCard}>
        <h3 style={styles.chartTitle}>Recent Activity</h3>
        <ul style={styles.activityList}>
          {mockActivity.map((activity) => (
            <li key={activity.id} style={styles.activityItem}>
              <div
                style={{
                  ...styles.activityIcon,
                  background: `${getActivityColor(activity.type)}20`,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={getActivityColor(activity.type)}
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div style={styles.activityContent}>
                <div style={styles.activityText}>{activity.text}</div>
                <div style={styles.activityTime}>{activity.time}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
