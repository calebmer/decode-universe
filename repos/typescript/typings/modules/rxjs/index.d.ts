export type SubscriberFn<T> = (observer: Observer<T>) => Subscription | (() => void);

export class Observable<T> {
  static never(): Observable<never>;

  constructor(subscriberFn: SubscriberFn<T>)

  subscribe(subscriber: Subscriber<T>): Subscription;

  map<U>(mapper: (value: T) => U): Observable<U>;
  filter(predicate: (value: T) => boolean): Observable<T>;
  switchMap<U>(mapper: (value: T) => Observable<U>): Observable<U>;
  distinctUntilChanged(compare?: (a: T, b: T) => boolean): Observable<T>;
}

export interface Observer<T> {
  next(value: T): void,
  error(error: {}): void,
  complete(): void,
}

export interface Subscriber<T> {
  readonly next?: (value: T) => void,
  readonly error?: (error: {}) => void,
  readonly complete?: () => void,
}

export interface Subscription {
  unsubscribe(): void;
}

export class Subject<T> extends Observable<T> {
  constructor();

  next(value: T): void;
  error(error: {}): void;
  complete(): void;

  asObservable(): Observable<T>;
}

export class BehaviorSubject<T> extends Subject<T> {
  readonly value: T;

  constructor(initialValue: T);
}
