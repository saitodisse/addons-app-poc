import type { AddonInteractionContract, InteractionPayload, InteractionSchema, ServiceInteraction } from './contract';
import type { AddonTabResult } from './tab';

export interface RuntimeValidationResult {
  valid: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function equalEnumValue(left: unknown, right: unknown): boolean {
  return Object.is(left, right);
}

/** Validates a value against the JSON Schema subset declared in the contract. */
export function validateValueAgainstSchema(value: unknown, schema: InteractionSchema, path = 'value'): RuntimeValidationResult {
  const errors: string[] = [];
  const type = schema.type;

  if (schema.enum && !schema.enum.some((candidate) => equalEnumValue(candidate, value))) {
    errors.push(`${path} must be one of the declared values`);
  }

  switch (type) {
    case 'string':
      if (typeof value !== 'string') errors.push(`${path} must be a string`);
      else if (schema.format === 'uri') {
        try { new URL(value); } catch { errors.push(`${path} must be a valid URL`); }
      }
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path} must be a number`);
      break;
    case 'integer':
      if (!Number.isInteger(value)) errors.push(`${path} must be an integer`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path} must be a boolean`);
      break;
    case 'null':
      if (value !== null) errors.push(`${path} must be null`);
      break;
    case 'array':
      if (!Array.isArray(value)) errors.push(`${path} must be an array`);
      else if (schema.items) value.forEach((item, index) => errors.push(...validateValueAgainstSchema(item, schema.items!, `${path}[${index}]`).errors));
      break;
    case 'object':
      if (!isObject(value)) {
        errors.push(`${path} must be an object`);
      } else {
        for (const required of schema.required ?? []) {
          if (!(required in value)) errors.push(`${path}.${required} is required`);
        }
        for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
          if (key in value) errors.push(...validateValueAgainstSchema(value[key], propertySchema, `${path}.${key}`).errors);
        }
      }
      break;
    default:
      errors.push(`${path} uses an unsupported type: ${type}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validatePayloadValue(value: unknown, payload: InteractionPayload, path = 'value'): RuntimeValidationResult {
  return validateValueAgainstSchema(value, payload.schema, path);
}

function findService(contract: AddonInteractionContract, serviceId: string): ServiceInteraction | undefined {
  return contract.services.find((service) => service.id === serviceId);
}

function findMethod(service: ServiceInteraction | undefined, methodId: string) {
  return service?.methods?.find((method) => method.id === methodId);
}

/** Validates serialized arguments for a service call. */
export function validateServiceCallInput(contract: AddonInteractionContract, serviceId: string, methodId: string, args: unknown[]): RuntimeValidationResult {
  const service = findService(contract, serviceId);
  const method = findMethod(service, methodId);
  if (!service) return { valid: false, errors: [`Service not declared in the contract: ${serviceId}`] };
  if (!method) return { valid: false, errors: [`Method not declared in the contract: ${serviceId}.${methodId}`] };
  // Without a serialized payload, the contract imposes no input shape
  // (for example, local `subscribe` callbacks).
  if (!method.receives) return { valid: true, errors: [] };

  let value: unknown = args.length === 1 ? args[0] : args;
  // Implementations may keep idiomatic methods with positional arguments. When
  // the contract describes an object, arguments follow the properties order.
  if (method.receives.schema.type === 'object' && method.receives.schema.properties && (args.length > 1 || !isObject(args[0]))) {
    const keys = Object.keys(method.receives.schema.properties);
    value = Object.fromEntries(keys.slice(0, args.length).map((key, index) => [key, args[index]]));
  }
  return validatePayloadValue(value, method.receives, `${serviceId}.${methodId}.input`);
}

export function validateServiceCallOutput(contract: AddonInteractionContract, serviceId: string, methodId: string, value: unknown): RuntimeValidationResult {
  const method = findMethod(findService(contract, serviceId), methodId);
  if (!method) return { valid: false, errors: [`Method not declared in the contract: ${serviceId}.${methodId}`] };
  if (!method.returns) return { valid: true, errors: [] };
  return validatePayloadValue(value, method.returns, `${serviceId}.${methodId}.output`);
}

/** Checks the serializable format of tab action responses. */
export function validateTabResult(result: unknown): RuntimeValidationResult {
  const errors: string[] = [];
  if (!isObject(result) || !['info', 'success', 'error'].includes(String(result.status))) {
    errors.push('Tab response must declare status info, success, or error');
  }
  if (!isObject(result) || typeof result.body !== 'string') errors.push('Tab response must declare a string body');
  if (isObject(result) && result.title != null && typeof result.title !== 'string') errors.push('Tab response must declare a string title');
  if (isObject(result) && result.items != null) {
    if (!Array.isArray(result.items)) errors.push('Tab response must declare items as an array');
    else {
      result.items.forEach((item, index) => {
        if (!isObject(item) || typeof item.label !== 'string' || typeof item.value !== 'string') errors.push(`Tab response items[${index}] must declare string label and value`);
        if (isObject(item) && item.details !== undefined) {
          try { JSON.stringify(item.details); } catch { errors.push(`Tab response items[${index}].details must be JSON serializable`); }
        }
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Checks the minimum required to publish a structured log event. */
export function validateLogEvent(contract: AddonInteractionContract, level: string, message: string, details?: unknown): RuntimeValidationResult {
  const errors: string[] = [];
  if (!['info', 'warn', 'error'].includes(level)) errors.push(`Invalid log level: ${level}`);
  if (typeof message !== 'string' || !message.trim()) errors.push('Log message cannot be empty');
  if (details !== undefined) {
    try { JSON.stringify(details); } catch { errors.push('Log details must be JSON serializable'); }
  }
  const declarations = contract.logs.filter((entry) => entry.level === level);
  const detailDeclaration = declarations.find((entry) => entry.details);
  if (detailDeclaration?.details && details !== undefined) {
    errors.push(...validatePayloadValue(details, detailDeclaration.details, 'log.details').errors);
  }
  return { valid: errors.length === 0, errors };
}

/** Checks persisted data before giving it to an add-on. */
export function validateStateValue(contract: AddonInteractionContract, key: string, value: unknown): RuntimeValidationResult {
  const declaration = contract.state.find((state) => state.key === key || state.keyPattern === '*' || (state.keyPattern?.endsWith('*') && key.startsWith(state.keyPattern.slice(0, -1))));
  if (!declaration) return { valid: false, errors: [`State key not declared: ${key}`] };
  return validatePayloadValue(value, declaration.value, `state.${key}`);
}

export function validateTabResultType(result: AddonTabResult): RuntimeValidationResult {
  return validateTabResult(result);
}
