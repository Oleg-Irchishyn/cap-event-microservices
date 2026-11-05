import { ApiProperty } from '@nestjs/swagger';

export class DiscoveryDocumentDto {
  @ApiProperty({ example: 'http://localhost:4000/oidc/2' })
  issuer: string;

  @ApiProperty() authorization_endpoint: string;
  @ApiProperty() token_endpoint: string;
  @ApiProperty() end_session_endpoint: string;
  @ApiProperty({ type: [String] }) response_types_supported: string[];
  @ApiProperty({ type: [String] }) grant_types_supported: string[];
  @ApiProperty({ type: [String] }) subject_types_supported: string[];
  @ApiProperty({ type: [String] })
  id_token_signing_alg_values_supported: string[];
  @ApiProperty({ type: [String] }) scopes_supported: string[];
  @ApiProperty({ type: [String] })
  token_endpoint_auth_methods_supported: string[];
  @ApiProperty({ type: [String] }) code_challenge_methods_supported: string[];
  @ApiProperty({ type: [String] }) claims_supported: string[];
}
