# REST API Specification

## Overview

This document defines the REST API specification for the Enterprise Platform. It covers all endpoints for users, teams, audit, and compliance management, including request/response schemas, authentication requirements, and error handling.

---

## Table of Contents

1. [API Fundamentals](#api-fundamentals)
2. [Authentication](#authentication)
3. [Users API](#users-api)
4. [Teams API](#teams-api)
5. [Audit API](#audit-api)
6. [Compliance API](#compliance-api)
7. [Organizations API](#organizations-api)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Pagination](#pagination)

---

## API Fundamentals

### Base URL

```
Production: https://api.yourcompany.com/v1
Staging:    https://api.staging.yourcompany.com/v1
```

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token from Auth0 |
| `Content-Type` | Yes | `application/json` |
| `X-Organization-ID` | Yes* | Organization context (*required for org-scoped endpoints) |
| `X-Request-ID` | No | Client-generated request identifier for tracing |
| `X-Idempotency-Key` | No | Idempotency key for POST/PUT/PATCH requests |

### Response Format

All responses follow a consistent envelope format:

**Success Response:**

```json
{
  "success": true,
  "data": { },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

---

## Authentication

### Bearer Token Authentication

All API requests require a valid JWT access token from Auth0:

```http
GET /v1/users HTTP/1.1
Host: api.yourcompany.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Requirements

| Claim | Description |
|-------|-------------|
| `iss` | Must match Auth0 domain |
| `aud` | Must include API identifier |
| `exp` | Token must not be expired |
| `permissions` | Required scopes for the endpoint |
| `org_id` | Organization context (if applicable) |

### Required Scopes by Endpoint

| Endpoint | Required Scope |
|----------|----------------|
| `GET /users` | `read:users` |
| `POST /users` | `write:users` |
| `DELETE /users` | `delete:users` |
| `GET /teams` | `read:teams` |
| `POST /teams` | `write:teams` |
| `GET /audit` | `read:audit` |
| `GET /compliance` | `read:compliance` |
| `POST /compliance` | `write:compliance` |

---

## Users API

### List Users

Retrieve a paginated list of users in the organization.

```http
GET /v1/users
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page (max 100) |
| `sort` | string | `created_at` | Sort field |
| `order` | string | `desc` | Sort order (asc/desc) |
| `status` | string | - | Filter by status (active/inactive/pending) |
| `role` | string | - | Filter by role |
| `search` | string | - | Search by name or email |

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "usr_abc123",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "given_name": "John",
        "family_name": "Doe",
        "picture": "https://cdn.example.com/avatars/john.jpg",
        "status": "active",
        "roles": ["org_admin", "user"],
        "email_verified": true,
        "mfa_enabled": true,
        "last_login": "2025-01-14T15:30:00Z",
        "created_at": "2024-06-15T10:00:00Z",
        "updated_at": "2025-01-14T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total_pages": 5,
      "total_items": 95
    }
  }
}
```

### Get User

Retrieve a specific user by ID.

```http
GET /v1/users/{user_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | string | User identifier |

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "given_name": "John",
      "family_name": "Doe",
      "picture": "https://cdn.example.com/avatars/john.jpg",
      "status": "active",
      "roles": ["org_admin", "user"],
      "permissions": [
        "read:users",
        "write:users",
        "read:teams",
        "write:teams"
      ],
      "email_verified": true,
      "mfa_enabled": true,
      "mfa_methods": ["totp", "webauthn"],
      "metadata": {
        "department": "Engineering",
        "title": "Senior Developer",
        "employee_id": "EMP-12345"
      },
      "login_stats": {
        "total_logins": 245,
        "last_login": "2025-01-14T15:30:00Z",
        "last_login_ip": "192.168.1.100",
        "last_login_location": "San Francisco, CA"
      },
      "created_at": "2024-06-15T10:00:00Z",
      "updated_at": "2025-01-14T15:30:00Z"
    }
  }
}
```

### Create User

Create a new user in the organization.

```http
POST /v1/users
```

**Request Body:**

```json
{
  "email": "jane.smith@example.com",
  "name": "Jane Smith",
  "given_name": "Jane",
  "family_name": "Smith",
  "roles": ["user"],
  "metadata": {
    "department": "Marketing",
    "title": "Marketing Manager"
  },
  "send_invitation": true
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_def456",
      "email": "jane.smith@example.com",
      "name": "Jane Smith",
      "status": "pending",
      "invitation_sent": true,
      "created_at": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Update User

Update an existing user.

```http
PATCH /v1/users/{user_id}
```

**Request Body:**

```json
{
  "name": "Jane Smith-Johnson",
  "roles": ["user", "team_lead"],
  "metadata": {
    "department": "Marketing",
    "title": "Marketing Director"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_def456",
      "email": "jane.smith@example.com",
      "name": "Jane Smith-Johnson",
      "roles": ["user", "team_lead"],
      "updated_at": "2025-01-15T11:00:00Z"
    }
  }
}
```

### Delete User

Remove a user from the organization.

```http
DELETE /v1/users/{user_id}
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hard_delete` | boolean | false | Permanently delete (requires admin) |

**Response (204 No Content):** Empty body

### Bulk User Operations

Perform operations on multiple users.

```http
POST /v1/users/bulk
```

**Request Body:**

```json
{
  "operation": "update_roles",
  "user_ids": ["usr_abc123", "usr_def456", "usr_ghi789"],
  "data": {
    "roles": ["user"]
  }
}
```

**Supported Operations:**
- `update_roles` - Update roles for multiple users
- `deactivate` - Deactivate multiple users
- `activate` - Activate multiple users
- `delete` - Soft delete multiple users

**Response:**

```json
{
  "success": true,
  "data": {
    "processed": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      { "user_id": "usr_abc123", "status": "success" },
      { "user_id": "usr_def456", "status": "success" },
      { "user_id": "usr_ghi789", "status": "success" }
    ]
  }
}
```

---

## Teams API

### List Teams

Retrieve all teams in the organization.

```http
GET /v1/teams
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 20 | Items per page |
| `include_members` | boolean | false | Include member list |
| `search` | string | - | Search by team name |

**Response:**

```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "id": "team_abc123",
        "name": "Engineering",
        "description": "Core engineering team",
        "slug": "engineering",
        "member_count": 15,
        "visibility": "internal",
        "settings": {
          "allow_self_join": false,
          "require_approval": true
        },
        "created_at": "2024-03-01T10:00:00Z",
        "updated_at": "2025-01-10T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total_pages": 2,
      "total_items": 25
    }
  }
}
```

### Get Team

Retrieve a specific team with details.

```http
GET /v1/teams/{team_id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "team": {
      "id": "team_abc123",
      "name": "Engineering",
      "description": "Core engineering team responsible for platform development",
      "slug": "engineering",
      "visibility": "internal",
      "members": [
        {
          "user_id": "usr_abc123",
          "email": "john.doe@example.com",
          "name": "John Doe",
          "role": "owner",
          "joined_at": "2024-03-01T10:00:00Z"
        },
        {
          "user_id": "usr_def456",
          "email": "jane.smith@example.com",
          "name": "Jane Smith",
          "role": "member",
          "joined_at": "2024-03-15T09:00:00Z"
        }
      ],
      "member_count": 15,
      "settings": {
        "allow_self_join": false,
        "require_approval": true,
        "default_member_role": "member"
      },
      "permissions": {
        "can_manage_members": true,
        "can_edit_settings": true,
        "can_delete": false
      },
      "created_by": {
        "user_id": "usr_abc123",
        "name": "John Doe"
      },
      "created_at": "2024-03-01T10:00:00Z",
      "updated_at": "2025-01-10T14:30:00Z"
    }
  }
}
```

### Create Team

Create a new team.

```http
POST /v1/teams
```

**Request Body:**

```json
{
  "name": "Data Science",
  "description": "Data science and machine learning team",
  "visibility": "internal",
  "settings": {
    "allow_self_join": false,
    "require_approval": true
  },
  "initial_members": [
    { "user_id": "usr_abc123", "role": "owner" },
    { "user_id": "usr_def456", "role": "member" }
  ]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "team": {
      "id": "team_xyz789",
      "name": "Data Science",
      "slug": "data-science",
      "created_at": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Update Team

Update team details.

```http
PATCH /v1/teams/{team_id}
```

**Request Body:**

```json
{
  "description": "Data science, ML, and AI team",
  "settings": {
    "allow_self_join": true
  }
}
```

### Delete Team

Delete a team.

```http
DELETE /v1/teams/{team_id}
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reassign_to` | string | - | Team ID to reassign members to |

### Team Membership

**Add Members:**

```http
POST /v1/teams/{team_id}/members
```

```json
{
  "members": [
    { "user_id": "usr_ghi789", "role": "member" },
    { "user_id": "usr_jkl012", "role": "admin" }
  ]
}
```

**Remove Member:**

```http
DELETE /v1/teams/{team_id}/members/{user_id}
```

**Update Member Role:**

```http
PATCH /v1/teams/{team_id}/members/{user_id}
```

```json
{
  "role": "admin"
}
```

---

## Audit API

### Query Audit Logs

Retrieve audit log entries with filtering.

```http
GET /v1/audit/logs
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 50 | Items per page (max 200) |
| `start_date` | string | 7 days ago | Start date (ISO 8601) |
| `end_date` | string | now | End date (ISO 8601) |
| `actor_id` | string | - | Filter by user who performed action |
| `resource_type` | string | - | Filter by resource type |
| `action` | string | - | Filter by action type |
| `outcome` | string | - | Filter by outcome (success/failure) |

**Response:**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "audit_abc123",
        "timestamp": "2025-01-15T10:30:00Z",
        "actor": {
          "id": "usr_abc123",
          "email": "john.doe@example.com",
          "name": "John Doe",
          "ip_address": "192.168.1.100",
          "user_agent": "Mozilla/5.0..."
        },
        "action": "user.create",
        "resource": {
          "type": "user",
          "id": "usr_def456",
          "name": "Jane Smith"
        },
        "outcome": "success",
        "changes": {
          "before": null,
          "after": {
            "email": "jane.smith@example.com",
            "roles": ["user"]
          }
        },
        "metadata": {
          "organization_id": "org_xyz789",
          "request_id": "req_123456"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 50,
      "total_pages": 10,
      "total_items": 487
    }
  }
}
```

### Get Audit Log Entry

Retrieve a specific audit log entry.

```http
GET /v1/audit/logs/{log_id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "audit_abc123",
      "timestamp": "2025-01-15T10:30:00Z",
      "actor": {
        "id": "usr_abc123",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "location": {
          "country": "US",
          "city": "San Francisco",
          "coordinates": {
            "lat": 37.7749,
            "lng": -122.4194
          }
        }
      },
      "action": "user.update",
      "resource": {
        "type": "user",
        "id": "usr_def456",
        "name": "Jane Smith"
      },
      "outcome": "success",
      "changes": {
        "before": {
          "roles": ["user"]
        },
        "after": {
          "roles": ["user", "admin"]
        }
      },
      "metadata": {
        "organization_id": "org_xyz789",
        "request_id": "req_123456",
        "correlation_id": "corr_789012"
      }
    }
  }
}
```

### Export Audit Logs

Export audit logs for compliance reporting.

```http
POST /v1/audit/export
```

**Request Body:**

```json
{
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z",
  "format": "csv",
  "filters": {
    "resource_types": ["user", "team"],
    "actions": ["create", "update", "delete"]
  },
  "delivery": {
    "method": "email",
    "recipients": ["compliance@example.com"]
  }
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "export_id": "export_abc123",
    "status": "processing",
    "estimated_completion": "2025-01-15T11:00:00Z"
  }
}
```

### Audit Actions Reference

| Action | Description |
|--------|-------------|
| `user.create` | User account created |
| `user.update` | User profile updated |
| `user.delete` | User account deleted |
| `user.login` | User logged in |
| `user.logout` | User logged out |
| `user.login_failed` | Failed login attempt |
| `user.password_change` | Password changed |
| `user.mfa_enable` | MFA enabled |
| `user.mfa_disable` | MFA disabled |
| `team.create` | Team created |
| `team.update` | Team updated |
| `team.delete` | Team deleted |
| `team.member_add` | Member added to team |
| `team.member_remove` | Member removed from team |
| `role.assign` | Role assigned to user |
| `role.revoke` | Role revoked from user |
| `permission.grant` | Permission granted |
| `permission.revoke` | Permission revoked |
| `compliance.report_generate` | Compliance report generated |
| `compliance.evidence_upload` | Evidence document uploaded |

---

## Compliance API

### Get Compliance Status

Retrieve overall compliance status.

```http
GET /v1/compliance/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "compliance_status": {
      "overall_score": 94,
      "status": "compliant",
      "last_assessment": "2025-01-10T00:00:00Z",
      "next_assessment": "2025-04-10T00:00:00Z",
      "frameworks": [
        {
          "name": "SOC 2 Type II",
          "status": "compliant",
          "score": 96,
          "controls_met": 145,
          "controls_total": 150,
          "last_audit": "2024-12-15T00:00:00Z",
          "certificate_expires": "2025-12-15T00:00:00Z"
        },
        {
          "name": "HIPAA",
          "status": "compliant",
          "score": 92,
          "controls_met": 42,
          "controls_total": 45,
          "last_audit": "2024-11-01T00:00:00Z"
        },
        {
          "name": "GDPR",
          "status": "compliant",
          "score": 95,
          "controls_met": 87,
          "controls_total": 91,
          "last_audit": "2024-10-20T00:00:00Z"
        }
      ],
      "pending_actions": [
        {
          "id": "action_123",
          "priority": "medium",
          "description": "Update data retention policy documentation",
          "due_date": "2025-02-01T00:00:00Z",
          "framework": "SOC 2"
        }
      ]
    }
  }
}
```

### Get Framework Requirements

Retrieve requirements for a specific compliance framework.

```http
GET /v1/compliance/frameworks/{framework_id}/requirements
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `framework_id` | string | Framework identifier (soc2, hipaa, gdpr) |

