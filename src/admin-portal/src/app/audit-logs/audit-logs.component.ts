import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MOCK_DATA } from '../shared/mock-data';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule
  ],
  template: `
    <div class="flex flex-col gap-6">
       <!-- Header -->
        <div class="flex items-center justify-between mb-2">
            <div>
                <h1 class="page-title">Audit Logs</h1>
                <p class="page-subtitle">Track security events and administrative actions</p>
            </div>
            <button mat-stroked-button color="primary" class="flex items-center gap-2">
                <mat-icon>download</mat-icon> Export CSV
            </button>
        </div>

      <!-- Filters -->
      <mat-card class="card-shadow rounded-xl border-none p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
             <mat-form-field appearance="outline" class="w-full">
                <mat-label>Date Range</mat-label>
                <mat-date-range-input [rangePicker]="picker">
                <input matStartDate placeholder="Start date">
                <input matEndDate placeholder="End date">
                </mat-date-range-input>
                <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-date-range-picker #picker></mat-date-range-picker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
                <mat-label>Event Type</mat-label>
                <mat-select>
                    <mat-option value="login">Login Success</mat-option>
                    <mat-option value="failed">Login Failed</mat-option>
                    <mat-option value="admin">Admin Action</mat-option>
                </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
                <mat-label>Organization</mat-label>
                <mat-select>
                    <mat-option value="acme">Acme Corporation</mat-option>
                    <mat-option value="tech">Tech Startup</mat-option>
                </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
                <mat-label>Search Actor or IP</mat-label>
                <mat-icon matPrefix class="text-gray-400 mr-2">search</mat-icon>
                <input matInput placeholder="e.g. 192.168.1.1">
            </mat-form-field>
        </div>
      </mat-card>

      <!-- Table -->
      <mat-card class="card-shadow rounded-xl border-none overflow-hidden">
        <table mat-table [dataSource]="logs" class="w-full">
          
          <!-- Timestamp Column -->
          <ng-container matColumnDef="timestamp">
            <th mat-header-cell *matHeaderCellDef class="pl-6"> Timestamp </th>
            <td mat-cell *matCellDef="let element" class="pl-6 text-sm text-gray-600 font-mono"> {{element.timestamp}} </td>
          </ng-container>

          <!-- Event Type Column -->
          <ng-container matColumnDef="event">
            <th mat-header-cell *matHeaderCellDef> Event Type </th>
            <td mat-cell *matCellDef="let element" class="font-medium text-gray-900"> {{element.event}} </td>
          </ng-container>

          <!-- Actor Column -->
          <ng-container matColumnDef="actor">
            <th mat-header-cell *matHeaderCellDef> Actor </th>
            <td mat-cell *matCellDef="let element" class="text-gray-600"> {{element.user}} </td>
          </ng-container>

            <!-- Org Column -->
            <ng-container matColumnDef="org">
            <th mat-header-cell *matHeaderCellDef> Organization </th>
            <td mat-cell *matCellDef="let element" class="text-gray-600"> {{element.org}} </td>
          </ng-container>


          <!-- IP Address Column (Mock) -->
          <ng-container matColumnDef="ip">
            <th mat-header-cell *matHeaderCellDef> IP Address </th>
            <td mat-cell *matCellDef="let element" class="text-gray-500 text-sm font-mono"> 192.168.1.{{ [10, 24, 55, 99][0] }} </td>
          </ng-container>

           <!-- Details Column (Mock) -->
           <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef class="pr-6"> Details </th>
            <td mat-cell *matCellDef="let element" class="pr-6 text-gray-500 text-sm truncate max-w-xs"> 
                User agent: Mozilla/5.0...
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"></tr>
        </table>
      </mat-card>
    </div>
  `
})
export class AuditLogsComponent {
  // Reusing recentEvents and adding mock fields in template for simplicity
  logs = MOCK_DATA.recentEvents;
  displayedColumns: string[] = ['timestamp', 'event', 'actor', 'org', 'ip', 'details'];
}
