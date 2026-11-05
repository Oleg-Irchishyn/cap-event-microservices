import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ValidationException } from '../exceptions/validation.exception';

/**
 * The gateway is where all external input is validated; auth-service
 * re-checks only the types it feeds into queries. Errors are formatted as
 * "field - message" like the rest of the workspace.
 */
@Injectable()
export class ValidationPipe implements PipeTransform<
  unknown,
  Promise<unknown>
> {
  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const obj = plainToInstance<object, unknown>(metadata.metatype, value);
    const errors = await validate(obj);

    if (errors.length) {
      throw new ValidationException(
        errors.map(
          (err) =>
            `${err.property} - ${Object.values(err.constraints ?? {}).join(', ')}`,
        ),
      );
    }
    return value;
  }

  private toValidate(metatype: Type<unknown>): boolean {
    const types: Type<unknown>[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype) && !!metatype.name;
  }
}
