import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MOCK_DATA } from '../shared/mock-data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTableModule],
  template: `
    <div class="flex flex-col gap-8">
      <!-- Welcome Message -->
      <div>
        <h1 class="page-title">Welcome back, Administrator</h1>
        <p class="page-subtitle">Here's what's happening in your organization today.</p>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <mat-card *ngFor="let stat of stats" class="card-shadow rounded-xl border-none transition-transform hover:-translate-y-1 duration-300">
          <mat-card-content class="p-6 flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500 mb-1">{{stat.label}}</p>
              <h3 class="text-3xl font-bold text-gray-900">{{stat.value}}</h3>
            </div>
            <div class="p-3 bg-orange-50 rounded-lg text-primary">
              <mat-icon>{{stat.icon}}</mat-icon>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Recent Events -->
      <mat-card class="card-shadow rounded-xl border-none overflow-hidden">
        <mat-card-header class="p-6 border-b border-gray-100 bg-white">
          <mat-card-title class="text-lg font-bold text-gray-900">Recent Events</mat-card-title>
        </mat-card-header>
        <mat-card-content class="p-0">
          <table mat-table [dataSource]="recentEvents" class="w-full">
            
            <!-- Timestamp Column -->
            <ng-container matColumnDef="timestamp">
              <th mat-header-cell *matHeaderCellDef class="pl-6"> Timestamp </th>
              <td mat-cell *matCellDef="let element" class="pl-6 text-gray-600"> {{element.timestamp}} </td>
            </ng-container>

            <!-- User Column -->
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef> User </th>
              <td mat-cell *matCellDef="let element" class="font-medium text-gray-900"> {{element.user}} </td>
            </ng-container>

            <!-- Event Column -->
            <ng-container matColumnDef="event">
              <th mat-header-cell *matHeaderCellDef> Event </th>
              <td mat-cell *matCellDef="let element" class="text-gray-700"> {{element.event}} </td>
            </ng-container>

            <!-- Organization Column -->
            <ng-container matColumnDef="org">
              <th mat-header-cell *matHeaderCellDef> Organization </th>
              <td mat-cell *matCellDef="let element" class="text-gray-600"> {{element.org}} </td>
            </ng-container>

             <!-- Status Column -->
             <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="pr-6"> Status </th>
              <td mat-cell *matCellDef="let element" class="pr-6"> 
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                      [ngClass]="{
                        'bg-green-100 text-green-800': element.status === 'success',
                        'bg-red-100 text-red-800': element.status === 'error',
                        'bg-blue-100 text-blue-800': element.status === 'info',
                        'bg-yellow-100 text-yellow-800': element.status === 'warning'
                      }">
                  {{element.status}}
                </span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class DashboardComponent {
  stats = MOCK_DATA.stats;
  recentEvents = MOCK_DATA.recentEvents;
  displayedColumns: string[] = ['timestamp', 'user', 'event', 'org', 'status'];
}
