import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MOCK_DATA } from '../shared/mock-data';

@Component({
    selector: 'app-compliance',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule
    ],
    template: `
    <div class="flex flex-col gap-8">
      <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-gray-900">Compliance Center</h1>
            <div class="text-sm text-gray-500">Last report generated: <span class="text-gray-900 font-medium">2 days ago</span></div>
      </div>

      <!-- Generate Report Section -->
       <mat-card class="card-shadow rounded-xl border-none p-8 bg-white">
        <h2 class="text-lg font-bold text-gray-900 mb-6">Generate New Report</h2>
        
        <div class="flex flex-col gap-6">
            <!-- Framework Selection -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Select Framework</label>
                <div class="flex gap-4">
                    <button mat-stroked-button class="h-12 border-primary text-primary bg-orange-50 font-bold">SOC 2 Type II</button>
                    <button mat-stroked-button class="h-12">HIPAA</button>
                    <button mat-stroked-button class="h-12">GDPR</button>
                    <button mat-stroked-button class="h-12">ISO 27001</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Target Organization</mat-label>
                    <mat-select value="acme">
                        <mat-option value="acme">Acme Corporation</mat-option>
                        <mat-option value="tech">Tech Startup</mat-option>
                    </mat-select>
                </mat-form-field>

                 <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Report Period</mat-label>
                     <mat-date-range-input [rangePicker]="picker">
                        <input matStartDate placeholder="Start date">
                        <input matEndDate placeholder="End date">
                    </mat-date-range-input>
                    <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                    <mat-date-range-picker #picker></mat-date-range-picker>
                </mat-form-field>

                <div class="flex items-center">
                    <button mat-flat-button color="primary" class="h-14 w-full text-base font-bold rounded-lg shadow-lg shadow-orange-200">
                        <mat-icon class="mr-2">assessment</mat-icon> Generate Report
                    </button>
                </div>
            </div>
        </div>
      </mat-card>

      <!-- Previous Reports -->
      <div>
        <h2 class="text-lg font-bold text-gray-900 mb-4 ml-1">Previous Reports</h2>
        <mat-card class="card-shadow rounded-xl border-none overflow-hidden">
            <table mat-table [dataSource]="reports" class="w-full">
            
            <!-- Report ID Column -->
            <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 pl-6"> Report ID </th>
                <td mat-cell *matCellDef="let element" class="pl-6 py-4 font-mono text-sm text-primary font-medium"> {{element.id}} </td>
            </ng-container>

            <!-- Framework Column -->
            <ng-container matColumnDef="framework">
                <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Framework </th>
                <td mat-cell *matCellDef="let element" class="py-4 font-bold text-gray-700"> {{element.framework}} </td>
            </ng-container>

            <!-- Organization Column -->
            <ng-container matColumnDef="org">
                <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Organization </th>
                <td mat-cell *matCellDef="let element" class="py-4 text-gray-600"> {{element.org}} </td>
            </ng-container>

            <!-- Period Column -->
            <ng-container matColumnDef="period">
                <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Period </th>
                <td mat-cell *matCellDef="let element" class="py-4 text-gray-500"> {{element.period}} </td>
            </ng-container>

             <!-- Score Column -->
             <ng-container matColumnDef="score">
                <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4"> Score </th>
                <td mat-cell *matCellDef="let element" class="py-4 font-bold" [ngClass]="{'text-green-600': element.color === 'success', 'text-yellow-600': element.color === 'warning'}"> 
                    {{element.score}} 
                </td>
            </ng-container>

             <!-- Status Column -->
             <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 pr-6"> Status </th>
                <td mat-cell *matCellDef="let element" class="py-4 pr-6"> 
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {{element.status}}
                    </span>
                </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"></tr>
            </table>
        </mat-card>
      </div>
    </div>
  `
})
export class ComplianceComponent {
    reports = MOCK_DATA.complianceReports;
    displayedColumns: string[] = ['id', 'framework', 'org', 'period', 'score', 'status'];
}
