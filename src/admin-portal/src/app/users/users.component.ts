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
       <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">Users</h1>
        <button class="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <mat-icon class="text-white">person_add</mat-icon> Add User
        </button>
      </div>

      <mat-card class="card-shadow rounded-xl border-none overflow-hidden">
        <table mat-table [dataSource]="users" class="w-full">
          
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 pl-6"> Name </th>
            <td mat-cell *matCellDef="let element" class="pl-6 py-4"> 
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                  {{element.name.charAt(0)}}
                </div>
                <div class="font-medium text-gray-900">{{element.name}}</div>
              </div>
            </td>
          </ng-container>

          <!-- Email Column -->
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Email </th>
            <td mat-cell *matCellDef="let element" class="py-4 text-gray-600"> {{element.email}} </td>
          </ng-container>

          <!-- Organization Column -->
          <ng-container matColumnDef="org">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Organization </th>
            <td mat-cell *matCellDef="let element" class="py-4 text-gray-600"> {{element.org}} </td>
          </ng-container>

           <!-- Roles Column -->
           <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Roles </th>
            <td mat-cell *matCellDef="let element" class="py-4"> 
              <div class="flex gap-1">
                 <span *ngFor="let role of element.roles" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                  {{role}}
                </span>
              </div>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Status </th>
             <td mat-cell *matCellDef="let element" class="py-4"> 
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> {{element.status}}
              </span>
            </td>
          </ng-container>

          <!-- Last Login Column -->
          <ng-container matColumnDef="lastLogin">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 pr-6"> Last Login </th>
            <td mat-cell *matCellDef="let element" class="py-4 pr-6 text-gray-500 text-sm"> {{element.lastLogin}} </td>
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
