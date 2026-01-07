import React, { useState } from 'react';

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
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #635bff 0%, #7c3aed 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  searchBar: {
    display: 'flex',
    gap: 16,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    maxWidth: 400,
    padding: '10px 16px',
    paddingLeft: 40,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    background: '#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'M21 21l-4.35-4.35\'/%3E%3C/svg%3E") no-repeat 12px center',
  },
  teamsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 24,
  },
  teamCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  teamCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  },
  teamHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    padding: 4,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    color: '#9ca3af',
  },
  teamName: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 4,
  },
  teamDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 1.5,
  },
  teamStats: {
    display: 'flex',
    gap: 24,
    paddingTop: 16,
    borderTop: '1px solid #f3f4f6',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  memberAvatars: {
    display: 'flex',
    marginTop: 16,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid #fff',
    marginLeft: -8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
  },
  moreMembers: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid #fff',
    marginLeft: -8,
    background: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '80px 20px',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    margin: '0 auto 16px',
    color: '#d1d5db',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
};

// Mock team data
const mockTeams = [
  {
    id: 1,
    name: 'Engineering',
    description: 'Core product development and infrastructure team responsible for building and maintaining the platform.',
    members: 24,
    projects: 8,
    color: '#635bff',
    memberAvatars: ['JD', 'SW', 'MJ', 'EB', 'DL'],
  },
  {
    id: 2,
    name: 'Marketing',
    description: 'Brand strategy, content creation, and growth marketing initiatives.',
    members: 12,
    projects: 5,
    color: '#f59e0b',
    memberAvatars: ['LC', 'RT', 'AM'],
  },
  {
    id: 3,
    name: 'Sales',
    description: 'Revenue generation and customer acquisition across all segments.',
    members: 18,
    projects: 3,
    color: '#22c55e',
    memberAvatars: ['JD', 'SW', 'MJ', 'EB'],
  },
  {
    id: 4,
    name: 'Product',
    description: 'Product strategy, roadmap planning, and feature prioritization.',
    members: 8,
    projects: 4,
    color: '#ec4899',
    memberAvatars: ['AM', 'LC'],
  },
  {
    id: 5,
    name: 'Customer Success',
    description: 'Customer onboarding, support, and retention programs.',
    members: 15,
    projects: 6,
    color: '#06b6d4',
    memberAvatars: ['RT', 'JD', 'SW', 'MJ', 'EB', 'DL'],
  },
  {
    id: 6,
    name: 'Operations',
    description: 'Business operations, finance, and administrative functions.',
    members: 10,
    projects: 2,
    color: '#8b5cf6',
    memberAvatars: ['LC', 'AM'],
  },
];

const Teams = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null);

  const filteredTeams = mockTeams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAvatarColors = (index) => {
    const colors = ['#635bff', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
    return colors[index % colors.length];
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Teams</h1>
          <p style={styles.subtitle}>
            Organize users into teams for better access control and collaboration
          </p>
        </div>
        <button
          style={styles.primaryButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 91, 255, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Team
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Search teams..."
          style={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Teams Grid */}
      <div style={styles.teamsGrid}>
        {filteredTeams.length > 0 ? (
          filteredTeams.map((team) => (
            <div
              key={team.id}
              style={{
                ...styles.teamCard,
                ...(hoveredCard === team.id ? styles.teamCardHover : {}),
              }}
              onMouseEnter={() => setHoveredCard(team.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={styles.teamHeader}>
                <div style={{ ...styles.teamIcon, background: `${team.color}20` }}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={team.color}
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <button style={styles.menuButton}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
              </div>

              <h3 style={styles.teamName}>{team.name}</h3>
              <p style={styles.teamDescription}>{team.description}</p>

              {/* Member Avatars */}
              <div style={styles.memberAvatars}>
                {team.memberAvatars.slice(0, 4).map((initials, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.memberAvatar,
                      background: getAvatarColors(index),
                      marginLeft: index === 0 ? 0 : -8,
                    }}
                  >
                    {initials}
                  </div>
                ))}
                {team.members > 4 && (
                  <div style={styles.moreMembers}>+{team.members - 4}</div>
                )}
              </div>

              <div style={styles.teamStats}>
                <div style={styles.statItem}>
                  <span style={styles.statValue}>{team.members}</span>
                  <span style={styles.statLabel}>Members</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statValue}>{team.projects}</span>
                  <span style={styles.statLabel}>Projects</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={styles.emptyState}>
            <svg
              style={styles.emptyIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <circle cx="19" cy="11" r="2" />
              <path d="M19 8v6" />
              <path d="M16 11h6" />
            </svg>
            <h3 style={styles.emptyTitle}>No teams found</h3>
            <p style={styles.emptyText}>
              {searchQuery
                ? 'Try adjusting your search terms.'
                : 'Get started by creating your first team.'}
            </p>
            <button
              style={styles.primaryButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 91, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Teams;
