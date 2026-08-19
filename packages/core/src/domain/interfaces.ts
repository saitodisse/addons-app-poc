export interface Greeter {
  greet(name: string): string;
}

export interface Counter {
  increment(): number;
  decrement(): number;
  getValue(): number;
  reset(): number;
}