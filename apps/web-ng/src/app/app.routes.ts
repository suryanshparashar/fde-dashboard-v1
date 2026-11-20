import { Routes } from '@angular/router';

/** Pages load on demand (the spreadsheet reader is only downloaded on the Upload page). */
export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/views').then((m) => m.OverviewPage), title: 'AI Academy FDE Dashboard' },
  { path: 'hs/:name', loadComponent: () => import('./pages/views').then((m) => m.HyperScalerPage), title: 'HyperScaler · AI Academy FDE Dashboard' },
  { path: 'people', loadComponent: () => import('./pages/people').then((m) => m.PeoplePage), title: 'Employees · AI Academy FDE Dashboard' },
  { path: 'upload', loadComponent: () => import('./pages/upload').then((m) => m.UploadPage), title: 'Upload · AI Academy FDE Dashboard' },
  { path: 'uploads', loadComponent: () => import('./pages/uploads').then((m) => m.UploadsPage), title: 'Uploads · AI Academy FDE Dashboard' },
  { path: 'uploads/:id', loadComponent: () => import('./pages/uploads').then((m) => m.ImportSummaryPage), title: 'Upload summary · AI Academy FDE Dashboard' },
  { path: '**', redirectTo: '' },
];
