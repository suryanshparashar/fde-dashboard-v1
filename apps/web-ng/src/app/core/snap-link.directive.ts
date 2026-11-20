import { Directive, HostBinding, HostListener, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DataService, withSnapshot } from './data.service';

/**
 * <a [snapLink]="'/people?hs=AWS'"> — an in-app link that keeps the selected past month (?snapshot=…).
 * Ctrl/Cmd/Shift/middle-click keep the browser's default (new tab / window).
 */
@Directive({ selector: 'a[snapLink]', standalone: true })
export class SnapLinkDirective {
  @Input({ required: true }) snapLink!: string;
  private router = inject(Router);
  private data = inject(DataService);

  @HostBinding('attr.href') get href(): string {
    return withSnapshot(this.snapLink, this.data.param());
  }

  @HostListener('click', ['$event'])
  onClick(ev: MouseEvent): boolean {
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return true;
    ev.preventDefault();
    void this.router.navigateByUrl(this.href);
    return false;
  }
}
