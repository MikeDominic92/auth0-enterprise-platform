import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MOCK_DATA } from '../shared/mock-data';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatIconModule],
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-2">
        <div>
          <h1 class="page-title">Users</h1>
          <p class="page-subtitle">Manage system access and permissions</p>
        </div>
        <div class="flex gap-3">
          <button class="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
            <mat-icon class="text-gray-500">upload</mat-icon> Import
          </button>
          <button class="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
            <mat-icon class="text-white">person_add</mat-icon> Invite User
          </button>
        </div>
      </div>

      <mat-card class="card-shadow rounded-xl border-none overflow-hidden">
        <table mat-table [dataSource]="users" class="w-full">
          
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef class="pl-6"> Name </th>
            <td mat-cell *matCellDef="let element" class="pl-6">
              <div class="flex flex-col">
                <span class="font-medium text-gray-900">{{element.name}}</span>
              </div>
            </td>
          </ng-container>

          <!-- Email Column -->
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef> Email </th>
            <td mat-cell *matCellDef="let element" class="text-gray-500"> {{element.email}} </td>
          </ng-container>

          <!-- Organization Column -->
          <ng-container matColumnDef="org">
            <th mat-header-cell *matHeaderCellDef> Organization </th>
            <td mat-cell *matCellDef="let element" class="text-gray-900"> {{element.org}} </td>
          </ng-container>

          <!-- Roles Column -->
          <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef> Roles </th>
            <td mat-cell *matCellDef="let element"> 
              <div class="flex gap-1">
                <span *ngFor="let role of element.roles" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                  {{role}}
                </span>
              </div>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> Status </th>
            <td mat-cell *matCellDef="let element"> 
              <span class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full" [ngClass]="element.status === 'Active' ? 'bg-green-500' : 'bg-gray-300'"></span>
                <span class="text-sm text-gray-700">{{element.status}}</span>
              </span>
            </td>
          </ng-container>

          <!-- Last Login Column -->
          <ng-container matColumnDef="lastLogin">
            <th mat-header-cell *matHeaderCellDef class="pr-6"> Last Login </th>
            <td mat-cell *matCellDef="let element" class="pr-6 text-gray-500 text-sm"> {{element.lastLogin}} </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"></tr>
        </table>
      </mat-card>
    </div>
  `
})
export class UsersComponent {
  users = MOCK_DATA.users;
  displayedColumns: string[] = ['name', 'email', 'org', 'roles', 'status', 'lastLogin'];
}