**Response:**

```json
{
  "success": true,
  "data": {
    "framework": {
      "id": "soc2",
      "name": "SOC 2 Type II",
      "version": "2023",
      "categories": [
        {
          "id": "security",
          "name": "Security",
          "description": "Protection of data and systems",
          "requirements": [
            {
              "id": "CC6.1",
              "title": "Logical and Physical Access Controls",
              "description": "The entity implements logical access security software, infrastructure, and architectures over protected information assets",
              "status": "met",
              "evidence_count": 5,
              "controls": [
                {
                  "id": "ctrl_001",
                  "name": "Multi-Factor Authentication",
                  "status": "implemented",
                  "automated": true,
                  "last_tested": "2025-01-10T00:00:00Z"
                },
                {
                  "id": "ctrl_002",
                  "name": "Role-Based Access Control",
                  "status": "implemented",
                  "automated": true,
                  "last_tested": "2025-01-10T00:00:00Z"
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

### Submit Compliance Evidence

Upload evidence for a compliance control.

```http
POST /v1/compliance/evidence
```

**Request Body (multipart/form-data):**

```
framework_id: soc2
requirement_id: CC6.1
control_id: ctrl_001
description: MFA enrollment report for Q4 2024
file: [binary data]
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "evidence": {
      "id": "evd_abc123",
      "framework_id": "soc2",
      "requirement_id": "CC6.1",
      "control_id": "ctrl_001",
      "description": "MFA enrollment report for Q4 2024",
      "file_name": "mfa_report_q4_2024.pdf",
      "file_size": 245678,
      "uploaded_by": {
        "user_id": "usr_abc123",
        "name": "John Doe"
      },
      "uploaded_at": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Generate Compliance Report

Generate a compliance report.

```http
POST /v1/compliance/reports
```

**Request Body:**

```json
{
  "framework_id": "soc2",
  "report_type": "executive_summary",
  "period": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "include_sections": [
    "overview",
    "controls_status",
    "findings",
    "remediation_status"
  ],
  "format": "pdf"
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "report_id": "rpt_xyz789",
    "status": "generating",
    "estimated_completion": "2025-01-15T10:45:00Z"
  }
}
```

### Get Report Status

```http
GET /v1/compliance/reports/{report_id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "rpt_xyz789",
      "status": "completed",
      "framework_id": "soc2",
      "report_type": "executive_summary",
      "generated_at": "2025-01-15T10:42:00Z",
      "download_url": "https://api.yourcompany.com/v1/compliance/reports/rpt_xyz789/download",
      "expires_at": "2025-01-22T10:42:00Z"
    }
  }
}
```

---

## Organizations API

### List Organizations

Retrieve organizations (platform admin only).

```http
GET /v1/organizations
```

**Response:**

```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "id": "org_abc123",
        "name": "Acme Corporation",
        "display_name": "Acme Corp",
        "slug": "acme",
        "status": "active",
        "tier": "enterprise",
        "member_count": 150,
        "created_at": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

### Get Organization

```http
GET /v1/organizations/{org_id}
```

### Create Organization

```http
POST /v1/organizations
```

**Request Body:**

```json
{
  "name": "New Company Inc",
  "display_name": "New Company",
  "tier": "professional",
  "settings": {
    "allowed_connections": ["enterprise-db"],
    "mfa_policy": "required"
  },
  "admin": {
    "email": "admin@newcompany.com",
    "name": "Admin User"
  }
}
```

### Update Organization

```http
PATCH /v1/organizations/{org_id}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": [],
    "documentation_url": "https://docs.yourcompany.com/errors/ERROR_CODE"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `INVALID_REQUEST` | Malformed request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 401 | `TOKEN_EXPIRED` | Access token has expired |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `ORG_ACCESS_DENIED` | No access to organization |
| 404 | `NOT_FOUND` | Resource not found |
| 404 | `USER_NOT_FOUND` | User does not exist |
| 404 | `TEAM_NOT_FOUND` | Team does not exist |
| 409 | `CONFLICT` | Resource conflict |
| 409 | `USER_EXISTS` | User already exists |
| 409 | `TEAM_NAME_EXISTS` | Team name already taken |
| 422 | `UNPROCESSABLE_ENTITY` | Semantic validation error |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Internal server error |
| 502 | `BAD_GATEWAY` | Upstream service error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

### Validation Error Details

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "code": "invalid_format",
        "message": "Must be a valid email address"
      },
      {
        "field": "roles",
        "code": "invalid_value",
        "message": "Role 'super_admin' is not allowed"
      }
    ]
  }
}
```

---

## Rate Limiting

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705320000
```

