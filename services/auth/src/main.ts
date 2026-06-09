import { bootstrapService } from '@smartwash/nestkit';
import { AppModule } from './app.module';

void bootstrapService(AppModule, { serviceName: 'auth', defaultPort: 3001 });
