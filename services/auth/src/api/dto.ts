import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

/** Body for POST /auth/introspect — used by the gateway/BFF to resolve a token. */
export class IntrospectDto {
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  token!: string;
}
