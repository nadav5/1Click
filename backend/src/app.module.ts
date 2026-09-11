import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CampaignModule } from './campaign/campaign.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'temp'),
      serveRoot: '/temp',
      serveStaticOptions: {
        fallthrough: true,
        setHeaders: (res: any) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        },
      },
    }),
    CampaignModule,
  ],
})
export class AppModule {}
