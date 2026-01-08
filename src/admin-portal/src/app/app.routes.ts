import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { OrganizationsComponent } from './organizations/organizations.component';
import { UsersComponent } from './users/users.component';
import { AuditLogsComponent } from './audit-logs/audit-logs.component';
import { ComplianceComponent } from './compliance/compliance.component';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'organizations', component: OrganizationsComponent },
    { path: 'users', component: UsersComponent },
    { path: 'audit-logs', component: AuditLogsComponent },
    { path: 'compliance', component: ComplianceComponent },
];
