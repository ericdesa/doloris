import { Routes } from '@angular/router';
import { MapperComponent } from './components/mapper/mapper.component';
import { ReportComponent } from './components/report/report.component';
import { AboutComponent } from './components/about/about.component';

export const routes: Routes = [
  { path: '', component: MapperComponent },
  { path: 'report', component: ReportComponent },
  { path: 'about', component: AboutComponent },
];
