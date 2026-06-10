import { bootstrapService } from '@smartwash/nestkit';
import { AppModule } from './app.module';

void bootstrapService(AppModule, { serviceName: 'machine', defaultPort: 3011 });
