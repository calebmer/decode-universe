interface ReadonlyMap<K, V> {
  [Symbol.iterator](): IterableIterator<[K, V]>;
  entries(): IterableIterator<[K, V]>;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
}

interface ReadonlySet<T> {
  [Symbol.iterator](): IterableIterator<T>;
  entries(): IterableIterator<[T, T]>;
  keys(): IterableIterator<T>;
  values(): IterableIterator<T>;
}
