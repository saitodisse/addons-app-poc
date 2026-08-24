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

/** Valida um valor contra o subconjunto de JSON Schema declarado no contrato. */
export function validateValueAgainstSchema(value: unknown, schema: InteractionSchema, path = 'value'): RuntimeValidationResult {
  const errors: string[] = [];
  const type = schema.type;

  if (schema.enum && !schema.enum.some((candidate) => equalEnumValue(candidate, value))) {
    errors.push(`${path} deve ser um dos valores declarados`);
  }

  switch (type) {
    case 'string':
      if (typeof value !== 'string') errors.push(`${path} deve ser string`);
      else if (schema.format === 'uri') {
        try { new URL(value); } catch { errors.push(`${path} deve ser uma URL válida`); }
      }
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path} deve ser número`);
      break;
    case 'integer':
      if (!Number.isInteger(value)) errors.push(`${path} deve ser inteiro`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path} deve ser booleano`);
      break;
    case 'null':
      if (value !== null) errors.push(`${path} deve ser nulo`);
      break;
    case 'array':
      if (!Array.isArray(value)) errors.push(`${path} deve ser uma lista`);
      else if (schema.items) value.forEach((item, index) => errors.push(...validateValueAgainstSchema(item, schema.items!, `${path}[${index}]`).errors));
      break;
    case 'object':
      if (!isObject(value)) {
        errors.push(`${path} deve ser um objeto`);
      } else {
        for (const required of schema.required ?? []) {
          if (!(required in value)) errors.push(`${path}.${required} é obrigatório`);
        }
        for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
          if (key in value) errors.push(...validateValueAgainstSchema(value[key], propertySchema, `${path}.${key}`).errors);
        }
      }
      break;
    default:
      errors.push(`${path} usa um tipo não suportado: ${type}`);
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

/** Valida os argumentos serializados de uma chamada de serviço. */
export function validateServiceCallInput(contract: AddonInteractionContract, serviceId: string, methodId: string, args: unknown[]): RuntimeValidationResult {
  const service = findService(contract, serviceId);
  const method = findMethod(service, methodId);
  if (!service) return { valid: false, errors: [`Serviço não declarado no contrato: ${serviceId}`] };
  if (!method) return { valid: false, errors: [`Método não declarado no contrato: ${serviceId}.${methodId}`] };
  // Sem um payload serializado, o contrato não impõe uma forma de entrada
  // (por exemplo, callbacks locais de `subscribe`).
  if (!method.receives) return { valid: true, errors: [] };

  let value: unknown = args.length === 1 ? args[0] : args;
  // Autoria pode manter métodos idiomáticos com argumentos posicionais. Quando o
  // contrato descreve um objeto, os argumentos seguem a ordem de properties.
  if (method.receives.schema.type === 'object' && method.receives.schema.properties && (args.length > 1 || !isObject(args[0]))) {
    const keys = Object.keys(method.receives.schema.properties);
    value = Object.fromEntries(keys.slice(0, args.length).map((key, index) => [key, args[index]]));
  }
  return validatePayloadValue(value, method.receives, `${serviceId}.${methodId}.input`);
}

export function validateServiceCallOutput(contract: AddonInteractionContract, serviceId: string, methodId: string, value: unknown): RuntimeValidationResult {
  const method = findMethod(findService(contract, serviceId), methodId);
  if (!method) return { valid: false, errors: [`Método não declarado no contrato: ${serviceId}.${methodId}`] };
  if (!method.returns) return { valid: true, errors: [] };
  return validatePayloadValue(value, method.returns, `${serviceId}.${methodId}.output`);
}

/** Confere o formato serializável das respostas de ações de aba. */
export function validateTabResult(result: unknown): RuntimeValidationResult {
  const errors: string[] = [];
  if (!isObject(result) || !['info', 'success', 'error'].includes(String(result.status))) {
    errors.push('Resposta da aba deve declarar status info, success ou error');
  }
  if (!isObject(result) || typeof result.body !== 'string') errors.push('Resposta da aba deve declarar body string');
  if (isObject(result) && result.title != null && typeof result.title !== 'string') errors.push('Resposta da aba deve declarar title string');
  if (isObject(result) && result.items != null) {
    if (!Array.isArray(result.items)) errors.push('Resposta da aba deve declarar items como lista');
    else {
      result.items.forEach((item, index) => {
        if (!isObject(item) || typeof item.label !== 'string' || typeof item.value !== 'string') errors.push(`Resposta da aba items[${index}] deve declarar label e value string`);
        if (isObject(item) && item.details !== undefined) {
          try { JSON.stringify(item.details); } catch { errors.push(`Resposta da aba items[${index}].details deve ser JSON serializável`); }
        }
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Confere o mínimo necessário para publicar um evento no log estruturado. */
export function validateLogEvent(contract: AddonInteractionContract, level: string, message: string, details?: unknown): RuntimeValidationResult {
  const errors: string[] = [];
  if (!['info', 'warn', 'error'].includes(level)) errors.push(`Nível de log inválido: ${level}`);
  if (typeof message !== 'string' || !message.trim()) errors.push('Mensagem de log não pode ser vazia');
  if (details !== undefined) {
    try { JSON.stringify(details); } catch { errors.push('Detalhes do log devem ser JSON serializáveis'); }
  }
  const declarations = contract.logs.filter((entry) => entry.level === level);
  const detailDeclaration = declarations.find((entry) => entry.details);
  if (detailDeclaration?.details && details !== undefined) {
    errors.push(...validatePayloadValue(details, detailDeclaration.details, 'log.details').errors);
  }
  return { valid: errors.length === 0, errors };
}

/** Confere dados persistidos antes de entregá-los a um add-on. */
export function validateStateValue(contract: AddonInteractionContract, key: string, value: unknown): RuntimeValidationResult {
  const declaration = contract.state.find((state) => state.key === key || state.keyPattern === '*' || (state.keyPattern?.endsWith('*') && key.startsWith(state.keyPattern.slice(0, -1))));
  if (!declaration) return { valid: false, errors: [`Chave de estado não declarada: ${key}`] };
  return validatePayloadValue(value, declaration.value, `state.${key}`);
}

export function validateTabResultType(result: AddonTabResult): RuntimeValidationResult {
  return validateTabResult(result);
}
