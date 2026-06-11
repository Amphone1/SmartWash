import { bootstrapService } from '@smartwash/nestkit';
import { AppModule } from './app.module';

void bootstrapService(AppModule, { serviceName: 'audit', defaultPort: 3017 });
