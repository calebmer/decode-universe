export function Set<V>(): Set<V>;
export function Set<V>(iterable: Iterable<V>): Set<V>;

export interface Set<V> extends Iterable<V> {
  readonly size: number;

  add(value: V): this;
  delete(value: V): this;
  clear(): this;

  first(): V | undefined;

  map<U>(mapper: (value: V) => U): Set<U>;
  filter(predicate: (value: V) => boolean): Set<V>;

  forEach(mapper: (value: V) => void | false): number;
}

export function OrderedSet<V>(): OrderedSet<V>;
export function OrderedSet<V>(iterable: Iterable<V>): OrderedSet<V>;

export interface OrderedSet<V> extends Set<V> {
  map<U>(mapper: (value: V) => U): OrderedSet<U>;
  filter(predicate: (value: V) => boolean): OrderedSet<V>;
}

export function Map<K, V>(): Map<K, V>;
export function Map<K, V>(iterable: Iterable<[K, V]>): Map<K, V>;

export interface Map<K, V> extends Iterable<[K, V]> {
  readonly size: number;

  set(key: K, value: V): this;
  delete(key: K): this;
  clear(): this;

  get(key: K): V;
  has(key: K): boolean;

  map<U>(mapper: (value: V, key: K) => U): Map<K, U>;
  filter(predicate: (value: V, key: K) => boolean): Map<K, V>;

  keys(): Iterable<K>;
  values(): Iterable<V>;
  entries(): Iterable<[K, V]>;

  toArray(): Array<V>;

  forEach(mapper: (value: V, key: K) => void | false): number;
}

export function OrderedMap<K, V>(): OrderedMap<K, V>;
export function OrderedMap<K, V>(iterable: Iterable<[K, V]>): OrderedMap<K, V>;

export interface OrderedMap<K, V> extends Map<K, V> {
  map<U>(mapper: (value: V, key: K) => U): OrderedMap<K, U>;
  filter(predicate: (value: V, key: K) => boolean): OrderedMap<K, V>;
}
