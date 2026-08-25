import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

/**
 * There is no router in this project and V1 does not need one. The private
 * media screen is a second entry point rather than a route: on /admin the
 * landing page is never constructed at all, so nothing the admin screen does
 * can reach the public site's scroll drivers, observers or styles.
 *
 * The hash form is supported as well, and is the one to use if the host is not
 * rewriting unknown paths to index.html.
 */
const path = location.pathname.replace(/\/+$/, '');
const isAdmin = path === '/admin' || location.hash === '#admin';

if (isAdmin) {
  import('./app/admin/admin.component')
    .then(({ AdminComponent }) => bootstrapApplication(AdminComponent))
    .catch((err) => console.error(err));
} else {
  bootstrapApplication(AppComponent).catch((err) => console.error(err));
}