### Rate Limits by Tier

| Tier | Requests/Minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Professional | 300 | 50 |
| Enterprise | 1000 | 200 |

### Rate Limit Response

When rate limited, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705320060
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "retry_after": 60
    }
  }
}
```

---

## Pagination

### Cursor-Based Pagination (Recommended)

For large datasets, use cursor-based pagination:

```http
GET /v1/audit/logs?limit=100&cursor=eyJpZCI6ImF1ZGl0XzEyMyJ9
```

**Response:**

```json
{
  "success": true,
  "data": {
    "logs": [...],
    "pagination": {
      "has_more": true,
      "next_cursor": "eyJpZCI6ImF1ZGl0XzQ1NiJ9",
      "prev_cursor": "eyJpZCI6ImF1ZGl0XzEyMyJ9"
    }
  }
}
```

### Offset-Based Pagination

For smaller datasets:

```http
GET /v1/users?page=2&per_page=20
```

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 2,
      "per_page": 20,
      "total_pages": 5,
      "total_items": 95,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

---

## Appendix: HTTP Status Code Summary

| Status | Meaning | When Used |
|--------|---------|-----------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST creating resource |
| 202 | Accepted | Async operation started |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Semantic error |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Server error |

---

*Document Version: 1.0*
*Last Updated: 2025-01*
