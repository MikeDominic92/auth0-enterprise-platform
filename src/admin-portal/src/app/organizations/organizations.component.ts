import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MOCK_DATA } from '../shared/mock-data';

@Component({
    selector: 'app-organizations',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatTableModule, MatIconModule],
    template: `
    <div class="flex flex-col gap-6">
       <!-- Header -->
       <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">Organizations</h1>
        <button class="bg-primary hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <mat-icon class="text-white">add</mat-icon> Create Organization
        </button>
      </div>

      <mat-card class="card-shadow rounded-xl border-none overflow-hidden">
        <table mat-table [dataSource]="organizations" class="w-full">
          
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 pl-6"> Name </th>
            <td mat-cell *matCellDef="let element" class="pl-6 py-4 font-mono text-xs text-gray-600"> {{element.name}} </td>
          </ng-container>

          <!-- Display Name Column -->
          <ng-container matColumnDef="displayName">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Display Name </th>
            <td mat-cell *matCellDef="let element" class="py-4 font-medium text-gray-900"> {{element.displayName}} </td>
          </ng-container>

          <!-- Tier Column -->
          <ng-container matColumnDef="tier">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Tier </th>
            <td mat-cell *matCellDef="let element" class="py-4"> 
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    [ngClass]="{
                      'bg-green-100 text-green-800': element.tierColor === 'success',
                      'bg-blue-100 text-blue-800': element.tierColor === 'info',
                      'bg-purple-100 text-purple-800': element.tierColor === 'primary',
                      'bg-gray-100 text-gray-800': !element.tierColor
                    }">
                {{element.tier}}
              </span>
            </td>
          </ng-container>

          <!-- Members Column -->
          <ng-container matColumnDef="members">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Members </th>
            <td mat-cell *matCellDef="let element" class="py-4 text-gray-600 flex items-center gap-1"> 
               <mat-icon class="text-gray-400 text-sm h-4 w-4">person</mat-icon> {{element.members}} 
            </td>
          </ng-container>

          <!-- Created Column -->
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 pr-6"> Created </th>
            <td mat-cell *matCellDef="let element" class="py-4 pr-6 text-gray-500 text-sm"> {{element.created}} </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"></tr>
        </table>
      </mat-card>
    </div>
  `
})
export class OrganizationsComponent {
    organizations = MOCK_DATA.organizations;
    displayedColumns: string[] = ['name', 'displayName', 'tier', 'members', 'created'];
}
