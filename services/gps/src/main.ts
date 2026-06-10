import { bootstrapService } from '@smartwash/nestkit';
import { AppModule } from './app.module';

void bootstrapService(AppModule, { serviceName: 'gps', defaultPort: 3013 });
