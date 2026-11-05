import { CapEventPackagePattern } from '@cap-event/contracts';
import type {
  InvestorDocumentInput,
  InvestorDocumentResult,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { DocumentsService } from './documents.service';

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @MessagePattern(CapEventPackagePattern.INVESTOR_DOCUMENT)
  generate(@Payload() input: InvestorDocumentInput): InvestorDocumentResult {
    return this.documents.generate(input);
  }
}
