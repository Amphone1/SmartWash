import { bootstrapService } from '@smartwash/nestkit';
import { AppModule } from './app.module';

void bootstrapService(AppModule, { serviceName: 'wallet', defaultPort: 3006 });
