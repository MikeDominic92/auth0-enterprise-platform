import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    AsyncPipe
  ],
  template: `
    <div class="flex h-screen bg-background flex-col md:flex-row">
      <!-- Sidebar -->
      <mat-sidenav-container class="w-full h-full bg-background" autosize>
        <mat-sidenav #drawer 
          class="w-64 border-r border-gray-200 bg-white" 
          [attr.role]="(isHandset$ | async) ? 'dialog' : 'navigation'"
          [mode]="(isHandset$ | async) ? 'over' : 'side'"
          [opened]="(isHandset$ | async) === false">
          
          <div class="h-16 flex items-center px-6 border-b border-gray-100">
            <span class="text-primary font-bold text-xl flex items-center gap-2">
              <mat-icon class="text-primary">verified_user</mat-icon> Auth0 Enterprise
            </span>
          </div>
          
          <mat-nav-list class="pt-4">
            <a mat-list-item routerLink="/dashboard" routerLinkActive="text-primary bg-orange-50" (click)="isHandset$ && drawer.close()" class="hover:bg-gray-50 rounded-r-full mr-4 mb-1">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            <a mat-list-item routerLink="/organizations" routerLinkActive="text-primary bg-orange-50" (click)="isHandset$ && drawer.close()" class="hover:bg-gray-50 rounded-r-full mr-4 mb-1">
              <mat-icon matListItemIcon>business</mat-icon>
              <span matListItemTitle>Organizations</span>
            </a>
            <a mat-list-item routerLink="/users" routerLinkActive="text-primary bg-orange-50" (click)="isHandset$ && drawer.close()" class="hover:bg-gray-50 rounded-r-full mr-4 mb-1">
              <mat-icon matListItemIcon>people</mat-icon>
              <span matListItemTitle>Users</span>
            </a>
            <a mat-list-item routerLink="/audit-logs" routerLinkActive="text-primary bg-orange-50" (click)="isHandset$ && drawer.close()" class="hover:bg-gray-50 rounded-r-full mr-4 mb-1">
              <mat-icon matListItemIcon>list_alt</mat-icon>
              <span matListItemTitle>Audit Logs</span>
            </a>
            <a mat-list-item routerLink="/compliance" routerLinkActive="text-primary bg-orange-50" (click)="isHandset$ && drawer.close()" class="hover:bg-gray-50 rounded-r-full mr-4 mb-1">
              <mat-icon matListItemIcon>shield</mat-icon>
              <span matListItemTitle>Compliance</span>
            </a>
          </mat-nav-list>

          <div class="absolute bottom-0 w-full p-4 border-t border-gray-100">
             <a mat-list-item class="hover:bg-gray-50 rounded mb-1 cursor-pointer">
              <mat-icon matListItemIcon class="text-gray-500">settings</mat-icon>
              <span matListItemTitle class="text-gray-600">Settings</span>
            </a>
          </div>
        </mat-sidenav>

        <mat-sidenav-content class="bg-background flex flex-col h-full">
          <!-- Header -->
          <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shadow-sm z-10 sticky top-0">
            <div class="flex items-center text-sm text-gray-500 gap-2">
               <!-- Toggle Button (Mobile Only) -->
              <button
                type="button"
                aria-label="Toggle sidenav"
                mat-icon-button
                (click)="drawer.toggle()"
                *ngIf="isHandset$ | async">
                <mat-icon aria-label="Side nav toggle icon">menu</mat-icon>
              </button>

              <span class="font-medium text-gray-900 hidden md:inline">Dashboard</span>
              <mat-icon class="text-lg mx-2 h-5 w-5 hidden md:inline">chevron_right</mat-icon>
              <span class="font-semibold text-gray-900">Overview</span>
            </div>

            <div class="flex items-center gap-2 md:gap-4">
              <div class="relative hidden md:block">
                <mat-icon class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">search</mat-icon>
                <input type="text" placeholder="Search..." class="pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary focus:bg-white transition-all w-64">
              </div>
              
              <button mat-icon-button class="text-gray-500 relative">
                <mat-icon>notifications</mat-icon>
                <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <button mat-button [matMenuTriggerFor]="userMenu" class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">PA</div>
                <div class="text-left hidden md:block leading-tight">
                  <div class="text-sm font-medium">Platform Admin</div>
                  <div class="text-xs text-gray-500">admin&#64;auth0.com</div>
                </div>
                <mat-icon>arrow_drop_down</mat-icon>
              </button>
              <mat-menu #userMenu="matMenu">
                <button mat-menu-item>Profile</button>
                <button mat-menu-item>Sign Out</button>
              </mat-menu>
            </div>
          </header>

          <!-- Main Content -->
          <main class="flex-1 overflow-auto p-4 md:p-8">
            <router-outlet></router-outlet>
          </main>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `]
})
export class AppComponent {
  title = 'auth0-enterprise-admin-portal';
  private breakpointObserver = inject(BreakpointObserver);

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );
}
